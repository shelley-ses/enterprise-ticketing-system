<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\TicketDashboardController;
use App\Http\Controllers\TicketNotificationController;
use App\Http\Controllers\SuperAdminConfigController;
use App\Http\Controllers\SLARuleController;
use App\Http\Controllers\WorkflowEscalationController;

/*
|--------------------------------------------------------------------------
| API Routes - Ticket Service
|--------------------------------------------------------------------------
*/

Route::middleware('auth.subsystem')->get('/user', function (Request $request) {
    return $request->user();
});

// ─── Core Ticket Public / Common Endpoints ────────────────────────────────────
Route::get('/ticket-form-options', [TicketController::class, 'formOptions']);
Route::post('/tickets', [TicketController::class, 'store']);

// ─── Dashboards & Feed Endpoints ─────────────────────────────────────────────
Route::get('/customer-dashboard', [TicketDashboardController::class, 'customerDashboard']);
Route::get('/cs-dashboard', [TicketDashboardController::class, 'csDashboard'])->middleware('no-cache');
Route::get('/cs-incoming', [TicketDashboardController::class, 'csIncoming'])->middleware('no-cache');
Route::get('/departments', function () {
    try {
        $resp = Illuminate\Support\Facades\Http::get('http://employee-service:8000/api/departments');
        return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
    } catch (\Exception $e) {
        return response()->json(['departments' => []]);
    }
});

