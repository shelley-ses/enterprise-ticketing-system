<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\WorkLogController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth.subsystem')->get('/user', function (Request $request) {
    return $request->user();
});

Route::get('/ticket-form-options', [TicketController::class, 'formOptions']);
Route::get('/customer-dashboard', [TicketController::class, 'customerDashboard']);
Route::get('/cs-dashboard', [TicketController::class, 'csDashboard'])->middleware('no-cache');
Route::get('/cs-incoming', [TicketController::class, 'csIncoming'])->middleware('no-cache');
Route::get('/departments', [TicketController::class, 'getDepartments']);
Route::get('/assignable-employees', [TicketController::class, 'assignableEmployees']);
Route::middleware('auth.subsystem')->group(function () {
    Route::post('/tickets/internal', [TicketController::class, 'storeInternalTicket']);
    Route::post('/tickets/{ticketId}/assign', [TicketController::class, 'assignTicket']);
    Route::patch('/tickets/{ticketId}/accept', [TicketController::class, 'acceptTicket']);
    Route::get('/tickets/{ticketId}', [TicketController::class, 'show']);
    Route::post('/tickets/{ticketId}/employee-update', [TicketController::class, 'employeeUpdate']);
    Route::patch('/tickets/{ticketId}', [TicketController::class, 'updateTicket']);
    Route::get('/employee-tickets', [TicketController::class, 'employeeTickets']);
    Route::post('/tickets/{ticketId}/reassign-request', [TicketController::class, 'reassignRequest']);
    Route::post('/tickets/{ticketId}/reassign-respond', [TicketController::class, 'reassignRespond']);
    Route::get('/reassignment-requests', [TicketController::class, 'reassignmentRequests']);
    Route::get('/notifications', [TicketController::class, 'getNotifications']);
    Route::patch('/notifications/read-all', [TicketController::class, 'markNotificationsRead']);
    Route::patch('/notifications/{id}/read', [TicketController::class, 'markNotificationRead']);
    Route::delete('/tickets/{ticketId}', [TicketController::class, 'destroy']);
    Route::get('/employee/worklogs', [WorkLogController::class, 'index']);
    Route::get('/employee/worklogs/export', [WorkLogController::class, 'export']);
    Route::get('/employee/profile', [TicketController::class, 'employeeProfile']);
    Route::get('/employee/tickets/internal', [TicketController::class, 'internalTickets']);
});
Route::post('/tickets', [TicketController::class, 'store']);
