<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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

use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\PredictiveAnalyticsController;

Route::middleware('auth:api')->get('/user', function (Request $request) {
    return $request->user();
});

// Direct routes matching Nginx gateway rewrite: /api/ticketing/analytics/(.*) -> /api/$1
Route::post('/feedback', [FeedbackController::class, 'store']);
Route::get('/feedback/ticket/{ticketId}', [FeedbackController::class, 'getByTicket']);
Route::get('/csat-stats', [FeedbackController::class, 'csatStats']);
Route::get('/predictive-metrics', [PredictiveAnalyticsController::class, 'getPredictiveMetrics']);

// Prefix routes matching direct service /api/analytics requests
Route::prefix('analytics')->group(function () {
    Route::post('/feedback', [FeedbackController::class, 'store']);
    Route::get('/feedback/ticket/{ticketId}', [FeedbackController::class, 'getByTicket']);
    Route::get('/csat-stats', [FeedbackController::class, 'csatStats']);
    Route::get('/predictive-metrics', [PredictiveAnalyticsController::class, 'getPredictiveMetrics']);
});

