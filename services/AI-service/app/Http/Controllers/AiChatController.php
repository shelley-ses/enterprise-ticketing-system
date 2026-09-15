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

        // Call Gemini Service
        $result = $this->geminiService->generateResponse($incomingMessages, $convId);

        // Retrieve or initialize conversation record and persist
        try {
            $conversation = AiConversation::find($convId);
            if (!$conversation) {
                $title = $this->extractMeaningfulTitle($incomingMessages);

                $conversation = new AiConversation([
                    'id' => $convId,
                    'user_id' => $userId,
                    'title' => $title,
                    'status' => 'active',
                    'messages' => [],
                ]);
            } elseif ($conversation->title === 'Support Inquiry' || $this->isGreetingOnly($conversation->title)) {
                $updatedTitle = $this->extractMeaningfulTitle($incomingMessages);
                if ($updatedTitle !== 'Support Inquiry') {
                    $conversation->title = $updatedTitle;
                }
            }

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
                if (!empty($result['ticket_data']['title']) && ($conversation->title === 'Support Inquiry' || $this->isGreetingOnly($conversation->title))) {
                    $conversation->title = $result['ticket_data']['title'];
                }
            }

            $conversation->save();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to save AI conversation: ' . $e->getMessage());
        }

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
            ->get()
            ->map(function ($c) {
                $cleaned = preg_replace('/^(?:\d+[\.\)\-:]|\b[qQ]\d+[:\.]|\b(?:machine|problem|issue|item)[:\-])\s*/i', '', $c->title ?? '');
                $cleaned = trim($cleaned);
                if (!empty($cleaned) && $cleaned !== $c->title) {
                    $c->title = ucfirst($cleaned);
                    $c->save();
                }
                return $c;
            });

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
     * Updates conversation status to ticket_created.
     */
    public function createTicket(Request $request)
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

    /**
     * Extract a meaningful title from user messages, ignoring pure greetings.
     */
    protected function extractMeaningfulTitle(array $messages): string
    {
        $greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'good day', 'greetings', 'help', 'test', 'support', 'hi there', 'hello there',
            'ok', 'okay', 'yes', 'no', 'thanks', 'thank you', 'please help'
        ];

        foreach ($messages as $m) {
            if (($m['role'] ?? '') === 'user' && !empty($m['content'])) {
                $trimmed = trim($m['content']);
                $lower = strtolower($trimmed);
                $cleaned = trim(preg_replace('/[^\w\s]/', '', $lower));

                if (in_array($cleaned, $greetings, true)) {
                    continue;
                }

                foreach ($greetings as $g) {
                    if (str_starts_with($cleaned, $g . ' ')) {
                        $trimmed = trim(substr($trimmed, strlen($g)));
                        $trimmed = ltrim($trimmed, " ,.!?-");
                        break;
                    }
                }

                // Strip question numbers like "1.", "1)", "1 -", "Q1:", "Machine:"
                $trimmed = preg_replace('/^(?:\d+[\.\)\-:]|\b[qQ]\d+[:\.]|\b(?:machine|problem|issue|item)[:\-])\s*/i', '', $trimmed);
                $trimmed = trim($trimmed);

                if (!empty($trimmed) && mb_strlen($trimmed) >= 3) {
                    return ucfirst(mb_substr($trimmed, 0, 55)) . (mb_strlen($trimmed) > 55 ? '...' : '');
                }
            }
        }

        return 'Support Inquiry';
    }

    /**
     * Check if a given title consists purely of greetings.
     */
    protected function isGreetingOnly(string $title): bool
    {
        $greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'good day', 'greetings', 'help', 'test', 'support', 'hi there', 'hello there'
        ];
        $cleaned = trim(preg_replace('/[^\w\s]/', '', strtolower($title)));
        return in_array($cleaned, $greetings, true);
    }
}
