<?php

namespace App\Http\Controllers;

use App\Events\TicketChanged;
use App\Events\TicketLimitsUpdated;
use App\Services\TicketCacheService;
use App\Services\TicketConfigurationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SuperAdminConfigController extends Controller
{
    protected TicketCacheService $cacheService;

    public function __construct(TicketCacheService $cacheService)
    {
        $this->cacheService = $cacheService;
    }

    private function checkSuperAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return null;
    }

    public function getSuperAdminConfig(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $equipment = DB::table('machine_categories')
            ->select('category_ID as id', 'category_name as name')
            ->orderBy('category_name')
            ->get();

        $priorities = DB::table('ticket_priorities')
            ->select('priority_ID as id', 'priority_name as name', 'color_code as color')
            ->orderBy('priority_ID')
            ->get();

        return response()->json([
            'equipment' => $equipment,
            'priorities' => $priorities,
        ]);
    }

    public function createSuperAdminEquipment(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $id = DB::table('machine_categories')->insertGetId([
            'category_name' => $validated['name'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Keep problem_categories in sync!
        $exists = DB::table('problem_categories')->where('category_name', $validated['name'])->exists();
        if (!$exists) {
            DB::table('problem_categories')->insert([
                'category_name' => $validated['name'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Audit Log entry
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_create',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Equipment Configuration',
                'target' => $validated['name'],
                'text' => "Created equipment category '{$validated['name']}'",
            ]),
            'created_at' => now(),
        ]);

        event(new TicketChanged(['type' => 'config']));
        $this->cacheService->clearTicketCaches();

        return response()->json([
            'message' => 'Equipment category created successfully.',
            'id' => $id,
        ], 201);
    }

    public function updateSuperAdminEquipment(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $category = DB::table('machine_categories')->where('category_ID', $id)->first();
        if (!$category) {
            return response()->json(['message' => 'Equipment category not found'], 404);
        }

        DB::table('machine_categories')
            ->where('category_ID', $id)
            ->update([
                'category_name' => $validated['name'],
                'updated_at' => now(),
            ]);

        DB::table('problem_categories')
            ->where('category_name', $category->category_name)
            ->update([
                'category_name' => $validated['name'],
                'updated_at' => now(),
            ]);

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_update',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Equipment Configuration',
                'target' => $validated['name'],
                'text' => "Updated equipment category from '{$category->category_name}' to '{$validated['name']}'",
            ]),
            'created_at' => now(),
        ]);

        event(new TicketChanged(['type' => 'config']));
        $this->cacheService->clearTicketCaches();

        return response()->json(['message' => 'Equipment category updated successfully.']);
    }

    public function deleteSuperAdminEquipment(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $category = DB::table('machine_categories')->where('category_ID', $id)->first();
        if (!$category) {
            return response()->json(['message' => 'Equipment category not found'], 404);
        }

        DB::table('machine_categories')->where('category_ID', $id)->delete();
        DB::table('problem_categories')->where('category_name', $category->category_name)->delete();

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_delete',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Equipment Configuration',
                'target' => $category->category_name,
                'text' => "Deleted equipment category '{$category->category_name}'",
            ]),
            'created_at' => now(),
        ]);

        event(new TicketChanged(['type' => 'config']));
        $this->cacheService->clearTicketCaches();

        return response()->json(['message' => 'Equipment category deleted successfully.']);
    }

    public function createSuperAdminPriority(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'required|string|max:255',
        ]);

        $id = DB::table('ticket_priorities')->insertGetId([
            'priority_name' => $validated['name'],
            'color_code' => $validated['color'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_create',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Priority Configuration',
                'target' => $validated['name'],
                'text' => "Created priority level '{$validated['name']}' with color '{$validated['color']}'",
            ]),
            'created_at' => now(),
        ]);

        event(new TicketChanged(['type' => 'config']));
        $this->cacheService->clearTicketCaches();

        return response()->json([
            'message' => 'Priority level created successfully.',
            'id' => $id,
        ], 201);
    }

    public function updateSuperAdminPriority(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'required|string|max:255',
        ]);

        $priority = DB::table('ticket_priorities')->where('priority_ID', $id)->first();
        if (!$priority) {
            return response()->json(['message' => 'Priority level not found'], 404);
        }

        DB::table('ticket_priorities')
            ->where('priority_ID', $id)
            ->update([
                'priority_name' => $validated['name'],
                'color_code' => $validated['color'],
                'updated_at' => now(),
            ]);

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_update',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Priority Configuration',
                'target' => $validated['name'],
                'text' => "Updated priority level from '{$priority->priority_name}' to '{$validated['name']}' (color: '{$validated['color']}')",
            ]),
            'created_at' => now(),
        ]);

        event(new TicketChanged(['type' => 'config']));
        $this->cacheService->clearTicketCaches();

        return response()->json(['message' => 'Priority level updated successfully.']);
    }

    public function deleteSuperAdminPriority(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $priority = DB::table('ticket_priorities')->where('priority_ID', $id)->first();
        if (!$priority) {
            return response()->json(['message' => 'Priority level not found'], 404);
        }

        DB::table('ticket_priorities')->where('priority_ID', $id)->delete();

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_delete',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Priority Configuration',
                'target' => $priority->priority_name,
                'text' => "Deleted priority level '{$priority->priority_name}'",
            ]),
            'created_at' => now(),
        ]);

        event(new TicketChanged(['type' => 'config']));
        $this->cacheService->clearTicketCaches();

        return response()->json(['message' => 'Priority level deleted successfully.']);
    }

    public function getSuperAdminAuditLogs(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $logs = DB::table('ticket_audit_logs as tal')
            ->leftJoin('employees as e', 'e.emp_id', '=', 'tal.action_by_ID')
            ->leftJoin('tickets as t', 't.ticket_ID', '=', 'tal.ticket_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->select('tal.*', 'e.first_name', 'e.last_name', 'e.role', 'c.client_name')
            ->orderBy('tal.created_at', 'desc')
            ->get();

        $formattedLogs = $logs->map(function ($log) {
            $firstName = $log->first_name ?? 'System';
            $lastName = $log->last_name ?? '';
            $userFullName = trim($firstName . ' ' . $lastName) ?: 'System';
            
            $role = 'System';
            if ($log->actor_type === 'superadmin') {
                $role = 'Super Admin';
            } elseif ($log->actor_type === 'customer') {
                $role = 'Customer';
                $userFullName = $log->client_name ?? 'Customer';
            } elseif ($log->role) {
                $role = ucwords($log->role);
            }

            $action = 'Updated';
            $module = 'Tickets';
            $target = $log->ticket_ID ? 'TKT-' . str_pad((string) $log->ticket_ID, 4, '0', STR_PAD_LEFT) : 'System';
            $details = $log->details;

            $detailsDecoded = json_decode($log->details, true);
            if ($log->actor_type === 'superadmin' && $detailsDecoded) {
                $module = $detailsDecoded['module'] ?? 'System';
                $target = $detailsDecoded['target'] ?? 'System';
                $details = $detailsDecoded['text'] ?? '';
                
                if (str_contains($log->action_type, 'create')) {
                    $action = 'Created';
                } elseif (str_contains($log->action_type, 'delete')) {
                    $action = 'Deleted';
                } else {
                    $action = 'Updated';
                }
            } else {
                if ($log->action_type === 'create') {
                    $action = 'Created';
                    if ($detailsDecoded && isset($detailsDecoded['title'])) {
                        $details = "Created ticket \"" . $detailsDecoded['title'] . "\"";
                    }
                } elseif ($log->action_type === 'accept') {
                    $action = 'Accepted';
                } elseif ($log->action_type === 'reassign_request') {
                    $action = 'Reassign Requested';
                } elseif ($log->action_type === 'reassign_approve') {
                    $action = 'Reassign Approved';
                } elseif ($log->action_type === 'reassign_reject') {
                    $action = 'Reassign Rejected';
                } elseif ($log->action_type === 'internal_note') {
                    $action = 'Internal Note Added';
                } elseif ($log->action_type === 'employee_update') {
                    $action = 'Employee Updated';
                }

                if ($log->action_type !== 'create' && $detailsDecoded) {
                    if (isset($detailsDecoded['field'])) {
                        $field = $detailsDecoded['field'];
                        $oldVal = is_array($detailsDecoded['old']) ? json_encode($detailsDecoded['old']) : ($detailsDecoded['old'] ?? 'null');
                        $newVal = is_array($detailsDecoded['new']) ? json_encode($detailsDecoded['new']) : ($detailsDecoded['new'] ?? 'null');
                        $details = "Changed field '{$field}' from '{$oldVal}' to '{$newVal}'";
                    } elseif (isset($detailsDecoded['message'])) {
                        $details = $detailsDecoded['message'];
                    } elseif (isset($detailsDecoded['reason'])) {
                        $details = "Reason: " . $detailsDecoded['reason'];
                    } elseif (isset($detailsDecoded['note'])) {
                        $details = "Note: " . $detailsDecoded['note'];
                    }
                }
            }

            return [
                'id' => $log->log_ID,
                'timestamp' => $log->created_at,
                'user' => $userFullName,
                'role' => $role,
                'action' => $action,
                'module' => $module,
                'target' => $target,
                'details' => $details,
            ];
        });

        return response()->json($formattedLogs);
    }

    public function getSuperAdminHistory(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $logs = DB::table('ticket_audit_logs as tal')
            ->leftJoin('employees as e', 'e.emp_id', '=', 'tal.action_by_ID')
            ->select('tal.*', 'e.first_name', 'e.last_name', 'e.role')
            ->where('tal.actor_type', 'superadmin')
            ->orWhere('tal.action_type', 'like', 'config_%')
            ->orderBy('tal.created_at', 'desc')
            ->get();

        $formattedLogs = $logs->map(function ($log) {
            $firstName = $log->first_name ?? 'System';
            $lastName = $log->last_name ?? '';
            $userFullName = trim($firstName . ' ' . $lastName) ?: 'System';
            
            $role = 'Super Admin';
            $action = 'Updated';
            $module = 'System';
            $target = 'System';
            $details = $log->details;

            $detailsDecoded = json_decode($log->details, true);
            if ($detailsDecoded) {
                $module = $detailsDecoded['module'] ?? 'System';
                $target = $detailsDecoded['target'] ?? 'System';
                $details = $detailsDecoded['text'] ?? '';
            }

            if (str_contains($log->action_type, 'create')) {
                $action = 'Created';
            } elseif (str_contains($log->action_type, 'delete')) {
                $action = 'Deleted';
            } else {
                $action = 'Updated';
            }

            return [
                'id' => $log->log_ID,
                'timestamp' => $log->created_at,
                'user' => $userFullName,
                'role' => $role,
                'action' => $action,
                'module' => $module,
                'target' => $target,
                'details' => $details,
            ];
        });

        return response()->json($formattedLogs);
    }

    /**
     * Retrieve the system-wide max-open-ticket configuration.
     */
    public function getTicketLimit(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $config = TicketConfigurationService::getLimitConfig();

        return response()->json([
            'key' => 'limits',
            'value' => $config,
        ]);
    }

    /**
     * Update the max-open-ticket policy and record the authenticated actor.
     */
    public function updateTicketLimit(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $payload = $request->input('value', $request->all());
        $validator = \Illuminate\Support\Facades\Validator::make($payload, [
            'isUnlimited' => ['required', 'boolean'],
            'limit' => ['required', 'integer', 'min:1', 'max:1000'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation Error: Invalid max open tickets configuration.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $before = TicketConfigurationService::getLimitConfig();

        try {
            $updated = TicketConfigurationService::updateLimitConfig($validator->validated(), $user);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $this->recordTicketLimitChange($user, $before, $updated, 'config_update');

        return response()->json([
            'message' => 'Max open tickets configuration updated successfully.',
            'key' => 'limits',
            'value' => $updated,
        ]);
    }

    /**
     * Reset the max-open-ticket policy to Unlimited.
     */
    public function resetTicketLimit(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $user = $request->user();
        $before = TicketConfigurationService::getLimitConfig();

        try {
            $updated = TicketConfigurationService::resetLimitConfig($user);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $this->recordTicketLimitChange($user, $before, $updated, 'config_reset');

        return response()->json([
            'message' => 'Max open tickets configuration reset to Unlimited.',
            'key' => 'limits',
            'value' => $updated,
        ]);
    }

    private function recordTicketLimitChange($user, array $before, array $after, string $actionType): void
    {
        if ($before === $after) {
            return;
        }

        $changedAt = now();
        $actorId = (int) ($user->emp_id ?? $user->id);
        $previousLimit = $before['isUnlimited'] ? 'unlimited' : (int) $before['limit'];
        $newLimit = $after['isUnlimited'] ? 'unlimited' : (int) $after['limit'];

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => $actionType,
            'action_by_ID' => $actorId,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Ticket Limit Configuration',
                'target' => 'Max Open Tickets per Requester',
                'text' => "Changed max open tickets from {$previousLimit} to {$newLimit}.",
                'previous_limit' => $previousLimit,
                'new_limit' => $newLimit,
                'previous_value' => $before,
                'new_value' => $after,
                'changed_at' => $changedAt->toIso8601String(),
            ]),
            'created_at' => $changedAt,
        ]);

        try {
            event(new TicketLimitsUpdated(
                $before,
                $after,
                $actorId,
                $changedAt->toIso8601String()
            ));
        } catch (\Throwable $e) {
            Log::warning('Broadcasting TicketLimitsUpdated failed: ' . $e->getMessage());
        }
    }

    /**
     * Retrieve the ticket lifecycle window configuration (reopen & auto-close).
     */
    public function getWindowConfig(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $config = \App\Services\TicketConfigurationService::getWindowConfig();

        return response()->json(array_merge([
            'key' => 'windows',
            'value' => $config,
        ], $config));
    }

    /**
     * Update the ticket lifecycle window configuration independently with strict validation.
     */
    public function updateWindowConfig(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $payload = $request->input('value', $request->all());

        $validator = \Illuminate\Support\Facades\Validator::make($payload, [
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
        ], [
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

        try {
            $updated = \App\Services\TicketConfigurationService::updateWindowConfig($validated, $user);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $reopenText = ($updated['reopenEnabled'] ?? true)
            ? "Enabled ({$updated['reopenWindowDays']} days)"
            : "Disabled";
        $autoCloseText = ($updated['autoCloseEnabled'] ?? true)
            ? "Enabled ({$updated['autoCloseWindowDays']} days)"
            : "Disabled";

        // Audit Log entry in ticket-service
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_update',
            'action_by_ID' => $user->emp_id ?? $user->id ?? 1,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Lifecycle Window Configuration',
                'target' => 'Reopen & Auto-Close Windows',
                'text' => "Updated ticket lifecycle windows: Customer Reopen is {$reopenText}, Auto-Close is {$autoCloseText}. Changes apply only to subsequent lifecycle actions.",
            ]),
            'created_at' => now(),
        ]);

        event(new TicketChanged([
            'type' => 'config',
            'section' => 'windows',
            'data' => $updated,
        ]));

        $this->cacheService->clearTicketCaches();

        return response()->json(array_merge([
            'message' => 'Ticket lifecycle window configuration updated successfully.',
            'key' => 'windows',
            'value' => $updated,
        ], $updated));
    }

    /**
     * View active notification recipient routing.
     */
    public function getNotificationRouting(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $routing = \App\Services\TicketConfigurationService::getRoutingConfig();

        return response()->json([
            'key' => 'routing',
            'value' => $routing,
            'immutable_scope' => [
                'system_alert' => [
                    'locked' => true,
                    'recipients' => ['role_superadmin'],
                    'description' => 'System alerts are strictly hard-coded to Super Admin at dispatch level and cannot be modified.',
                ],
            ],
        ]);
    }

    /**
     * Update notification recipient routing with strict validation:
     * - Rejects any save with 0 recipients in a configurable scope
     * - Explicitly excludes and rejects system_alert modification
     * - Dispatches TicketChanged broadcast and writes audit log
     */
    public function updateNotificationRouting(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $rawPayload = $request->all();
        $routingPayload = $request->input('routing', $request->input('value', $rawPayload));

        // 1. Explicitly reject system_alert from configurable scope
        if (isset($routingPayload['system_alert']) || isset($rawPayload['system_alert'])) {
            return response()->json([
                'message' => 'Validation Error: system_alert cannot be configured. System alerts are strictly hard-coded to Super Admin at dispatch level.',
                'errors' => [
                    'system_alert' => ['System alerts are restricted to Super Admin and cannot be customized via recipient routing.'],
                ],
            ], 422);
        }

        $titles = [
            'new_ticket' => 'New Ticket Alert',
            'new_message' => 'New Message Alert',
            'overdue_ticket' => 'Overdue Ticket Alert',
        ];

        // 2. Reject zero recipients for any configurable scope
        $errors = [];
        foreach (['new_ticket', 'new_message', 'overdue_ticket'] as $scopeKey) {
            if (array_key_exists($scopeKey, $routingPayload)) {
                $recipients = $routingPayload[$scopeKey];
                if (!is_array($recipients) || count($recipients) === 0) {
                    $errors[$scopeKey] = ["At least one recipient is required for {$titles[$scopeKey]}."];
                }
            }
        }

        if (!empty($errors)) {
            return response()->json([
                'message' => 'Validation Error: Invalid recipient routing configuration.',
                'errors' => $errors,
            ], 422);
        }

        try {
            $updated = \App\Services\TicketConfigurationService::updateRoutingConfig($routingPayload, $user);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // Audit Log entry in ticket-service
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_update',
            'action_by_ID' => $user->emp_id ?? $user->id ?? 1,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Notification Recipient Routing',
                'target' => 'Recipient Routing Rules',
                'text' => "Updated notification recipient routing for: " . implode(', ', array_keys($updated)),
            ]),
            'created_at' => now(),
        ]);

        $this->cacheService->clearTicketCaches();

        return response()->json([
            'message' => 'Notification recipient routing updated successfully.',
            'key' => 'routing',
            'value' => $updated,
        ]);
    }

    /**
     * Reset notification recipient routing to factory defaults.
     */
    public function resetNotificationRouting(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();

        $defaults = \App\Services\TicketConfigurationService::resetRoutingConfig($user);

        // Audit Log entry in ticket-service
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_reset',
            'action_by_ID' => $user->emp_id ?? $user->id ?? 1,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Notification Recipient Routing',
                'target' => 'Recipient Routing Rules',
                'text' => "Reset notification recipient routing to system defaults.",
            ]),
            'created_at' => now(),
        ]);

        $this->cacheService->clearTicketCaches();

        return response()->json([
            'message' => 'Notification recipient routing reset to defaults.',
            'key' => 'routing',
            'value' => $defaults,
        ]);
    }

    public function getCompanyInfo(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $info = \App\Services\TicketConfigurationService::getCompanyInfo();
        return response()->json([
            'key' => 'company_info',
            'value' => $info,
        ]);
    }

    public function updateCompanyInfo(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();
        $payload = $request->input('value', $request->all());
        try {
            $updated = \App\Services\TicketConfigurationService::updateCompanyInfo($payload, $user);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        return response()->json([
            'message' => 'Company information updated successfully.',
            'key' => 'company_info',
            'value' => $updated,
        ]);
    }

    public function getSystemStatus(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $status = \App\Services\TicketConfigurationService::getSystemStatus();
        return response()->json([
            'key' => 'system_status',
            'status' => $status,
            'value' => ['status' => $status],
        ]);
    }

    public function updateSystemStatus(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();
        $status = $request->input('status', $request->input('value.status', 'Operational'));
        try {
            $updated = \App\Services\TicketConfigurationService::updateSystemStatus($status, $user);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        return response()->json([
            'message' => "System status updated successfully to '{$updated}'.",
            'key' => 'system_status',
            'status' => $updated,
            'value' => ['status' => $updated],
        ]);
    }

    public function getLogLevel(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $level = \App\Services\TicketConfigurationService::getLogLevel();
        return response()->json([
            'key' => 'log_level',
            'level' => $level,
            'value' => ['level' => $level],
        ]);
    }

    public function updateLogLevel(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }
        $user = $request->user();
        $level = $request->input('level', $request->input('value.level', 'Info'));
        try {
            $updated = \App\Services\TicketConfigurationService::updateLogLevel($level, $user);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        return response()->json([
            'message' => "Log level updated successfully to '{$updated}'.",
            'key' => 'log_level',
            'level' => $updated,
            'value' => ['level' => $updated],
        ]);
    }
}
