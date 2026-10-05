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
     * Resolves the authenticated user or verifies internal microservice tokens.
     */
    protected function getAuthenticatedUser(Request $request): ?object
    {
        // 1. Check Passport / Default Auth Guard
        $user = auth('api')->user() ?? $request->user();
        if ($user) {
            return $user;
        }

        // 2. Check trusted internal microservice token
        $internalToken = $request->header('X-Internal-Token');
        $expectedToken = env('INTERNAL_TOKEN');
        if (!empty($internalToken) && !empty($expectedToken) && hash_equals((string) $expectedToken, (string) $internalToken)) {
            return (object) ['is_internal' => true];
        }

        // 3. Fallback: check query parameter or body user_id for customer requests
        $requestedUserId = $request->input('user_id') ?? $request->query('user_id');
        if (!empty($requestedUserId)) {
            return (object) ['id' => $requestedUserId, 'is_fallback' => true];
        }

        return null;
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

        $auth = $this->getAuthenticatedUser($request);
        if (!$auth) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $isInternal = isset($auth->is_internal) && $auth->is_internal;
        $userId = $isInternal ? ($validated['user_id'] ?? null) : ($auth->id ?? $auth->emp_id ?? $auth->getAuthIdentifier());

        $convId = $validated['conversation_id'] ?? Str::uuid()->toString();
        $incomingMessages = $validated['messages'];

        // Retrieve or initialize conversation record and verify ownership
        $conversation = AiConversation::find($convId);
        if ($conversation && !$isInternal && $userId && !empty($conversation->user_id)) {
            if ((string) $conversation->user_id !== (string) $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Forbidden: Conversation belongs to another user',
                ], 403);
            }
        }

        // Call Gemini Service
        $result = $this->geminiService->generateResponse($incomingMessages, $convId);

        // Retrieve or initialize conversation record and persist
        try {
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
     * Returns conversations list for an authenticated user.
     */
    public function conversations(Request $request)
    {
        $auth = $this->getAuthenticatedUser($request);
        if (!$auth) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $isInternal = isset($auth->is_internal) && $auth->is_internal;
        $query = AiConversation::query();

        if ($isInternal) {
            if ($request->has('user_id')) {
                $query->where('user_id', $request->query('user_id'));
            }
        } else {
            $userId = $auth->id ?? $auth->emp_id ?? $auth->getAuthIdentifier();
            $query->where('user_id', $userId);
        }

        $conversations = $query->orderBy('updated_at', 'desc')
            ->select(['id', 'user_id', 'title', 'status', 'messages', 'created_at', 'updated_at'])
            ->get()
            ->map(function ($c) {
                $cleaned = preg_replace('/^(?:\d+[\.\)\-:]|\b[qQ]\d+[:\.]|\b(?:machine|problem|issue|item)[:\-])\s*/i', '', $c->title ?? '');
                $cleaned = trim($cleaned);
                if (!empty($cleaned) && $cleaned !== $c->title) {
                    $c->title = ucfirst($cleaned);
                    $c->save();
                }
                $c->message_count = is_array($c->messages) ? count($c->messages) : 0;
                unset($c->messages);
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
    public function showConversation(Request $request, string $id)
    {
        $auth = $this->getAuthenticatedUser($request);
        if (!$auth) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $conversation = AiConversation::find($id);

        if (!$conversation) {
            return response()->json([
                'success' => false,
                'message' => 'Conversation not found',
            ], 404);
        }

        $isInternal = isset($auth->is_internal) && $auth->is_internal;
        if (!$isInternal) {
            $userId = $auth->id ?? $auth->emp_id ?? $auth->getAuthIdentifier();
            if (!empty($conversation->user_id) && (string) $conversation->user_id !== (string) $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Forbidden: You do not have permission to view this conversation',
                ], 403);
            }
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
    public function deleteConversation(Request $request, string $id)
    {
        $auth = $this->getAuthenticatedUser($request);
        if (!$auth) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $conversation = AiConversation::find($id);

        if (!$conversation) {
            return response()->json([
                'success' => true,
                'message' => 'Conversation already deleted or not found',
            ]);
        }

        $isInternal = isset($auth->is_internal) && $auth->is_internal;
        if (!$isInternal) {
            $userId = $auth->id ?? $auth->emp_id ?? $auth->getAuthIdentifier() ?? $request->input('user_id') ?? $request->query('user_id');
            if (!empty($conversation->user_id) && $userId && (string) $conversation->user_id !== (string) $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Forbidden: You do not have permission to delete this conversation',
                ], 403);
            }
        }

        $conversation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Conversation deleted successfully',
        ]);
    }

    /**
     * DELETE /api/conversations/{id}/messages/{messageId}
     * Removes a specific message from a conversation's history.
     */
    public function deleteMessage(Request $request, string $id, string $messageId)
    {
        $auth = $this->getAuthenticatedUser($request);
        if (!$auth) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $conversation = AiConversation::find($id);
        if (!$conversation) {
            return response()->json([
                'success' => true,
                'message' => 'Conversation not found',
            ]);
        }

        $isInternal = isset($auth->is_internal) && $auth->is_internal;
        if (!$isInternal) {
            $userId = $auth->id ?? $auth->emp_id ?? $auth->getAuthIdentifier() ?? $request->input('user_id') ?? $request->query('user_id');
            if (!empty($conversation->user_id) && $userId && (string) $conversation->user_id !== (string) $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Forbidden: You do not have permission to modify this conversation',
                ], 403);
            }
        }

        $messages = is_array($conversation->messages) ? $conversation->messages : [];
        $updated = array_values(array_filter($messages, function ($m) use ($messageId) {
            $mId = $m['id'] ?? null;
            return (string) $mId !== (string) $messageId;
        }));

        $conversation->messages = $updated;
        $conversation->save();

        return response()->json([
            'success' => true,
            'message' => 'Message deleted successfully',
            'messages' => $updated,
        ]);
    }

    /**
     * POST /api/tickets
     * Updates conversation status to ticket_created.
     */
    public function createTicket(Request $request)
    {
        $auth = $this->getAuthenticatedUser($request);
        if (!$auth) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $convId = $request->input('conversation_id');
        if ($convId) {
            $conversation = AiConversation::find($convId);
            if ($conversation) {
                $isInternal = isset($auth->is_internal) && $auth->is_internal;
                if (!$isInternal) {
                    $userId = $auth->id ?? $auth->emp_id ?? $auth->getAuthIdentifier();
                    if (!empty($conversation->user_id) && (string) $conversation->user_id !== (string) $userId) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Forbidden: You do not have permission to update this conversation',
                        ], 403);
                    }
                }
                $conversation->status = 'ticket_created';
                $conversation->save();
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Ticket created link confirmed',
        ]);
    }

    public function markTicketCreated(Request $request)
    {
        return $this->createTicket($request);
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
