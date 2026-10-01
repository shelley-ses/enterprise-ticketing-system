<?php

namespace App\Services;

use App\Events\TicketChanged;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TicketConfigurationService
{
    /**
     * Operational baseline defaults.
     */
    public const DEFAULT_WINDOWS = [
        'reopenEnabled' => true,
        'reopenWindowDays' => 2,
        'autoCloseEnabled' => true,
        'autoCloseWindowDays' => 2,
    ];

    /**
     * Retrieve the active ticket reopen & auto-close windows configuration.
     * Caches in Redis for performance with non-blocking fallback to configuration-service.
     */
    public static function getWindowConfig(): array
    {
        try {
            return Cache::remember('ticket:config:windows', 300, function () {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $response = Http::timeout(3)->get("{$configUrl}/api/ticket-configurations/windows");

                if ($response->successful()) {
                    $json = $response->json();
                    $val = $json['value'] ?? $json;

                    return [
                        'reopenEnabled' => (bool) ($val['reopenEnabled'] ?? true),
                        'reopenWindowDays' => (int) ($val['reopenWindowDays'] ?? 2),
                        'autoCloseEnabled' => (bool) ($val['autoCloseEnabled'] ?? true),
                        'autoCloseWindowDays' => (int) ($val['autoCloseWindowDays'] ?? 2),
                    ];
                }

                return self::DEFAULT_WINDOWS;
            });
        } catch (\Throwable $e) {
            Log::warning('Failed to fetch window configuration from configuration-service: ' . $e->getMessage());
            return self::DEFAULT_WINDOWS;
        }
    }

    /**
     * Clear the Redis cached window configuration.
     */
    public static function clearCache(): void
    {
        try {
            Cache::forget('ticket:config:windows');
        } catch (\Throwable $e) {
            Log::warning('Failed to clear ticket window cache: ' . $e->getMessage());
        }
    }

    /**
     * Forward window configuration updates to configuration-service.
     */
    public static function updateWindowConfig(array $payload, $user = null): array
    {
        $headers = [
            'Accept' => 'application/json',
            'X-Internal-Call' => 'ticket-service',
        ];
        if ($user) {
            $headers['X-User-Id'] = (string) ($user->emp_id ?? $user->id ?? '');
            $headers['X-User-Role'] = (string) ($user->role ?? 'superadmin');
        }

        $response = Http::timeout(5)
            ->withHeaders($headers)
            ->put("{$configUrl}/api/ticket-configurations/windows", $payload);

        if (!$response->successful()) {
            $errorData = $response->json();
            throw new \InvalidArgumentException($errorData['message'] ?? 'Failed to update window configuration.');
        }

        self::clearCache();

        $updated = self::getWindowConfig();

        // Dispatch Reverb event for real-time subscribers
        try {
            event(new TicketChanged([
                'type' => 'config',
                'section' => 'windows',
                'data' => $updated,
            ]));
        } catch (\Throwable $e) {
            Log::warning('Broadcasting TicketChanged failed: ' . $e->getMessage());
        }

        return $updated;
    }
}
