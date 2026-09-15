<?php

namespace App\Http\Controllers;

use App\Events\TicketChanged;
use App\Services\TicketCacheService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
}
