<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AiChatController;
use App\Http\Controllers\KbArticleController;

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
Route::delete('/conversations/{id}/messages/{messageId}', [AiChatController::class, 'deleteMessage']);
Route::post('/tickets', [AiChatController::class, 'markTicketCreated']);

// Knowledge Base Article & RAG Lifecycle Routes
$registerKbRoutes = function () {
    Route::get('/articles', [KbArticleController::class, 'index']);
    Route::get('/articles/categories', [KbArticleController::class, 'categories']);
    Route::post('/articles', [KbArticleController::class, 'store']);
    Route::get('/articles/{id}', [KbArticleController::class, 'show']);
    Route::put('/articles/{id}', [KbArticleController::class, 'update']);
    Route::patch('/articles/{id}', [KbArticleController::class, 'update']);
    Route::post('/articles/{id}/publish', [KbArticleController::class, 'publish']);
    Route::post('/articles/{id}/archive', [KbArticleController::class, 'archive']);
    Route::post('/articles/{id}/reindex', [KbArticleController::class, 'reindex']);
    Route::delete('/articles/{id}', [KbArticleController::class, 'destroy']);
};

$registerKbRoutes();

// Also alias under /kb for direct gateway routing
Route::prefix('kb')->group($registerKbRoutes);
