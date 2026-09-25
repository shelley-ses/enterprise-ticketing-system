<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EmployeeDirectoryController;
use App\Http\Controllers\EmployeeAssignmentController;
use App\Http\Controllers\EmployeeReassignmentController;
use App\Http\Controllers\WorkLogController;

/*
|--------------------------------------------------------------------------
| Employee Service API Routes
|--------------------------------------------------------------------------
*/

Route::get('/health', function () {
    return response()->json(['status' => 'healthy', 'service' => 'employee-service']);
});

// Employee Directory & Options
Route::get('/departments', [EmployeeDirectoryController::class, 'getDepartments']);
Route::get('/assignable-employees', [EmployeeDirectoryController::class, 'assignableEmployees']);

// Authenticated Routes
Route::middleware(['auth.subsystem'])->group(function () {
    // Employee Profile & Workbenches
    Route::get('/employee/profile', [EmployeeDirectoryController::class, 'employeeProfile']);
    Route::get('/employee-tickets', [EmployeeAssignmentController::class, 'employeeTickets']);
    Route::get('/employee/tickets/internal', [EmployeeAssignmentController::class, 'internalTickets']);

    // Ticket Assignments & Acceptance
    Route::post('/tickets/{ticketId}/assign', [EmployeeAssignmentController::class, 'assignTicket']);
    Route::patch('/tickets/{ticketId}/accept', [EmployeeAssignmentController::class, 'acceptTicket']);
    Route::post('/tickets/{ticketId}/employee-update', [EmployeeAssignmentController::class, 'employeeUpdate']);

    // Reassignment Requests & Approvals
    Route::post('/tickets/{ticketId}/reassign-request', [EmployeeReassignmentController::class, 'reassignRequest']);
    Route::post('/tickets/{ticketId}/reassign-respond', [EmployeeReassignmentController::class, 'reassignRespond']);
    Route::get('/reassignment-requests', [EmployeeReassignmentController::class, 'getReassignmentRequests']);

    // Work Logs
    Route::get('/employee/worklogs', [WorkLogController::class, 'index']);
    Route::post('/employee/worklogs', [WorkLogController::class, 'store']);
    Route::get('/employee/worklogs/export', [WorkLogController::class, 'export']);
});
