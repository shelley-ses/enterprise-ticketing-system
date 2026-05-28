<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

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

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:ip_auth');
Route::post('/auth/refresh', [AuthController::class, 'refresh'])->middleware('throttle:ip_auth');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:ip_auth');
Route::post('/forgot-password/verify', [AuthController::class, 'verifyForgotPasswordOtp'])->middleware('throttle:ip_auth');
Route::post('/reset-password', [AuthController::class, 'resetForgotPassword'])->middleware('throttle:ip_auth');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/heartbeat', [AuthController::class, 'heartbeat']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/employee-statuses', [AuthController::class, 'employeeStatuses']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});
