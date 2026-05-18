<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;

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

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::get('/ticket-form-options', [TicketController::class, 'formOptions']);
Route::get('/customer-dashboard', [TicketController::class, 'customerDashboard']);
Route::get('/cs-dashboard', [TicketController::class, 'csDashboard'])->middleware('no-cache');
Route::get('/cs-incoming', [TicketController::class, 'csIncoming'])->middleware('no-cache');
Route::get('/departments', [TicketController::class, 'getDepartments']);
Route::get('/assignable-employees', [TicketController::class, 'assignableEmployees']);
Route::post('/tickets/{ticketId}/assign', [TicketController::class, 'assignTicket'])->middleware('auth:sanctum');
Route::patch('/tickets/{ticketId}/accept', [TicketController::class, 'acceptTicket'])->middleware('auth:sanctum');
Route::patch('/tickets/{ticketId}', [TicketController::class, 'updateTicket'])->middleware('auth:sanctum');
Route::get('/employee-tickets', [TicketController::class, 'employeeTickets']);
Route::post('/tickets', [TicketController::class, 'store']);
