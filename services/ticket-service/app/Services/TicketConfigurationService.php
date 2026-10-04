<?php

namespace App\Services;

use App\Events\TicketChanged;
use App\Exceptions\TicketLimitConfigurationUnavailableException;
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

    public const DEFAULT_ROUTING = [
        'new_ticket' => ['role_cs'],
        'new_message' => ['contextual_assigned'],
        'overdue_ticket' => ['role_cs'],
    ];

    public const DEFAULT_LIMITS = [
        'isUnlimited' => true,
        'limit' => 5,
    ];

    private const LIMIT_CACHE_KEY = 'ticket:config:limits';

    private const LIMIT_LAST_KNOWN_GOOD_KEY = 'ticket:config:limits:last-known-good';

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

    private static function getInternalHeaders($user = null): array
    {
        $headers = [
            'Accept' => 'application/json',
            'X-Internal-Call' => 'ticket-service',
            'X-Internal-Token' => (string) env('INTERNAL_TOKEN', ''),
        ];
        if ($user) {
            $headers['X-User-Id'] = (string) ($user->emp_id ?? $user->id ?? '');
            $headers['X-User-Role'] = (string) ($user->role ?? 'superadmin');
        }
        return $headers;
    }

    /**
     * Forward window configuration updates to configuration-service.
     */
    public static function updateWindowConfig(array $payload, $user = null): array
    {
        $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
        $headers = self::getInternalHeaders($user);

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

    /**
     * Retrieve the max-open-ticket policy. Remote reads are bounded and happen
     * before requester locks. Failed reads use only a durable last-known-good
     * policy; without one, ticket creation fails closed.
     */
    public static function getLimitConfig(): array
    {
        try {
            $cached = Cache::get(self::LIMIT_CACHE_KEY);
            if (is_array($cached)) {
                return self::normalizeLimitConfig($cached);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to read cached ticket limit configuration: ' . $e->getMessage());
        }

        try {
            $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
            $response = Http::connectTimeout(1)
                ->timeout(1)
                ->get("{$configUrl}/api/ticket-configurations/limits");

            if ($response->successful()) {
                $json = $response->json();
                $value = is_array($json) ? ($json['value'] ?? $json) : null;
                if (!is_array($value)) {
                    throw new \UnexpectedValueException('Configuration service returned an invalid ticket limit policy.');
                }

                $config = self::normalizeLimitConfig($value);
                self::storeLimitConfig($config);

                return $config;
            }

            Log::warning("Failed to fetch ticket limit configuration: HTTP {$response->status()}.");
        } catch (\Throwable $e) {
            Log::warning('Failed to fetch ticket limit configuration: ' . $e->getMessage());
        }

        $lastKnownGood = self::getLastKnownGoodLimitConfig();
        if ($lastKnownGood !== null) {
            try {
                Cache::put(self::LIMIT_CACHE_KEY, $lastKnownGood, 300);
            } catch (\Throwable $e) {
                Log::warning('Failed to refresh cached ticket limit configuration: ' . $e->getMessage());
            }

            return $lastKnownGood;
        }

        throw new TicketLimitConfigurationUnavailableException();
    }

    public static function updateLimitConfig(array $payload, $user = null): array
    {
        return self::writeLimitConfig('put', $payload, $user);
    }

    public static function resetLimitConfig($user = null): array
    {
        return self::writeLimitConfig('post', null, $user);
    }

    private static function writeLimitConfig(string $method, ?array $payload, $user): array
    {
        $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
        $internalToken = (string) env('INTERNAL_TOKEN', '');
        if ($internalToken === '') {
            throw new \RuntimeException('Internal service authentication is not configured.');
        }

        $headers = [
            'Accept' => 'application/json',
            'X-Internal-Call' => 'ticket-service',
            'X-Internal-Token' => $internalToken,
        ];
        if ($user) {
            $headers['X-User-Id'] = (string) ($user->emp_id ?? $user->id ?? '');
        }

        $request = Http::connectTimeout(2)->timeout(5)->withHeaders($headers);
        $url = "{$configUrl}/api/ticket-configurations/limits" . ($method === 'post' ? '/reset' : '');
        $response = $method === 'post'
            ? $request->post($url)
            : $request->put($url, $payload ?? []);

        if (!$response->successful()) {
            throw new \InvalidArgumentException(
                $response->json('message') ?? 'Failed to update max open tickets configuration.'
            );
        }

        $updated = self::normalizeLimitConfig($response->json('value') ?? $response->json());
        self::storeLimitConfig($updated);

        return $updated;
    }

    private static function storeLimitConfig(array $config): void
    {
        try {
            Cache::put(self::LIMIT_CACHE_KEY, $config, 300);
            Cache::forever(self::LIMIT_LAST_KNOWN_GOOD_KEY, $config);
        } catch (\Throwable $e) {
            Log::warning('Failed to persist ticket limit configuration cache: ' . $e->getMessage());
        }
    }

    private static function getLastKnownGoodLimitConfig(): ?array
    {
        try {
            $config = Cache::get(self::LIMIT_LAST_KNOWN_GOOD_KEY);

            return is_array($config) ? self::normalizeLimitConfig($config) : null;
        } catch (\Throwable $e) {
            Log::warning('Failed to read last-known-good ticket limit configuration: ' . $e->getMessage());

            return null;
        }
    }

    private static function normalizeLimitConfig(array $config): array
    {
        $limit = filter_var($config['limit'] ?? null, FILTER_VALIDATE_INT);
        if (
            !array_key_exists('isUnlimited', $config)
            || !is_bool($config['isUnlimited'])
            || $limit === false
            || $limit < 1
            || $limit > 1000
        ) {
            throw new \UnexpectedValueException('Invalid max-open-ticket policy received from configuration service.');
        }

        return [
            'isUnlimited' => $config['isUnlimited'],
            'limit' => $limit,
        ];
    }

    /**
     * Retrieve active notification recipient routing.
     * Caches in Redis for performance with fallback to configuration-service.
     */
    public static function getRoutingConfig(): array
    {
        try {
            return Cache::remember('ticket:config:routing', 300, function () {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $response = Http::timeout(3)->get("{$configUrl}/api/ticket-configurations/routing");

                if ($response->successful()) {
                    $json = $response->json();
                    $val = $json['value'] ?? $json;

                    return [
                        'new_ticket' => is_array($val['new_ticket'] ?? null) && count($val['new_ticket']) > 0
                            ? $val['new_ticket']
                            : self::DEFAULT_ROUTING['new_ticket'],
                        'new_message' => is_array($val['new_message'] ?? null) && count($val['new_message']) > 0
                            ? $val['new_message']
                            : self::DEFAULT_ROUTING['new_message'],
                        'overdue_ticket' => is_array($val['overdue_ticket'] ?? null) && count($val['overdue_ticket']) > 0
                            ? $val['overdue_ticket']
                            : self::DEFAULT_ROUTING['overdue_ticket'],
                    ];
                }

                return self::DEFAULT_ROUTING;
            });
        } catch (\Throwable $e) {
            Log::warning('Failed to fetch recipient routing from configuration-service: ' . $e->getMessage());
            return self::DEFAULT_ROUTING;
        }
    }

    /**
     * Clear the Redis cached routing configuration.
     */
    public static function clearRoutingCache(): void
    {
        try {
            Cache::forget('ticket:config:routing');
        } catch (\Throwable $e) {
            Log::warning('Failed to clear ticket routing cache: ' . $e->getMessage());
        }
    }

    /**
     * Forward routing updates to configuration-service.
     */
    public static function updateRoutingConfig(array $payload, $user = null): array
    {
        $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
        $headers = self::getInternalHeaders($user);

        $response = Http::timeout(5)
            ->withHeaders($headers)
            ->put("{$configUrl}/api/ticket-configurations/routing", $payload);

        if (!$response->successful()) {
            $errorData = $response->json();
            $msg = $errorData['message'] ?? 'Failed to update recipient routing.';
            throw new \InvalidArgumentException($msg);
        }

        self::clearRoutingCache();

        $updated = self::getRoutingConfig();

        // Dispatch Reverb event for real-time subscribers
        try {
            event(new TicketChanged([
                'type' => 'config',
                'section' => 'routing',
                'data' => $updated,
            ]));
        } catch (\Throwable $e) {
            Log::warning('Broadcasting TicketChanged failed: ' . $e->getMessage());
        }

        return $updated;
    }

    /**
     * Reset recipient routing to defaults.
     */
    public static function resetRoutingConfig($user = null): array
    {
        $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
        $headers = self::getInternalHeaders($user);

        $response = Http::timeout(5)
            ->withHeaders($headers)
            ->post("{$configUrl}/api/ticket-configurations/routing/reset");

        self::clearRoutingCache();

        $defaults = self::DEFAULT_ROUTING;

        try {
            event(new TicketChanged([
                'type' => 'config',
                'section' => 'routing',
                'data' => $defaults,
            ]));
        } catch (\Throwable $e) {
            Log::warning('Broadcasting TicketChanged failed: ' . $e->getMessage());
        }

        return $defaults;
    }

    /**
     * Retrieve company information.
     */
    public static function getCompanyInfo(): array
    {
        try {
            return Cache::remember('ticket:config:company_info', 300, function () {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $response = Http::timeout(3)->get("{$configUrl}/api/ticket-configurations/company-info");
                if ($response->successful()) {
                    $json = $response->json();
                    return $json['value'] ?? $json;
                }
                return [];
            });
        } catch (\Throwable $e) {
            Log::warning('Failed fetching company info: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Update company information forwarding to configuration-service.
     */
    public static function updateCompanyInfo(array $payload, $user = null): array
    {
        $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
        $headers = self::getInternalHeaders($user);

        $response = Http::timeout(5)->withHeaders($headers)->put("{$configUrl}/api/ticket-configurations/company-info", $payload);
        if (!$response->successful()) {
            throw new \InvalidArgumentException($response->json('message') ?? 'Failed to update company info.');
        }

        Cache::forget('ticket:config:company_info');
        return $response->json('value') ?? $response->json();
    }

    /**
     * Retrieve system status.
     */
    public static function getSystemStatus(): string
    {
        try {
            return Cache::remember('ticket:config:system_status', 60, function () {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $response = Http::timeout(3)->get("{$configUrl}/api/ticket-configurations/system-status");
                if ($response->successful()) {
                    $json = $response->json();
                    return $json['status'] ?? $json['value']['status'] ?? 'Operational';
                }
                return 'Operational';
            });
        } catch (\Throwable $e) {
            Log::warning('Failed fetching system status: ' . $e->getMessage());
            return 'Operational';
        }
    }

    /**
     * Update system status forwarding to configuration-service.
     */
    public static function updateSystemStatus(string $status, $user = null): string
    {
        $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
        $headers = self::getInternalHeaders($user);

        $response = Http::timeout(5)->withHeaders($headers)->put("{$configUrl}/api/ticket-configurations/system-status", ['status' => $status]);
        if (!$response->successful()) {
            throw new \InvalidArgumentException($response->json('message') ?? 'Failed to update system status.');
        }

        Cache::forget('ticket:config:system_status');
        return $response->json('status') ?? $status;
    }

    /**
     * Retrieve log level.
     */
    public static function getLogLevel(): string
    {
        try {
            return Cache::remember('ticket:config:log_level', 60, function () {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $response = Http::timeout(3)->get("{$configUrl}/api/ticket-configurations/log-level");
                if ($response->successful()) {
                    $json = $response->json();
                    return $json['level'] ?? $json['value']['level'] ?? 'Info';
                }
                return 'Info';
            });
        } catch (\Throwable $e) {
            Log::warning('Failed fetching log level: ' . $e->getMessage());
            return 'Info';
        }
    }

    /**
     * Update log level forwarding to configuration-service.
     */
    public static function updateLogLevel(string $level, $user = null): string
    {
        $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
        $headers = self::getInternalHeaders($user);

        $response = Http::timeout(5)->withHeaders($headers)->put("{$configUrl}/api/ticket-configurations/log-level", ['level' => $level]);
        if (!$response->successful()) {
            throw new \InvalidArgumentException($response->json('message') ?? 'Failed to update log level.');
        }

        Cache::forget('ticket:config:log_level');
        return $response->json('level') ?? $level;
    }
}
