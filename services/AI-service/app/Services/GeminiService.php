<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiService
{
    protected string $apiKey;
    protected string $model;
    protected string $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.api_key') ?? env('GEMINI_API_KEY', '');
        $this->model = config('services.gemini.model') ?? env('GEMINI_MODEL', 'gemini-2.0-flash');
        $this->baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    /**
     * Generate support response from Google Gemini with graceful manual fallback.
     *
     * @param array $messages Array of {role: string, content: string}
     * @param string|null $conversationId
     * @return array {content: string, escalate: bool, ticket_data: array|null}
     */
    public function generateResponse(array $messages, ?string $conversationId = null): array
    {
        if (empty($this->apiKey)) {
            Log::warning('GEMINI_API_KEY is not configured in services.gemini. Falling back to manual ticket creation.');
            return $this->fallbackToManual($messages, 'AI assistant is not configured with an API key.');
        }

        try {
            $url = "{$this->baseUrl}/{$this->model}:generateContent?key={$this->apiKey}";

            $systemInstruction = "You are an expert enterprise technical support AI assistant for an industrial, equipment, and IT ticketing platform. " .
                "Your objective is to guide customers through clear, step-by-step diagnostic and troubleshooting actions for their machines, hardware, or software problems.\n\n" .
                "Key Guidelines:\n" .
                "1. Keep responses clear, concise, and formatted using clean markdown (bullet points, bold highlights).\n" .
                "2. If the user indicates that basic troubleshooting failed, or if the issue involves dangerous high-voltage electrical, jammed heavy machinery, broken hardware, or requires an on-site technician dispatch, you MUST recommend escalating to a support ticket.\n" .
                "3. When escalating, append a structured JSON block at the very end of your response exactly like this:\n" .
                "```json\n" .
                "{\n" .
                '  "escalate": true,' . "\n" .
                '  "ticket_title": "Concise summary of the issue",' . "\n" .
                '  "ticket_description": "Detailed summary of the problem and troubleshooting attempted"' . "\n" .
                "}\n" .
                "```";

            // Format contents for Gemini API (roles: 'user' and 'model')
            $contents = [];
            foreach ($messages as $msg) {
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
                    'temperature' => 0.4,
                    'maxOutputTokens' => 1024,
                ]
            ];

            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
            ])->timeout(25)->post($url, $payload);

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

            return $this->parseResponse($rawText, $messages);

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
                $ticketData = [
                    'title' => $parsed['ticket_title'] ?? $this->deriveTitleFromMessages($messages),
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

        $title = !empty($lastUserMsg) ? mb_substr($lastUserMsg, 0, 60) : 'Technical Support Request';

        return [
            'content' => "Our automated AI support assistant is temporarily unavailable. " .
                "Please proceed to create a support ticket directly below, and our technical engineering team will review and resolve your issue shortly.",
            'escalate' => true,
            'ticket_data' => [
                'title' => $title,
                'description' => !empty($lastUserMsg) ? $lastUserMsg : 'Submitted via manual support ticket.',
            ],
            'fallback' => true,
            'reason' => $reason,
        ];
    }

    /**
     * Derive a concise title from the initial user messages.
     */
    protected function deriveTitleFromMessages(array $messages): string
    {
        foreach ($messages as $m) {
            if (($m['role'] ?? '') === 'user' && !empty($m['content'])) {
                $content = trim($m['content']);
                return mb_substr($content, 0, 60) . (mb_strlen($content) > 60 ? '...' : '');
            }
        }
        return 'Equipment Technical Support Request';
    }
}
