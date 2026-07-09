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

        // Prevent CS agent from messaging on a ticket they created
        if ($senderType === 'cs') {
            $ticket = \Illuminate\Support\Facades\DB::connection('mysql')
                ->table('tickets')
                ->where('ticket_ID', (int)$ticket_id)
                ->first();

            if ($ticket && (int)$ticket->requested_by === (int)$senderId) {
                return response()->json(['message' => 'You cannot message on a ticket you created.'], 403);
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

        // Broadcast to Reverb
        broadcast(new MessageSent($message))->toOthers();

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
