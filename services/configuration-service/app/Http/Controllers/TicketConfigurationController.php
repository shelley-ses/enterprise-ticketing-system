<?php

namespace App\Http\Controllers;

use App\Events\TicketWindowConfigUpdated;
use App\Models\TicketConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class TicketConfigurationController extends Controller
{
    /**
     * Default configurations baseline.
     */
    protected array $defaults = [
        'number_format' => [
            'prefix' => 'TKT',
            'includeDeptCode' => false,
            'deptCode' => '',
            'dateSegment' => 'none',
            'digitLength' => 4,
        ],
        'defaults' => [
            'status' => 'Open',
            'priority' => 'Low',
            'slaPolicy' => 'dynamic',
        ],
        'limits' => [
            'isUnlimited' => true,
            'limit' => 5,
        ],
        'transitions' => [
            'Open' => [
                'allowed' => ['In Progress (CS-owned)', 'Cancelled'],
                'type' => 'editable',
                'description' => 'Initial ticket state upon customer or internal creation.',
            ],
            'In Progress (CS-owned)' => [
                'allowed' => ['On Hold/Pending', 'Assigned', 'Resolved'],
                'type' => 'editable',
                'description' => 'Ticket being triaged or actively handled directly by Customer Service.',
            ],
            'Assigned' => [
                'allowed' => ['Reassigned', 'In Progress (Employee-owned)'],
                'type' => 'editable',
                'description' => 'Ticket dispatched to an engineer/technician and awaiting their acceptance.',
            ],
            'Reassigned' => [
                'allowed' => ['In Progress (Employee-owned)', 'Assigned'],
                'type' => 'editable',
                'description' => 'Ticket reassignment requested or approved for re-dispatch.',
            ],
            'In Progress (Employee-owned)' => [
                'allowed' => ['On Hold/Pending', 'Reassigned', 'Resolved'],
                'type' => 'editable',
                'description' => 'Service engineer has accepted the assignment and is actively working on the machine.',
            ],
            'Resolved' => [
                'allowed' => ['Closed', 'In Progress (Employee-owned)'],
                'type' => 'editable',
                'description' => 'Work is marked complete with proof of completion pending evaluation.',
            ],
            'Closed' => [
                'allowed' => ['Reopened'],
                'type' => 'editable',
                'caption' => 'Reopening is permitted only within the configured reopen window (e.g. 48h after resolution).',
                'description' => 'Final confirmed state. Can transition to Reopened within the allowed reopen window.',
            ],
            'Reopened' => [
                'allowed' => ['In Progress (CS-owned)'],
                'type' => 'fixed',
                'caption' => 'Automatic transition: Reopened tickets immediately route to Customer Service (CS-owned). This transition is system-automated and non-editable.',
                'description' => 'Ticket reopened by customer within window; routes automatically to CS.',
            ],
            'On Hold/Pending' => [
                'allowed' => [],
                'type' => 'contextual',
                'caption' => 'Contextual transition: Resumes back to whichever In Progress state it came from (CS-owned or Employee-owned). This is contextual rather than a fixed pair, so it is non-editable.',
                'description' => 'Ticket paused awaiting parts, customer feedback, or external dependency.',
            ],
            'Cancelled' => [
                'allowed' => [],
                'type' => 'terminal',
                'caption' => 'Terminal status: No further transitions permitted from Cancelled.',
                'description' => 'Ticket discarded or cancelled before assignment.',
            ],
        ],
        'windows' => [
            'reopenEnabled' => true,
            'reopenWindowDays' => 2,
            'autoCloseEnabled' => true,
            'autoCloseWindowDays' => 2,
        ],
        'file_limits' => [
            'maxFileSizeMB' => 15,
            'allowedFileTypes' => ['PDF', 'DOCX', 'DOC', 'JPG', 'JPEG', 'PNG'],
            'maxFileCount' => 5,
            'malwareScanningEnabled' => true,
        ],
        'routing' => [
            'new_ticket' => ['role_cs'],
            'new_message' => ['contextual_assigned'],
            'overdue_ticket' => ['role_cs'],
        ],
    ];

    /**
     * Helper to write configuration audit logs to ticket_audit_logs.
    /**
     * Verify that the request is authorized to modify system configuration.
     * Enforces superadmin authentication or trusted internal microservice origin.
     */
    protected function checkAuthorized(Request $request): ?JsonResponse
    {
        // 1. Allow internal Docker network / microservice calls with internal header or private IP
        $clientIp = $request->ip();
        $isInternal = in_array($clientIp, ['127.0.0.1', '::1'])
            || str_starts_with($clientIp, '172.')
            || str_starts_with($clientIp, '10.')
            || $request->header('X-Internal-Call') === 'ticket-service';

        if ($isInternal) {
            return null;
        }

        // 2. Check Bearer token in local Redis session cache
        $authHeader = $request->header('Authorization');
        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
            if ($token === 'frontend-dev-token' && app()->environment('local')) {
                return null;
            }
            $tokenHash = hash('sha256', $token);
            $cachedEmpId = Cache::get('sso_auth_cache:' . $tokenHash);
            if ($cachedEmpId) {
                $employee = DB::table('employees')->where('emp_id', $cachedEmpId)->first();
                if ($employee && strtolower(str_replace(' ', '', $employee->role ?? '')) === 'superadmin') {
                    return null;
                }
                return response()->json(['message' => 'Forbidden: Only Super Administrators can modify configurations.'], 403);
            }
        }

        // 3. Check X-User-Role header
        $roleHeader = $request->header('X-User-Role');
        if ($roleHeader && strtolower(str_replace(' ', '', $roleHeader)) === 'superadmin') {
            return null;
        }

        return response()->json(['message' => 'Unauthorized: Authentication required.'], 401);
    }

    /**
     * Helper to write configuration audit logs to ticket_audit_logs.
     */
    protected function logAudit(?Request $request, string $actionType, string $module, string $target, string $text): void
    {
        try {
            $userId = $request?->header('X-User-Id')
                ?? $request?->user()?->emp_id
                ?? $request?->user()?->id
                ?? DB::table('employees')->where('role', 'superadmin')->value('emp_id')
                ?? DB::table('employees')->value('emp_id')
                ?? 1;

            DB::table('ticket_audit_logs')->insert([
                'ticket_ID'    => null,
                'action_type'  => $actionType,
                'action_by_ID' => $userId,
                'actor_type'   => 'superadmin',
                'details'      => json_encode([
                    'module' => $module,
                    'target' => $target,
                    'text'   => $text,
                ]),
                'created_at'   => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning("Failed to record configuration audit log: " . $e->getMessage());
        }
    }

    /**
     * Non-blocking Redis cache invalidation across services using SCAN chunking.
     */
    protected function clearWindowCache(): void
    {
        try {
            Cache::forget('ticket:config:windows');
            Cache::forget('ticket_configuration:windows');
            $cursor = 0;
            do {
                [$cursor, $keys] = Redis::scan($cursor, ['match' => '*ticket*windows*', 'count' => 100]);
                if (!empty($keys)) {
                    Redis::del($keys);
                }
            } while ($cursor != 0);
        } catch (\Throwable $e) {
            Log::warning('Redis cache clearing failed: ' . $e->getMessage());
        }
    }

    /**
     * Get all ticket configuration sections.
     */
    public function index(): JsonResponse
    {
        $configs = TicketConfiguration::all()->pluck('value', 'key')->toArray();

        // Merge with defaults if any key is missing
        $result = [];
        foreach ($this->defaults as $key => $defaultVal) {
            $result[$key] = $configs[$key] ?? $defaultVal;
        }

        return response()->json($result);
    }

    /**
     * Dedicated endpoint to view reopen & auto-close windows configuration.
     */
    public function showWindows(): JsonResponse
    {
        $value = TicketConfiguration::getByKey('windows', $this->defaults['windows']);

        return response()->json(array_merge([
            'key' => 'windows',
            'value' => $value,
        ], $value));
    }

    /**
     * Dedicated endpoint to update reopen & auto-close windows configuration independently.
     */
    public function updateWindows(Request $request): JsonResponse
    {
        return $this->update($request, 'windows');
    }

    /**
     * Get a specific configuration section.
     */
    public function show(string $key): JsonResponse
    {
        $normalizedKey = str_replace('-', '_', $key);
        $value = TicketConfiguration::getByKey($normalizedKey, $this->defaults[$normalizedKey] ?? null);

        if ($value === null) {
            return response()->json(['message' => "Configuration section '{$key}' not found."], 404);
        }

        return response()->json([
            'key' => $normalizedKey,
            'value' => $value,
        ]);
    }

    /**
     * Save/update a configuration section.
     */
    public function update(Request $request, string $key): JsonResponse
    {
        if ($authErr = $this->checkAuthorized($request)) {
            return $authErr;
        }

        $normalizedKey = str_replace('-', '_', $key);

        if (!array_key_exists($normalizedKey, $this->defaults)) {
            return response()->json(['message' => "Invalid configuration section '{$key}'."], 422);
        }

        $payload = $request->input('value', $request->all());

        switch ($normalizedKey) {
            case 'windows':
                // Strict validation: reject non-numeric, zero, and negative window durations
                $rules = [
                    'reopenEnabled' => 'sometimes|boolean',
                    'reopenWindowDays' => [
                        'sometimes',
                        'required',
                        function ($attribute, $value, $fail) {
                            if (!is_numeric($value)) {
                                $fail('The reopen window duration must be a valid numeric value.');
                                return;
                            }
                            $num = (float) $value;
                            if ($num <= 0) {
                                $fail('The reopen window duration must be a positive number greater than zero.');
                                return;
                            }
                            if ((int) $value != $num) {
                                $fail('The reopen window duration must be a whole integer number of days.');
                            }
                        },
                    ],
                    'autoCloseEnabled' => 'sometimes|boolean',
                    'autoCloseWindowDays' => [
                        'sometimes',
                        'required',
                        function ($attribute, $value, $fail) {
                            if (!is_numeric($value)) {
                                $fail('The auto-close window duration must be a valid numeric value.');
                                return;
                            }
                            $num = (float) $value;
                            if ($num <= 0) {
                                $fail('The auto-close window duration must be a positive number greater than zero.');
                                return;
                            }
                            if ((int) $value != $num) {
                                $fail('The auto-close window duration must be a whole integer number of days.');
                            }
                        },
                    ],
                ];

                $validator = Validator::make($payload, $rules, [
                    'reopenEnabled.boolean' => 'The reopen enabled setting must be true or false.',
                    'autoCloseEnabled.boolean' => 'The auto-close enabled setting must be true or false.',
                ]);

                if ($validator->fails()) {
                    return response()->json([
                        'message' => 'Validation Error: Invalid window configuration values.',
                        'errors' => $validator->errors(),
                    ], 422);
                }

                $validated = $validator->validated();

                // Merge with existing configuration to support independent field updates
                $current = TicketConfiguration::getByKey('windows', $this->defaults['windows']);

                $reopenEnabled = array_key_exists('reopenEnabled', $validated)
                    ? (bool) $validated['reopenEnabled']
                    : (bool) ($current['reopenEnabled'] ?? true);

                $reopenWindowDays = array_key_exists('reopenWindowDays', $validated)
                    ? (int) $validated['reopenWindowDays']
                    : (int) ($current['reopenWindowDays'] ?? 2);

                $autoCloseEnabled = array_key_exists('autoCloseEnabled', $validated)
                    ? (bool) $validated['autoCloseEnabled']
                    : (bool) ($current['autoCloseEnabled'] ?? true);

                $autoCloseWindowDays = array_key_exists('autoCloseWindowDays', $validated)
                    ? (int) $validated['autoCloseWindowDays']
                    : (int) ($current['autoCloseWindowDays'] ?? 2);

                $value = [
                    'reopenEnabled' => $reopenEnabled,
                    'reopenWindowDays' => $reopenWindowDays,
                    'autoCloseEnabled' => $autoCloseEnabled,
                    'autoCloseWindowDays' => $autoCloseWindowDays,
                ];

                $record = TicketConfiguration::setByKey('windows', $value);

                // Non-blocking Redis cache invalidation across services
                $this->clearWindowCache();

                // Audit logging capturing the acting super admin
                $reopenText = $reopenEnabled ? "Enabled ({$reopenWindowDays} days)" : "Disabled";
                $autoCloseText = $autoCloseEnabled ? "Enabled ({$autoCloseWindowDays} days)" : "Disabled";
                $auditText = "Updated ticket lifecycle windows: Customer Reopen is {$reopenText}, Auto-Close is {$autoCloseText}. Changes apply only to subsequent lifecycle actions.";

                $this->logAudit(
                    $request,
                    'config_update',
                    'Lifecycle Window Configuration',
                    'Reopen & Auto-Close Windows',
                    $auditText
                );

                // Publish event to broadcast channel
                $actingUserId = $request->user()?->emp_id ?? $request->user()?->id ?? null;
                try {
                    event(new TicketWindowConfigUpdated($value, $actingUserId));
                } catch (\Throwable $e) {
                    Log::warning('Broadcasting TicketWindowConfigUpdated failed: ' . $e->getMessage());
                }

                return response()->json(array_merge([
                    'message' => "Configuration for 'windows' updated successfully.",
                    'key' => 'windows',
                    'value' => $record->value,
                ], $record->value));

            case 'number_format':
                $validated = $request->validate([
                    'prefix' => 'required|string|max:16',
                    'includeDeptCode' => 'sometimes|boolean',
                    'deptCode' => 'nullable|string|max:16',
                    'dateSegment' => 'required|string|in:none,YYYY,YYYYMM,YYYYMMDD',
                    'digitLength' => 'required|integer|min:3|max:8',
                ]);
                $value = [
                    'prefix' => strtoupper(trim($validated['prefix'])),
                    'includeDeptCode' => (bool) ($validated['includeDeptCode'] ?? false),
                    'deptCode' => strtoupper(trim($validated['deptCode'] ?? '')),
                    'dateSegment' => $validated['dateSegment'],
                    'digitLength' => (int) $validated['digitLength'],
                ];
                break;

            case 'defaults':
                $validated = $request->validate([
                    'status' => 'required|string|max:64',
                    'priority' => 'required|string|max:64',
                    'slaPolicy' => 'required|string|max:64',
                ]);
                $value = [
                    'status' => $validated['status'],
                    'priority' => $validated['priority'],
                    'slaPolicy' => $validated['slaPolicy'],
                ];
                break;

            case 'limits':
                $validated = $request->validate([
                    'isUnlimited' => 'required|boolean',
                    'limit' => 'nullable|integer|min:1|max:1000',
                ]);
                $value = [
                    'isUnlimited' => (bool) $validated['isUnlimited'],
                    'limit' => (int) ($validated['limit'] ?? 5),
                ];
                break;

            case 'file_limits':
                $validated = $request->validate([
                    'maxFileSizeMB' => 'required|numeric|min:1|max:500',
                    'allowedFileTypes' => 'required|array|min:1',
                    'allowedFileTypes.*' => 'string|max:16',
                    'maxFileCount' => 'required|integer|min:1|max:50',
                    'malwareScanningEnabled' => 'required|boolean',
                ]);
                $value = [
                    'maxFileSizeMB' => (float) $validated['maxFileSizeMB'],
                    'allowedFileTypes' => array_values(array_unique(array_map('strtoupper', $validated['allowedFileTypes']))),
                    'maxFileCount' => (int) $validated['maxFileCount'],
                    'malwareScanningEnabled' => (bool) $validated['malwareScanningEnabled'],
                ];
                break;

            case 'routing':
                $validated = $request->validate([
                    'routing' => 'sometimes|array',
                    'new_ticket' => 'sometimes|array|min:1',
                    'new_message' => 'sometimes|array|min:1',
                    'overdue_ticket' => 'sometimes|array|min:1',
                ]);
                $value = $request->has('routing') ? $request->input('routing') : $request->only(['new_ticket', 'new_message', 'overdue_ticket']);
                break;

            case 'transitions':
                $request->validate([
                    'transitions' => 'sometimes|array',
                ]);
                $value = $request->has('transitions') ? $request->input('transitions') : $payload;
                break;

            default:
                $value = $payload;
                break;
        }

        $record = TicketConfiguration::setByKey($normalizedKey, $value);

        $this->logAudit(
            $request,
            'config_update',
            'Ticket Configuration',
            ucwords(str_replace('_', ' ', $normalizedKey)),
            "Updated configuration section '{$normalizedKey}'."
        );

        return response()->json([
            'message' => "Configuration for '{$normalizedKey}' updated successfully.",
            'key' => $normalizedKey,
            'value' => $record->value,
        ]);
    }

    /**
     * Reset a configuration section to its default values.
     */
    public function reset(string $key): JsonResponse
    {
        if ($authErr = $this->checkAuthorized(request())) {
            return $authErr;
        }

        $normalizedKey = str_replace('-', '_', $key);

        if (!array_key_exists($normalizedKey, $this->defaults)) {
            return response()->json(['message' => "Invalid configuration section '{$key}'."], 422);
        }

        $defaultValue = $this->defaults[$normalizedKey];
        $record = TicketConfiguration::setByKey($normalizedKey, $defaultValue);

        if ($normalizedKey === 'windows') {
            $this->clearWindowCache();

            try {
                event(new TicketWindowConfigUpdated($defaultValue, null));
            } catch (\Throwable $e) {}
        }

        $this->logAudit(
            request(),
            'config_reset',
            'Lifecycle Window Configuration',
            ucwords(str_replace('_', ' ', $normalizedKey)),
            "Reset configuration section '{$normalizedKey}' to system defaults."
        );

        return response()->json([
            'message' => "Configuration for '{$normalizedKey}' reset to defaults.",
            'key' => $normalizedKey,
            'value' => $record->value,
        ]);
    }
}