Route::middleware('auth.subsystem')->group(function () {
    // ─── Employee Assignment Forwarding ────────────────────────────────────────
    Route::match(['post', 'patch'], '/tickets/{ticketId}/accept', function (Request $request, $ticketId) {
        $token = $request->bearerToken();
        $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
            ->patch("http://employee-service:8000/api/tickets/{$ticketId}/accept", $request->all());
        return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
    });

    Route::post('/tickets/{ticketId}/assign', function (Request $request, $ticketId) {
        $token = $request->bearerToken();
        $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
            ->post("http://employee-service:8000/api/tickets/{$ticketId}/assign", $request->all());
        return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
    });

    Route::post('/tickets/{ticketId}/employee-update', function (Request $request, $ticketId) {
        $token = $request->bearerToken();
        $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
            ->post("http://employee-service:8000/api/tickets/{$ticketId}/employee-update", $request->all());
        return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
    });

    Route::get('/employee-tickets', function (Request $request) {
        $token = $request->bearerToken();
        $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
            ->get('http://employee-service:8000/api/employee-tickets', $request->all());
        return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
    });

    Route::get('/employee/profile', function (Request $request) {
        $token = $request->bearerToken();
        $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
            ->get('http://employee-service:8000/api/employee/profile', $request->all());
        return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
    });

    Route::get('/employee/tickets/internal', function (Request $request) {
        $token = $request->bearerToken();
        try {
            $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
                ->timeout(3)
                ->get('http://employee-service:8000/api/employee/tickets/internal', $request->all());
            if ($resp->successful()) {
                return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
            }
        } catch (\Exception $e) {}

        $user = $request->user();
        $empId = $user ? ($user->emp_id ?? $user->id) : null;
        $tickets = Illuminate\Support\Facades\DB::table('tickets as t')
            ->leftJoin('ticket_assignments as ta', 'ta.ticket_ID', '=', 't.ticket_ID')
            ->leftJoin('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->leftJoin('priorities as p', 'p.priority_ID', '=', 't.priority_ID')
            ->where('t.is_internal', true)
            ->where(function ($q) use ($empId) {
                if ($empId) {
                    $q->where('ta.employee_ID', $empId)
                      ->orWhere('t.requested_by', $empId);
                }
            })
            ->select('t.*', 'ts.status_name as status', 'p.priority_name as priority')
            ->orderBy('t.created_at', 'desc')
            ->get();

        return response()->json(['tickets' => $tickets]);
    });

    Route::get('/employee/worklogs', function (Request $request) {
        $token = $request->bearerToken();
        try {
            $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
                ->timeout(3)
                ->get('http://employee-service:8000/api/employee/worklogs', $request->all());
            if ($resp->successful()) {
                return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
            }
        } catch (\Exception $e) {}

        $user = $request->user();
        $empId = $user ? ($user->emp_id ?? $user->id) : null;
        $ticketId = $request->query('ticket_id');
        $query = Illuminate\Support\Facades\DB::table('work_logs');
        if ($ticketId) {
            $query->where('ticket_id', $ticketId);
        } elseif ($empId) {
            $query->where('employee_id', $empId);
        }
        $logs = $query->orderBy('log_date', 'desc')->orderBy('created_at', 'desc')->get();
        return response()->json(['data' => $logs, 'total' => count($logs)]);
    });

    Route::post('/employee/worklogs', function (Request $request) {
        $token = $request->bearerToken();
        try {
            $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
                ->timeout(3)
                ->post('http://employee-service:8000/api/employee/worklogs', $request->all());
            if ($resp->successful()) {
                return response($resp->body(), $resp->status())->header('Content-Type', 'application/json');
            }
        } catch (\Exception $e) {}

        $user = $request->user();
        $empId = $user ? ($user->emp_id ?? $user->id ?? 1) : 1;
        $validated = $request->validate([
            'ticket_id' => 'nullable|integer',
            'task_description' => 'required|string|max:1000',
            'hours_spent' => 'required|numeric|min:0.1|max:24',
            'log_date' => 'required|date',
        ]);

        $log = \App\Models\WorkLog::create([
            'employee_id' => $empId,
            'ticket_id' => $validated['ticket_id'] ?? null,
            'task_description' => $validated['task_description'],
            'hours_spent' => $validated['hours_spent'],
            'log_date' => $validated['log_date'],
            'status' => 'pending',
        ]);

        return response()->json(['message' => 'Work log saved successfully.', 'work_log' => $log], 201);
    });

    Route::get('/employee/worklogs/export', function (Request $request) {
        $token = $request->bearerToken();
        try {
            $resp = Illuminate\Support\Facades\Http::withHeaders(['Authorization' => "Bearer {$token}"])
                ->timeout(3)
                ->get('http://employee-service:8000/api/employee/worklogs/export', $request->all());
            if ($resp->successful()) {
                return response($resp->body(), $resp->status());
            }
        } catch (\Exception $e) {}

        return response()->json(['message' => 'Export not available'], 400);
    });

    // ─── Core Ticket Lifecycle ────────────────────────────────────────────────
    Route::post('/tickets/internal', [TicketController::class, 'storeInternalTicket']);
    Route::get('/tickets/{ticketId}', [TicketController::class, 'show']);
    Route::patch('/tickets/{ticketId}', [TicketController::class, 'updateTicket']);
    Route::delete('/tickets/{ticketId}', [TicketController::class, 'destroy']);

    // ─── Notifications ────────────────────────────────────────────────────────
    Route::get('/notifications', [TicketNotificationController::class, 'getNotifications']);
    Route::patch('/notifications/read-all', [TicketNotificationController::class, 'markNotificationsRead']);
    Route::patch('/notifications/{id}/read', [TicketNotificationController::class, 'markNotificationRead']);

    // ─── SuperAdmin Configuration & Audit Logs ────────────────────────────────
    Route::get('/superadmin/config', [SuperAdminConfigController::class, 'getSuperAdminConfig']);
    Route::post('/superadmin/equipment', [SuperAdminConfigController::class, 'createSuperAdminEquipment']);
    Route::put('/superadmin/equipment/{id}', [SuperAdminConfigController::class, 'updateSuperAdminEquipment']);
    Route::delete('/superadmin/equipment/{id}', [SuperAdminConfigController::class, 'deleteSuperAdminEquipment']);
    Route::post('/superadmin/priority', [SuperAdminConfigController::class, 'createSuperAdminPriority']);
    Route::put('/superadmin/priority/{id}', [SuperAdminConfigController::class, 'updateSuperAdminPriority']);
    Route::delete('/superadmin/priority/{id}', [SuperAdminConfigController::class, 'deleteSuperAdminPriority']);
    Route::get('/superadmin/audit-logs', [SuperAdminConfigController::class, 'getSuperAdminAuditLogs']);
    Route::get('/superadmin/history', [SuperAdminConfigController::class, 'getSuperAdminHistory']);

    // ─── SuperAdmin SLA Rules ─────────────────────────────────────────────────
    Route::get('/superadmin/sla-rules', [SLARuleController::class, 'index']);
    Route::post('/superadmin/sla-rules', [SLARuleController::class, 'store']);
    Route::post('/superadmin/sla-rules/department/{departmentId}', [SLARuleController::class, 'saveDepartmentRules']);
    Route::get('/superadmin/sla-rules/{id}', [SLARuleController::class, 'show']);
    Route::put('/superadmin/sla-rules/{id}', [SLARuleController::class, 'update']);
    Route::delete('/superadmin/sla-rules/{id}', [SLARuleController::class, 'destroy']);

    // ─── SuperAdmin Workflow Statuses ─────────────────────────────────────────
    Route::get('/superadmin/workflow-statuses', [WorkflowEscalationController::class, 'getWorkflowStatuses']);
    Route::post('/superadmin/workflow-statuses', [WorkflowEscalationController::class, 'storeWorkflowStatus']);
    Route::put('/superadmin/workflow-statuses/{id}', [WorkflowEscalationController::class, 'updateWorkflowStatus']);
    Route::delete('/superadmin/workflow-statuses/{id}', [WorkflowEscalationController::class, 'destroyWorkflowStatus']);

    // ─── SuperAdmin Escalation Rules ──────────────────────────────────────────
    Route::get('/superadmin/escalation-rules', [WorkflowEscalationController::class, 'getEscalationRules']);
    Route::post('/superadmin/escalation-rules', [WorkflowEscalationController::class, 'storeEscalationRule']);
    Route::put('/superadmin/escalation-rules/{id}', [WorkflowEscalationController::class, 'updateEscalationRule']);
    Route::delete('/superadmin/escalation-rules/{id}', [WorkflowEscalationController::class, 'destroyEscalationRule']);
    Route::patch('/superadmin/escalation-rules/{id}/toggle', [WorkflowEscalationController::class, 'toggleEscalationRule']);
});
