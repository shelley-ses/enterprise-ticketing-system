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
