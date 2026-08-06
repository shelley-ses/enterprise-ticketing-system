<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Events\MessageUpdated;
use App\Events\MessageDeleted;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MessageController extends Controller
{
    /**
     * Get all messages for a specific ticket.
     */
    public function index($ticket_id)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $userKey = $this->resolveUserKey($user);

        // Fetch messages for the ticket ordered by created_at ascending,
        // excluding those that are soft-deleted ("deleted for you") by this user.
        $messages = Message::where('ticket_id', (int)$ticket_id)
            ->whereNotIn('deleted_by', [$userKey])
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'messages' => $messages
        ]);
    }

    /**
     * Store an auto-generated internal message from a subsystem.
     */
    public function storeInternal(Request $request, $ticket_id)
    {
        $token = $request->header('X-Internal-Token');
        if (!$token || $token !== env('INTERNAL_TOKEN')) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'message' => 'required|string|max:5000',
            'sender_name' => 'required|string|max:255',
            'sender_type' => 'required|string|max:50',
            'sender_id' => 'nullable|integer',
        ]);

        $message = Message::create([
            'ticket_id' => (int)$ticket_id,
            'sender_id' => $request->input('sender_id'),
            'sender_name' => $request->input('sender_name'),
            'sender_type' => $request->input('sender_type'),
            'message' => $request->input('message'),
        ]);

        broadcast(new MessageSent($message))->toOthers();

        return response()->json([
            'message' => 'Internal message stored successfully.',
            'message_obj' => $message
        ], 201);
    }

    /**
     * Store a new message and broadcast it.
     */
    public function store(Request $request, $ticket_id)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        // Resolve sender information
        $senderId = null;
        $senderName = '';
        $senderType = '';

        if ($user instanceof \App\Models\Employee) {
            $senderId = $user->emp_id;
            $senderName = trim($user->first_name . ' ' . $user->last_name);
            
            $dept = strtolower($user->department ?? '');
            $role = strtolower($user->role ?? '');
            if (str_contains($dept, 'customer service') || str_contains($dept, 'support') || $dept === 'cs' || str_contains($role, 'cs')) {
                $senderType = 'cs';
            } else {
                $senderType = 'employee';
            }
        } elseif ($user instanceof \App\Models\Client) {
            $senderId = $user->id;
            $senderName = $user->client_name;
            $senderType = 'customer';
        } else {
            $senderId = $user->id;
            $senderName = $user->name ?? 'Unknown';
            $senderType = 'customer';
        }

        // Check ticket status and delegation state for archiving restriction
        $ticketRecord = \Illuminate\Support\Facades\DB::connection('mysql')
            ->table('tickets')
            ->where('ticket_ID', (int)$ticket_id)
            ->first();

        if ($ticketRecord) {
            $statusId = (int)$ticketRecord->ticket_status_ID;
            if ($senderType === 'cs' && (int)$ticketRecord->requested_by === (int)$senderId) {
                return response()->json(['message' => 'You cannot message on a ticket you created.'], 403);
            }

            $hasAssignment = !empty($ticketRecord->assigned_to);
            if (!$hasAssignment) {
                $hasAssignment = \Illuminate\Support\Facades\DB::connection('mysql')
                    ->table('ticket_assignments')
                    ->where('ticket_ID', (int)$ticket_id)
                    ->exists();
            }

            // Status ID 4 = Closed, Status ID 8 = Reopened
            $isClosed = ($statusId === 4);
            $isDelegated = $hasAssignment || (!in_array($statusId, [1, 7, 8])); // 1: Open, 7: Pending, 8: Reopened

            if ($isClosed || $isDelegated) {
                return response()->json([
                    'message' => 'This conversation is archived because the ticket has been delegated or closed. Reopen the ticket to restore the conversation.'
                ], 403);
            }
        }

        // Create the message in MongoDB
        $message = Message::create([
            'ticket_id' => (int)$ticket_id,
            'sender_id' => $senderId,
            'sender_name' => $senderName,
            'sender_type' => $senderType,
            'message' => $request->input('message'),
        ]);

        // Broadcast to Reverb (port 6002) for real-time messaging
        broadcast(new MessageSent($message))->toOthers();

        // Create Notifications in MySQL & Broadcast TicketChanged on central Reverb
        try {
            $ticket = \Illuminate\Support\Facades\DB::connection('mysql')
                ->table('tickets')
                ->where('ticket_ID', (int)$ticket_id)
                ->first();

            if ($ticket) {
                if (($senderType === 'cs' || $senderType === 'employee') && !$ticket->first_response_at) {
                    $now = now();
                    $status = null;
                    if (!empty($ticket->response_due_at)) {
                        $dueAt = \Illuminate\Support\Carbon::parse($ticket->response_due_at);
                        $status = $now->lte($dueAt) ? 'MET' : 'BREACHED';
                    }
                    \Illuminate\Support\Facades\DB::connection('mysql')
                        ->table('tickets')
                        ->where('ticket_ID', (int)$ticket_id)
                        ->update([
                            'first_response_at' => $now,
                            'response_sla_status' => $status,
                            'updated_at' => $now,
                        ]);
                }

                $recipients = []; // array of ['id' => X, 'type' => 'client'|'employee']
                
                // Get assigned employee IDs
                $assignedEmpIds = [];
                if ($ticket->assigned_to) {
                    $assignedEmpIds[] = (int)$ticket->assigned_to;
                }
                $dbAssigned = \Illuminate\Support\Facades\DB::connection('mysql')
                    ->table('ticket_assignments')
                    ->where('ticket_ID', (int)$ticket_id)
                    ->pluck('employee_ID')
                    ->map(fn($id) => (int)$id)
                    ->all();
                $assignedEmpIds = array_unique(array_merge($assignedEmpIds, $dbAssigned));

                if ($senderType === 'customer') {
                    // Message from customer -> notify all assigned employees, or CS if none assigned
                    if (empty($assignedEmpIds)) {
                        $assignedEmpIds = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('employees')
                            ->where('role', 'customer service')
                            ->pluck('emp_id')
                            ->map(fn($id) => (int)$id)
                            ->all();
                    }
                    
                    foreach ($assignedEmpIds as $empId) {
                        $recipients[] = [
                            'id' => $empId,
                            'type' => 'employee'
                        ];
                    }
                } else {
                    // Message from employee or CS agent -> notify customer/requester AND other assigned employees
                    if ($ticket->is_internal) {
                        // Internal ticket: notify requester (if not sender) AND other assigned employees
                        $requesterId = (int)$ticket->requested_by;
                        if ($senderId !== $requesterId) {
                            $recipients[] = [
                                'id' => $requesterId,
                                'type' => 'employee'
                            ];
                        }
                        
                        foreach ($assignedEmpIds as $empId) {
                            if ($senderId !== $empId) {
                                $recipients[] = [
                                    'id' => $empId,
                                    'type' => 'employee'
                                ];
                            }
                        }
                    } else {
                        // External ticket: notify customer AND other assigned employees
                        $recipients[] = [
                            'id' => (int)$ticket->created_by,
                            'type' => 'client'
                        ];

                        foreach ($assignedEmpIds as $empId) {
                            if ($senderId !== $empId) {
                                $recipients[] = [
                                    'id' => $empId,
                                    'type' => 'employee'
                                ];
                            }
                        }
                    }
                }

                // Insert notifications in MySQL DB
                foreach ($recipients as $recipient) {
                    \Illuminate\Support\Facades\DB::connection('mysql')
                        ->table('notifications')
                        ->insert([
                            'recipient_id' => $recipient['id'],
                            'recipient_type' => $recipient['type'],
                            'title' => 'New Message on Ticket #' . $ticket_id,
                            'message' => $senderName . ': ' . \Illuminate\Support\Str::limit($message->message, 60),
                            'ticket_id' => (int)$ticket_id,
                            'is_read' => false,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                }

                // Broadcast TicketChanged event to update frontend headers (port 6001) in real-time
                event(new \App\Events\TicketChanged([
                    'action' => 'message_sent',
                    'ticket_ID' => (int)$ticket_id,
                    'ticketId' => (int)$ticket_id,
                    'updated_at' => now()->toISOString(),
                    'customer_id' => $ticket->created_by,
                    'assigned_to' => $ticket->assigned_to,
                    'ticket_status_ID' => $ticket->ticket_status_ID,
                ]));
            }
        } catch (\Exception $ex) {
            \Illuminate\Support\Facades\Log::error('Error creating notification for message: ' . $ex->getMessage());
        }

        return response()->json([
            'message' => 'Message sent successfully',
            'data' => $message
        ], 201);
    }

    /**
     * Update a message (edit) and broadcast it.
     */
    public function update(Request $request, $ticket_id, $message_id)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $message = Message::where('ticket_id', (int)$ticket_id)->find($message_id);
        if (!$message) {
            return response()->json(['message' => 'Message not found'], 404);
        }

        // Only the sender of the message can edit it
        $userKey = $this->resolveUserKey($user);
        $messageSenderKey = $message->sender_type . ':' . $message->sender_id;

        if ($userKey !== $messageSenderKey) {
            return response()->json(['message' => 'Unauthorized to edit this message'], 403);
        }

        // Append to edit history
        $history = $message->edit_history ?? [];
        $history[] = [
            'message' => $message->message,
            'edited_at' => now()->toIso8601String(),
        ];

        $message->edit_history = $history;
        $message->message = $request->input('message');
        $message->save();

        // Broadcast to Reverb
        broadcast(new MessageUpdated($message))->toOthers();

        return response()->json([
            'message' => 'Message updated successfully',
            'data' => $message
        ]);
    }

    /**
     * Delete a message for the current user ("delete for you").
     */
    public function destroy($ticket_id, $message_id)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $message = Message::where('ticket_id', (int)$ticket_id)->find($message_id);
        if (!$message) {
            return response()->json(['message' => 'Message not found'], 404);
        }

        $userKey = $this->resolveUserKey($user);

        // Add user key to deleted_by array if not already present
        $deletedBy = $message->deleted_by ?? [];
        if (!in_array($userKey, $deletedBy)) {
            $deletedBy[] = $userKey;
            $message->deleted_by = $deletedBy;
            $message->save();
        }

        // Broadcast deletion event so other sessions/tabs of the same user hide it
        broadcast(new MessageDeleted($message->id, (int)$ticket_id, $userKey))->toOthers();

        return response()->json([
            'message' => 'Message deleted for you successfully'
        ]);
    }

    /**
     * Helper to resolve the unique identifier key for a user.
     */
    protected function resolveUserKey($user)
    {
        if ($user instanceof \App\Models\Employee) {
            $senderId = $user->emp_id;
            $dept = strtolower($user->department ?? '');
            $role = strtolower($user->role ?? '');
            if (str_contains($dept, 'customer service') || str_contains($dept, 'support') || $dept === 'cs' || str_contains($role, 'cs')) {
                $senderType = 'cs';
            } else {
                $senderType = 'employee';
            }
        } else {
            $senderId = $user->id;
            $senderType = 'customer';
        }
        return $senderType . ':' . $senderId;
    }
}
