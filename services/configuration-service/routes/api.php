<?php

use App\Http\Controllers\EmailConfigurationController;
use App\Http\Controllers\EmailTemplateController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Configuration Service API Routes
|--------------------------------------------------------------------------
*/

// Core configuration endpoints
$registerRoutes = function () {
    // Ephemeral RSA encryption key
    Route::get('/encryption-key', [EmailConfigurationController::class, 'getEncryptionKey']);

    // Email delivery configuration
    Route::get('/email', [EmailConfigurationController::class, 'getConfiguration']);
    Route::post('/email', [EmailConfigurationController::class, 'saveConfiguration'])->middleware('decrypt.rsa:apiKey');
    Route::put('/email', [EmailConfigurationController::class, 'updateConfiguration']);
    Route::patch('/email', [EmailConfigurationController::class, 'updateConfiguration']);
    Route::put('/email/api-key', [EmailConfigurationController::class, 'updateApiKey'])->middleware('decrypt.rsa:apiKey');
    Route::delete('/email', [EmailConfigurationController::class, 'removeConfiguration']);
    Route::post('/email/test', [EmailConfigurationController::class, 'sendTestEmail'])->middleware('decrypt.rsa:apiKey');
    Route::post('/email/dispatch', [EmailConfigurationController::class, 'dispatchEmail']);
    Route::post('/email/dispatch-event', [EmailConfigurationController::class, 'dispatchEventEmail']);

    // Email templates (event-driven configurable templates)
    Route::get('/email-templates', [EmailTemplateController::class, 'index']);
    Route::get('/email-templates/{eventKey}', [EmailTemplateController::class, 'show']);
    Route::put('/email-templates/{eventKey}', [EmailTemplateController::class, 'update']);
    Route::patch('/email-templates/{eventKey}', [EmailTemplateController::class, 'update']);
    Route::post('/email-templates/{eventKey}/toggle', [EmailTemplateController::class, 'toggle']);
    Route::post('/email-templates/{eventKey}/reset', [EmailTemplateController::class, 'reset']);
    Route::post('/email-templates/{eventKey}/test', [EmailTemplateController::class, 'sendTestTemplateEmail']);
};

// Public RSA encryption key endpoint (no prefix)
Route::get('/encryption-key', [EmailConfigurationController::class, 'getEncryptionKey']);

// Direct routes (proxied with rewrite strips the prefix)
$registerRoutes();

// Grouped routes under /configuration/
Route::prefix('configuration')->group($registerRoutes);

// Grouped routes under /ticketing/configuration/
Route::prefix('ticketing/configuration')->group($registerRoutes);
