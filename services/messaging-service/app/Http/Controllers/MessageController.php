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

        // Check employee access authorization on the ticket
        if ($user instanceof \App\Models\Employee) {
            $dept = strtolower($user->department ?? '');
            $role = strtolower($user->role ?? '');
            $isCS = str_contains($dept, 'customer service') || str_contains($dept, 'support') || $dept === 'cs' || str_contains($role, 'cs');
            $isAdmin = in_array(str_replace([' ', '_', '-'], '', $role), ['superadmin', 'admin']);

            if (!$isCS && !$isAdmin) {
                $empId = (int)$user->emp_id;
                $ticketRecord = \Illuminate\Support\Facades\DB::connection('mysql')
                    ->table('tickets')
                    ->where('ticket_ID', (int)$ticket_id)
                    ->first();

                if ($ticketRecord) {
                    $isRequester = ((int)$ticketRecord->requested_by === $empId);
                    if (!$isRequester) {
                        $isAssigned = ((int)$ticketRecord->assigned_to === $empId);
                        if (!$isAssigned) {
                            $isAssigned = \Illuminate\Support\Facades\DB::connection('mysql')
                                ->table('ticket_assignments')
                                ->where('ticket_ID', (int)$ticket_id)
                                ->where('employee_ID', $empId)
                                ->exists();
                        }

                        if (!$isAssigned) {
                            return response()->json(['message' => 'You are not assigned to this ticket.'], 403);
                        }

                        // Check if delegated employee messaging is enabled in ticket_configurations
                        $allowDelegated = true;
                        try {
                            $msgConfigRow = \Illuminate\Support\Facades\DB::connection('mysql')
                                ->table('ticket_configurations')
                                ->where('key', 'messaging')
                                ->value('value');
                            if ($msgConfigRow) {
                                $parsedMsgConfig = is_string($msgConfigRow) ? json_decode($msgConfigRow, true) : $msgConfigRow;
                                if (is_array($parsedMsgConfig) && isset($parsedMsgConfig['allow_delegated_employee'])) {
                                    $allowDelegated = (bool)$parsedMsgConfig['allow_delegated_employee'];
                                }
                            }
                        } catch (\Throwable $e) {}

                        if (!$allowDelegated) {
                            return response()->json(['message' => 'Delegated employee messaging is disabled by system policy.'], 403);
                        }
                    }
                }
            }
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

            if ($senderType === 'employee') {
                $isRequester = ((int)$ticketRecord->requested_by === (int)$senderId);
                if (!$isRequester) {
                    $isAssigned = ((int)$ticketRecord->assigned_to === (int)$senderId);
                    if (!$isAssigned) {
                        $isAssigned = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('ticket_assignments')
                            ->where('ticket_ID', (int)$ticket_id)
                            ->where('employee_ID', (int)$senderId)
                            ->exists();
                    }

                    if (!$isAssigned) {
                        return response()->json(['message' => 'You are not assigned to this ticket.'], 403);
                    }

                    // Check if delegated employee messaging is enabled in ticket_configurations
                    $allowDelegated = true;
                    try {
                        $msgConfigRow = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('ticket_configurations')
                            ->where('key', 'messaging')
                            ->value('value');
                        if ($msgConfigRow) {
                            $parsedMsgConfig = is_string($msgConfigRow) ? json_decode($msgConfigRow, true) : $msgConfigRow;
                            if (is_array($parsedMsgConfig) && isset($parsedMsgConfig['allow_delegated_employee'])) {
                                $allowDelegated = (bool)$parsedMsgConfig['allow_delegated_employee'];
                            }
                        }
                    } catch (\Throwable $e) {}

                    if (!$allowDelegated) {
                        return response()->json([
                            'message' => 'Delegated employee messaging is disabled by system policy.'
                        ], 403);
                    }
                }
            }

            $hasAssignment = !empty($ticketRecord->assigned_to);
            if (!$hasAssignment) {
                $hasAssignment = \Illuminate\Support\Facades\DB::connection('mysql')
                    ->table('ticket_assignments')
                    ->where('ticket_ID', (int)$ticket_id)
                    ->exists();
            }

            // Status ID 4 = Closed (Archived)
            $isClosed = ($statusId === 4);

            if ($isClosed) {
                return response()->json([
                    'message' => 'This conversation is archived because the ticket has been closed. Reopen the ticket to restore the conversation.'
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

                // Read active routing configuration at send time
                $routingTokens = ['contextual_assigned'];
                try {
                    $routingRow = \Illuminate\Support\Facades\DB::connection('mysql')
                        ->table('ticket_configurations')
                        ->where('key', 'routing')
                        ->value('value');
                    if ($routingRow) {
                        $parsed = is_string($routingRow) ? json_decode($routingRow, true) : $routingRow;
                        if (is_array($parsed) && !empty($parsed['new_message'])) {
                            $routingTokens = $parsed['new_message'];
                        }
                    }
                } catch (\Throwable $e) {}

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

                foreach ($routingTokens as $token) {
                    if ($token === 'contextual_assigned') {
                        if ($senderType === 'customer' && empty($assignedEmpIds)) {
                            // Fallback to CS if no employee assigned so customer message is never lost
                            $csIds = \Illuminate\Support\Facades\DB::connection('mysql')
                                ->table('employees')
                                ->where('role', 'customer service')
                                ->pluck('emp_id')
                                ->map(fn($id) => (int)$id)
                                ->all();
                            foreach ($csIds as $empId) {
                                $recipients[] = ['id' => $empId, 'type' => 'employee'];
                            }
                        } else {
                            foreach ($assignedEmpIds as $empId) {
                                if (!($senderType !== 'customer' && (int)$senderId === (int)$empId)) {
                                    $recipients[] = ['id' => $empId, 'type' => 'employee'];
                                }
                            }
                        }
                    } elseif ($token === 'contextual_requester') {
                        if ($ticket->is_internal) {
                            $requesterId = (int)$ticket->requested_by;
                            if (!($senderType !== 'customer' && (int)$senderId === $requesterId)) {
                                $recipients[] = ['id' => $requesterId, 'type' => 'employee'];
                            }
                        } else {
                            if ($senderType !== 'customer') {
                                $recipients[] = ['id' => (int)$ticket->created_by, 'type' => 'client'];
                            }
                        }
                    } elseif ($token === 'role_cs') {
                        $csIds = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('employees')
                            ->where('role', 'customer service')
                            ->pluck('emp_id')
                            ->map(fn($id) => (int)$id)
                            ->all();
                        foreach ($csIds as $empId) {
                            if (!($senderType !== 'customer' && (int)$senderId === (int)$empId)) {
                                $recipients[] = ['id' => $empId, 'type' => 'employee'];
                            }
                        }
                    } elseif ($token === 'role_service') {
                        $svcIds = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('employees')
                            ->whereIn('role', ['service', 'service engineer', 'technician'])
                            ->pluck('emp_id')
                            ->map(fn($id) => (int)$id)
                            ->all();
                        foreach ($svcIds as $empId) {
                            if (!($senderType !== 'customer' && (int)$senderId === (int)$empId)) {
                                $recipients[] = ['id' => $empId, 'type' => 'employee'];
                            }
                        }
                    } elseif ($token === 'role_it_admin') {
                        $itIds = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('employees')
                            ->whereIn('role', ['it admin', 'it_admin', 'it administrator'])
                            ->pluck('emp_id')
                            ->map(fn($id) => (int)$id)
                            ->all();
                        foreach ($itIds as $empId) {
                            if (!($senderType !== 'customer' && (int)$senderId === (int)$empId)) {
                                $recipients[] = ['id' => $empId, 'type' => 'employee'];
                            }
                        }
                    } elseif ($token === 'role_superadmin') {
                        $adminIds = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('employees')
                            ->whereRaw('LOWER(REPLACE(role, " ", "")) = ?', ['superadmin'])
                            ->pluck('emp_id')
                            ->map(fn($id) => (int)$id)
                            ->all();
                        foreach ($adminIds as $empId) {
                            if (!($senderType !== 'customer' && (int)$senderId === (int)$empId)) {
                                $recipients[] = ['id' => $empId, 'type' => 'employee'];
                            }
                        }
                    } elseif (str_starts_with($token, 'dept_')) {
                        $deptId = (int) substr($token, 5);
                        $deptEmpIds = \Illuminate\Support\Facades\DB::connection('mysql')
                            ->table('employees')
                            ->where('department_id', $deptId)
                            ->pluck('emp_id')
                            ->map(fn($id) => (int)$id)
                            ->all();
                        foreach ($deptEmpIds as $empId) {
                            if (!($senderType !== 'customer' && (int)$senderId === (int)$empId)) {
                                $recipients[] = ['id' => $empId, 'type' => 'employee'];
                            }
                        }
                    }
                }

                // If sender is employee/CS and no recipients resolved, always ensure customer/requester gets notified
                if ($senderType !== 'customer' && empty($recipients)) {
                    if ($ticket->is_internal) {
                        $recipients[] = ['id' => (int)$ticket->requested_by, 'type' => 'employee'];
                    } else {
                        $recipients[] = ['id' => (int)$ticket->created_by, 'type' => 'client'];
                    }
                }

                // Deduplicate recipients
                $uniqueRecipients = [];
                foreach ($recipients as $r) {
                    $key = $r['type'] . ':' . $r['id'];
                    $uniqueRecipients[$key] = $r;
                }
                $recipients = array_values($uniqueRecipients);

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
        if (!$user && ($request->input('user_id') || $request->header('X-User-Id'))) {
            $fallbackId = $request->input('user_id') ?: $request->header('X-User-Id');
            $fallbackType = $request->input('user_type') ?: $request->header('X-User-Type', 'customer');
            $fallbackName = $request->input('user_name') ?: $request->header('X-User-Name', 'User');
            $user = new \Illuminate\Auth\GenericUser([
                'id' => $fallbackId,
                'name' => $fallbackName,
                'user_type' => $fallbackType,
            ]);
        }

        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized.',
                'code' => 'UNAUTHORIZED',
            ], 401);
        }

        // Enforce non-empty content validation (consistent with new messages)
        $rawMessage = $request->input('message');
        if (!is_string($rawMessage) || trim($rawMessage) === '') {
            return response()->json([
                'message' => 'Message content cannot be empty.',
                'code' => 'EMPTY_CONTENT',
                'errors' => [
                    'message' => ['The message field cannot be empty.']
                ]
            ], 422);
        }

        $newMessage = trim($rawMessage);
        if (mb_strlen($newMessage) > 5000) {
            return response()->json([
                'message' => 'Message exceeds maximum length of 5000 characters.',
                'code' => 'CONTENT_TOO_LONG',
                'errors' => [
                    'message' => ['The message must not exceed 5000 characters.']
                ]
            ], 422);
        }

        // Locate message in MongoDB (support both int and string ticket_id)
        $message = Message::whereIn('ticket_id', [(int)$ticket_id, (string)$ticket_id])->find($message_id);
        if (!$message) {
            return response()->json([
                'message' => 'Message not found.',
                'code' => 'NOT_FOUND',
            ], 404);
        }

        // Security check: Restricted strictly to the original sender
        $userKey = $this->resolveUserKey($user);
        $messageSenderKey = $message->sender_type . ':' . $message->sender_id;

        if ($userKey !== $messageSenderKey) {
            return response()->json([
                'message' => 'You cannot edit a message sent by someone else.',
                'code' => 'UNAUTHORIZED_SENDER',
            ], 403);
        }

        // Check ticket status for closed or archived state
        try {
            $ticketRecord = \Illuminate\Support\Facades\DB::connection('mysql')
                ->table('tickets')
                ->where('ticket_ID', (int)$ticket_id)
                ->first();

            if ($ticketRecord && (int)$ticketRecord->ticket_status_ID === 4) {
                return response()->json([
                    'message' => 'This conversation is archived because the ticket has been closed. Messages cannot be edited.',
                    'code' => 'CONVERSATION_ARCHIVED',
                ], 403);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Error checking ticket status in message update: ' . $e->getMessage());
        }

        // Enforce configured edit-time window
        $editWindowMinutes = (int) env('MESSAGE_EDIT_WINDOW_MINUTES', 15);
        try {
            $configRow = \Illuminate\Support\Facades\DB::connection('mysql')
                ->table('ticket_configurations')
                ->where('key', 'windows')
                ->value('value');
            if ($configRow) {
                $parsed = is_string($configRow) ? json_decode($configRow, true) : $configRow;
                if (is_array($parsed)) {
                    if (isset($parsed['messageEditWindowMinutes'])) {
                        $editWindowMinutes = (int)$parsed['messageEditWindowMinutes'];
                    } elseif (isset($parsed['message_edit_window_minutes'])) {
                        $editWindowMinutes = (int)$parsed['message_edit_window_minutes'];
                    }
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Error checking edit window config: ' . $e->getMessage());
        }

        if ($editWindowMinutes > 0 && !empty($message->created_at)) {
            $createdAt = \Illuminate\Support\Carbon::parse($message->created_at);
            $expiresAt = $createdAt->copy()->addMinutes($editWindowMinutes);
            if (now()->greaterThan($expiresAt)) {
                return response()->json([
                    'message' => "The edit window for this message has expired. Messages can only be edited within {$editWindowMinutes} minutes of sending.",
                    'code' => 'EDIT_WINDOW_EXPIRED',
                    'edit_window_minutes' => $editWindowMinutes,
                    'sent_at' => $createdAt->toIso8601String(),
                    'expired_at' => $expiresAt->toIso8601String(),
                ], 422);
            }
        }

        $priorContent = $message->message;
        $editedAt = now()->toIso8601String();
        $editorName = $this->resolveUserName($user);

        // Store version in edit_history (never destructively overwrite prior versions)
        $history = $message->edit_history ?? [];
        $versionNumber = count($history) + 1;

        $history[] = [
            'version' => $versionNumber,
            'message' => $priorContent,
            'edited_at' => $editedAt,
            'edited_by' => $userKey,
            'editor_name' => $editorName,
        ];

        // Ensure original created_at timestamp is preserved unchanged for thread chronological ordering
        $originalCreatedAt = $message->created_at;

        $message->edit_history = $history;
        $message->message = $newMessage;
        $message->is_edited = true;
        $message->edited = true;
        $message->edited_at = $editedAt;
        $message->created_at = $originalCreatedAt;

        try {
            $message->save();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to save edited message: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to save message edit. Please try again.',
                'code' => 'SAVE_FAILED',
                'error' => $e->getMessage(),
            ], 500);
        }

        // Audit Logging (Log traceability & MySQL ticket_audit_logs)
        \Illuminate\Support\Facades\Log::info('Message edited for audit traceability', [
            'ticket_id' => (int)$ticket_id,
            'message_id' => (string)($message->id ?? $message->_id),
            'editor_key' => $userKey,
            'editor_name' => $editorName,
            'edited_at' => $editedAt,
            'prior_content' => $priorContent,
            'new_content' => $newMessage,
            'version' => $versionNumber,
        ]);

        try {
            $actorType = ($user instanceof \App\Models\Employee) ? 'employee' : 'client';
            $actionById = ($user instanceof \App\Models\Employee) ? (int)$user->emp_id : (int)$user->id;
            \Illuminate\Support\Facades\DB::connection('mysql')
                ->table('ticket_audit_logs')
                ->insert([
                    'ticket_ID' => (int)$ticket_id,
                    'action_type' => 'message_edit',
                    'action_by_ID' => $actionById,
                    'actor_type' => $actorType,
                    'details' => json_encode([
                        'message_id' => (string)($message->id ?? $message->_id),
                        'editor' => $editorName,
                        'editor_key' => $userKey,
                        'edited_at' => $editedAt,
                        'prior_content' => $priorContent,
                        'new_content' => $newMessage,
                        'version' => $versionNumber,
                    ]),
                    'created_at' => now(),
                ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to record message_edit in ticket_audit_logs: ' . $e->getMessage());
        }

        // Broadcast to Reverb (port 6002) for real-time update to participants without triggering "new message" notifications
        broadcast(new MessageUpdated($message))->toOthers();

        return response()->json([
            'message' => 'Message updated successfully',
            'data' => $message,
        ]);
    }

    /**
     * Retrieve the edit history of a message.
     */
    public function history(Request $request, $ticket_id, $message_id)
    {
        $user = Auth::user();
        if (!$user && ($request->input('user_id') || $request->header('X-User-Id'))) {
            $fallbackId = $request->input('user_id') ?: $request->header('X-User-Id');
            $fallbackType = $request->input('user_type') ?: $request->header('X-User-Type', 'customer');
            $fallbackName = $request->input('user_name') ?: $request->header('X-User-Name', 'User');
            $user = new \Illuminate\Auth\GenericUser([
                'id' => $fallbackId,
                'name' => $fallbackName,
                'user_type' => $fallbackType,
            ]);
        }

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $message = Message::whereIn('ticket_id', [(int)$ticket_id, (string)$ticket_id])->find($message_id);
        if (!$message) {
            return response()->json(['message' => 'Message not found'], 404);
        }

        $history = $message->edit_history ?? [];

        return response()->json([
            'message_id' => (string)($message->id ?? $message->_id),
            'ticket_id' => (int)$ticket_id,
            'original_sent_at' => $message->created_at ? \Illuminate\Support\Carbon::parse($message->created_at)->toIso8601String() : null,
            'is_edited' => (bool)($message->is_edited ?? $message->edited ?? (!empty($history))),
            'edited_at' => $message->edited_at ?? null,
            'current_content' => $message->message,
            'versions_count' => count($history) + 1,
            'edit_count' => count($history),
            'edit_history' => $history,
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

        $message = Message::whereIn('ticket_id', [(int)$ticket_id, (string)$ticket_id])->find($message_id);
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
        } elseif ($user instanceof \Illuminate\Auth\GenericUser && isset($user->user_type)) {
            $senderId = $user->id;
            $senderType = $user->user_type;
        } else {
            $senderId = $user->id;
            $senderType = 'customer';
        }
        return $senderType . ':' . $senderId;
    }

    /**
     * Helper to resolve the display name for a user.
     */
    protected function resolveUserName($user)
    {
        if ($user instanceof \App\Models\Employee) {
            return trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''));
        } elseif ($user instanceof \App\Models\Client) {
            return $user->client_name ?? 'Client';
        }
        return $user->name ?? 'User';
    }
}
