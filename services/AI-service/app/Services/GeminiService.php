<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiService
{
    protected string $apiKey;
    protected string $model;
    protected string $baseUrl;
    protected RagService $ragService;

    public function __construct(?RagService $ragService = null)
    {
        $this->apiKey = config('services.gemini.api_key') ?? env('GEMINI_API_KEY', '');
        $this->model = config('services.gemini.model') ?? env('GEMINI_MODEL', 'gemini-3.5-flash-lite');
        $this->baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        $this->ragService = $ragService ?? app(RagService::class);
    }

    /**
     * Generate support response from Google Gemini with grounded RAG on published articles
     * and automatic fallback to ticket creation when no published articles match.
     *
     * @param array $messages Array of {role: string, content: string}
     * @param string|null $conversationId
     * @return array {content: string, escalate: bool, ticket_data: array|null, rag_matched: bool, rag_sources: array}
     */
    public function generateResponse(array $messages, ?string $conversationId = null): array
    {
        $requestStartTime = hrtime(true);

        // 1. Extract the latest customer query
        $lastUserQuery = '';
        foreach (array_reverse($messages) as $m) {
            if (($m['role'] ?? '') === 'user' && !empty($m['content'])) {
                $lastUserQuery = trim($m['content']);
                break;
            }
        }

        $isGreeting = $this->isGreetingOnly($lastUserQuery);

        // 2. Perform RAG retrieval strictly over Published articles
        $ragResult = [
            'chunks' => [],
            'duration_ms' => 0.0,
            'matched' => false,
        ];

        if (!empty($lastUserQuery) && !$isGreeting) {
            $ragResult = $this->ragService->retrieve($lastUserQuery, 3, 0.40);

            // =========================================================================
            // FALLBACK PATH: No Published article matched customer query
            // =========================================================================
            if (!$ragResult['matched']) {
                $title = $this->deriveTitleFromMessages($messages);
                Log::info('RAG query yielded no published matches. Triggering ticket creation fallback path.', [
                    'query' => $lastUserQuery,
                    'derived_title' => $title,
                    'rag_duration_ms' => $ragResult['duration_ms'],
                ]);

                $replyText = "I searched our approved Knowledge Base and official documentation, but could not find any published articles or procedures matching your specific issue.\n\nTo ensure you receive accurate, manufacturer-approved technical assistance, I have prepared a support ticket request so our certified technical engineering team can inspect and resolve this for you directly.";
                return [
                    'content' => $replyText,
                    'reply' => $replyText,
                    'escalate' => true,
                    'is_fallback' => true,
                    'fallback' => true,
                    'ticket_data' => [
                        'title' => $title,
                        'description' => !empty($lastUserQuery) ? $lastUserQuery : 'Customer inquiry required technical assistance beyond published documentation.',
                    ],
                    'ticket_title' => $title,
                    'ticket_description' => !empty($lastUserQuery) ? $lastUserQuery : 'Customer inquiry required technical assistance beyond published documentation.',
                    'rag_matched' => false,
                    'rag_sources' => [],
                    'rag_duration_ms' => $ragResult['duration_ms'],
                    'total_duration_ms' => round((hrtime(true) - $requestStartTime) / 1e6, 2),
                ];
            }
        }

        // 3. Fallback to manual if Gemini API key is missing
        if (empty($this->apiKey)) {
            Log::warning('GEMINI_API_KEY is not configured in services.gemini. Falling back to manual ticket creation.');
            return $this->fallbackToManual($messages, 'AI assistant is not configured with an API key.');
        }

        try {
            $url = "{$this->baseUrl}/{$this->model}:generateContent?key={$this->apiKey}";

            // 4. Construct System Instruction with Published Article Sources Grounding
            $systemInstruction = "You are an expert enterprise technical support AI assistant for an industrial, equipment, and IT ticketing platform. " .
                "Your objective is to guide customers through clear, step-by-step diagnostic and troubleshooting actions for their machines, hardware, or software problems.\n\n" .
                "Key Guidelines:\n" .
                "1. Keep troubleshooting steps concise and direct (maximum 3 to 4 short bullet points, under 150 words total). Avoid unnecessary filler text.\n" .
                "2. Base your guidance strictly on the approved published documentation provided below. Never invent, hallucinate, or reference draft or archived procedures.\n" .
                "3. If the user indicates that basic troubleshooting failed, or if the issue involves dangerous high-voltage electrical, jammed heavy machinery, broken hardware, or requires an on-site technician dispatch, you MUST recommend escalating to a support ticket.\n" .
                "4. When escalating, append a structured JSON block at the very end of your response exactly like this:\n" .
                "```json\n" .
                "{\n" .
                '  "escalate": true,' . "\n" .
                '  "ticket_title": "Concise natural summary of the problem (e.g. CGI Machine Paper Jam Error, NEVER include numbers or bullets like 1. or 2.)",' . "\n" .
                '  "ticket_description": "Detailed summary of the problem and troubleshooting attempted"' . "\n" .
                "}\n" .
                "```";

            if (!empty($ragResult['chunks'])) {
                $systemInstruction .= "\n\n=== APPROVED PUBLISHED KNOWLEDGE BASE SOURCES ===\n";
                foreach ($ragResult['chunks'] as $idx => $chunk) {
                    $num = $idx + 1;
                    $systemInstruction .= "Source {$num}: [{$chunk['article_title']} | {$chunk['article_category']}" . (!empty($chunk['article_machine']) ? " | {$chunk['article_machine']}" : "") . "]\n" .
                        $chunk['content'] . "\n\n";
                }
                $systemInstruction .= "=== END APPROVED SOURCES ===\n";
                $systemInstruction .= "INSTRUCTION: Directly cite or summarize the approved steps from the sources above to resolve the user's issue.";
            }

            // Limit conversation window to latest 8 messages to prevent latency degradation in long chats
            $recentMessages = count($messages) > 8 ? array_slice($messages, -8) : $messages;

            // Format contents for Gemini API (roles: 'user' and 'model')
            $contents = [];
            foreach ($recentMessages as $msg) {
                $role = ($msg['role'] === 'assistant' || $msg['role'] === 'ai' || $msg['role'] === 'model') ? 'model' : 'user';
                $text = is_string($msg['content'] ?? null) ? trim($msg['content']) : '';
                if (!empty($text)) {
                    $contents[] = [
                        'role' => $role,
                        'parts' => [
                            ['text' => $text]
                        ]
                    ];
                }
            }

            if (empty($contents)) {
                $contents[] = [
                    'role' => 'user',
                    'parts' => [['text' => 'Hello, I need assistance with an equipment issue.']]
                ];
            }

            $payload = [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $systemInstruction]
                    ]
                ],
                'contents' => $contents,
                'generationConfig' => [
                    'temperature' => 0.2,
                    'maxOutputTokens' => 600,
                ]
            ];

            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
            ])->timeout(8)->post($url, $payload);

            if (!$response->successful()) {
                Log::error('Gemini API request failed', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                return $this->fallbackToManual($messages, 'Gemini API returned error: ' . $response->status());
            }

            $responseData = $response->json();
            $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? '';

            if (empty($rawText)) {
                return $this->fallbackToManual($messages, 'Empty response from Gemini.');
            }

            $totalDurationMs = round((hrtime(true) - $requestStartTime) / 1e6, 2);

            // Latency target audit: verify total request time is under 5 seconds (5000ms)
            if ($totalDurationMs > 5000.0) {
                Log::warning('Chatbot response exceeded 5-second target threshold', [
                    'total_duration_ms' => $totalDurationMs,
                    'rag_duration_ms' => $ragResult['duration_ms'],
                ]);
            } else {
                Log::info('Chatbot response delivered within 5-second target', [
                    'total_duration_ms' => $totalDurationMs,
                    'rag_duration_ms' => $ragResult['duration_ms'],
                ]);
            }

            $parsed = $this->parseResponse($rawText, $messages);
            $parsed['rag_matched'] = $ragResult['matched'];
            $parsed['rag_sources'] = array_map(fn ($c) => [
                'title' => $c['article_title'],
                'category' => $c['article_category'],
                'machine' => $c['article_machine'],
                'score' => $c['score'],
            ], $ragResult['chunks']);
            $parsed['rag_duration_ms'] = $ragResult['duration_ms'];
            $parsed['total_duration_ms'] = $totalDurationMs;

            return $parsed;

        } catch (\Throwable $e) {
            Log::error('GeminiService exception: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fallbackToManual($messages, $e->getMessage());
        }
    }

    /**
     * Parse Gemini response for escalation JSON or explicit escalation keywords.
     */
    protected function parseResponse(string $rawText, array $messages): array
    {
        $escalate = false;
        $ticketData = null;
        $cleanText = $rawText;

        // Check for JSON escalation block: ```json { "escalate": true ... } ```
        if (preg_match('/```json\s*(\{.*?\"escalate\"\s*:\s*true.*?\})\s*```/s', $rawText, $matches)) {
            $escalate = true;
            $jsonStr = $matches[1];
            $cleanText = trim(str_replace($matches[0], '', $rawText));

            $parsed = json_decode($jsonStr, true);
            if (json_last_error() === JSON_ERROR_NONE && !empty($parsed)) {
                $rawTitle = $parsed['ticket_title'] ?? '';
                $cleanTitle = preg_replace('/^(?:\d+[\.\)\-:]|\b[qQ]\d+[:\.]|\b(?:machine|problem|issue|item)[:\-])\s*/i', '', $rawTitle);
                $cleanTitle = trim($cleanTitle);
                $ticketData = [
                    'title' => !empty($cleanTitle) ? ucfirst($cleanTitle) : $this->deriveTitleFromMessages($messages),
                    'description' => $parsed['ticket_description'] ?? 'Submitted via AI Support Assistant.',
                ];
            }
        } else {
            // Fallback keyword check for escalation
            $lower = strtolower($rawText);
            if (
                str_contains($lower, 'create a support ticket') ||
                str_contains($lower, 'open a ticket') ||
                str_contains($lower, 'technician will need to inspect') ||
                str_contains($lower, 'dispatch a technician')
            ) {
                $escalate = true;
                $ticketData = [
                    'title' => $this->deriveTitleFromMessages($messages),
                    'description' => 'Automated troubleshooting suggested technician dispatch for this issue.',
                ];
            }
        }

        return [
            'content' => $cleanText,
            'escalate' => $escalate,
            'ticket_data' => $ticketData,
        ];
    }

    /**
     * Graceful fallback when Gemini is unavailable.
     */
    protected function fallbackToManual(array $messages, string $reason): array
    {
        $lastUserMsg = '';
        foreach (array_reverse($messages) as $m) {
            if (($m['role'] ?? '') === 'user' && !empty($m['content'])) {
                $lastUserMsg = $m['content'];
                break;
            }
        }

        $cleanedMsg = preg_replace('/^(?:\d+[\.\)\-:]|\b[qQ]\d+[:\.]|\b(?:machine|problem|issue|item)[:\-])\s*/i', '', $lastUserMsg);
        $title = !empty($cleanedMsg) ? ucfirst(mb_substr(trim($cleanedMsg), 0, 60)) : 'Technical Support Request';

        $replyText = "Our automated AI support assistant is temporarily unavailable. " .
            "Please proceed to create a support ticket directly below, and our technical engineering team will review and resolve your issue shortly.";

        return [
            'content' => $replyText,
            'reply' => $replyText,
            'escalate' => true,
            'is_fallback' => true,
            'ticket_data' => [
                'title' => $title,
                'description' => !empty($lastUserMsg) ? $lastUserMsg : 'Submitted via manual support ticket.',
            ],
            'ticket_title' => $title,
            'ticket_description' => !empty($lastUserMsg) ? $lastUserMsg : 'Submitted via manual support ticket.',
            'fallback' => true,
            'reason' => $reason,
            'rag_matched' => false,
            'rag_sources' => [],
        ];
    }

    /**
     * Derive a concise title from the user messages, ignoring pure greetings.
     */
    protected function deriveTitleFromMessages(array $messages): string
    {
        $greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'good day', 'greetings', 'help', 'test', 'support', 'hi there', 'hello there',
            'ok', 'okay', 'yes', 'no', 'thanks', 'thank you', 'please help'
        ];

        foreach ($messages as $m) {
            if (($m['role'] ?? '') === 'user' && !empty($m['content'])) {
                $content = trim($m['content']);
                $cleaned = trim(preg_replace('/[^\w\s]/', '', strtolower($content)));

                if (in_array($cleaned, $greetings, true)) {
                    continue;
                }

                foreach ($greetings as $g) {
                    if (str_starts_with($cleaned, $g . ' ')) {
                        $content = trim(substr($content, strlen($g)));
                        $content = ltrim($content, " ,.!?-");
                        break;
                    }
                }

                // Strip question numbers like "1.", "1)", "1 -", "Q1:", "Machine:"
                $content = preg_replace('/^(?:\d+[\.\)\-:]|\b[qQ]\d+[:\.]|\b(?:machine|problem|issue|item)[:\-])\s*/i', '', $content);
                $content = trim($content);

                if (!empty($content) && mb_strlen($content) >= 3) {
                    $cleanedTitle = mb_substr($content, 0, 60);
                    return ucfirst($cleanedTitle);
                }
            }
        }
        return 'Equipment Technical Support Request';
    }

    public function isGreetingOnly(string $text): bool
    {
        $greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'good day', 'greetings', 'help', 'test', 'support', 'hi there', 'hello there'
        ];
        $cleaned = trim(preg_replace('/[^\w\s]/', '', strtolower($text)));
        return in_array($cleaned, $greetings, true);
    }
}
