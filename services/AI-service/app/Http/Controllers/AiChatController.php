<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\AiConversation;
use App\Services\GeminiService;

class AiChatController extends Controller
{
    protected GeminiService $geminiService;

    public function __construct(GeminiService $geminiService)
    {
        $this->geminiService = $geminiService;
    }

    /**
     * POST /api/chat
     * Handles conversation chat with Google Gemini.
     */
    public function chat(Request $request)
    {
        $validated = $request->validate([
            'messages' => 'required|array',
            'conversation_id' => 'nullable|string',
            'user_id' => 'nullable|numeric',
        ]);

        $convId = $validated['conversation_id'] ?? Str::uuid()->toString();
        $userId = $validated['user_id'] ?? null;
        $incomingMessages = $validated['messages'];

        // Retrieve or initialize conversation record
        $conversation = AiConversation::find($convId);
        if (!$conversation) {
            $title = 'Support Inquiry';
            foreach ($incomingMessages as $m) {
                if (($m['role'] ?? '') === 'user' && !empty($m['content'])) {
                    $title = mb_substr(trim($m['content']), 0, 50);
                    break;
                }
            }

            $conversation = new AiConversation([
                'id' => $convId,
                'user_id' => $userId,
                'title' => $title,
                'status' => 'active',
                'messages' => [],
            ]);
        }

        // Call Gemini Service
        $result = $this->geminiService->generateResponse($incomingMessages, $convId);

        // Append latest exchange
        $aiTimestamp = now()->toIso8601String();
        $aiMsgRecord = [
            'id' => 'ai-' . round(microtime(true) * 1000),
            'role' => 'ai',
            'content' => $result['content'],
            'timestamp' => $aiTimestamp,
        ];

        $allMessages = array_merge($incomingMessages, [$aiMsgRecord]);
        $conversation->messages = $allMessages;

        if ($result['escalate']) {
            $conversation->status = 'escalated';
            $conversation->escalation_data = $result['ticket_data'];
        }

        $conversation->save();

        return response()->json([
            'success' => true,
            'content' => $result['content'],
            'escalate' => $result['escalate'],
            'ticket_data' => $result['ticket_data'],
            'conversation_id' => $convId,
            'is_duplicate' => false,
        ]);
    }

    /**
     * GET /api/conversations
     * Returns conversations list for a user.
     */
    public function conversations(Request $request)
    {
        $userId = $request->query('user_id');

        $query = AiConversation::query();
        if ($userId) {
            $query->where('user_id', $userId);
        }

        $conversations = $query->orderBy('updated_at', 'desc')
            ->select(['id', 'user_id', 'title', 'status', 'created_at', 'updated_at'])
            ->get();

        return response()->json([
            'success' => true,
            'conversations' => $conversations,
        ]);
    }

    /**
     * GET /api/conversations/{id}
     * Returns full conversation details and message history.
     */
    public function showConversation(string $id)
    {
        $conversation = AiConversation::find($id);

        if (!$conversation) {
            return response()->json([
                'success' => false,
                'message' => 'Conversation not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'conversation' => $conversation,
        ]);
    }

    /**
     * DELETE /api/conversations/{id}
     * Deletes a conversation record.
     */
    public function deleteConversation(string $id)
    {
        $conversation = AiConversation::find($id);

        if ($conversation) {
            $conversation->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Conversation deleted successfully',
        ]);
    }

    /**
     * POST /api/tickets
     * Marks conversation as ticket_created when submitted.
     */
    public function markTicketCreated(Request $request)
    {
        $convId = $request->input('conversation_id');

        if ($convId) {
            $conversation = AiConversation::find($convId);
            if ($conversation) {
                $conversation->status = 'ticket_created';
                $conversation->save();
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Ticket created link confirmed',
        ]);
    }
}
