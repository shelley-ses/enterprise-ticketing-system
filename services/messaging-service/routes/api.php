<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MessageController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::post('/internal/tickets/{ticket_id}/messages', [MessageController::class, 'storeInternal']);

Route::middleware('auth.subsystem')->group(function () {
    Broadcast::routes();
    Route::get('/tickets/{ticket_id}/messages', [MessageController::class, 'index']);
    Route::post('/tickets/{ticket_id}/messages', [MessageController::class, 'store']);
    Route::put('/tickets/{ticket_id}/messages/{message_id}', [MessageController::class, 'update']);
    Route::delete('/tickets/{ticket_id}/messages/{message_id}', [MessageController::class, 'destroy']);
});
