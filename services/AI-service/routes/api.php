<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AiChatController;

/*
|--------------------------------------------------------------------------
| API Routes for AI-service
|--------------------------------------------------------------------------
*/

Route::middleware('auth:api')->get('/user', function (Request $request) {
    return $request->user();
});

// AI Chat & Support Triage Routes
Route::post('/chat', [AiChatController::class, 'chat']);
Route::get('/conversations', [AiChatController::class, 'conversations']);
Route::get('/conversations/{id}', [AiChatController::class, 'showConversation']);
Route::delete('/conversations/{id}', [AiChatController::class, 'deleteConversation']);
Route::post('/tickets', [AiChatController::class, 'markTicketCreated']);
