<?php

use App\Http\Controllers\EmailConfigurationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Configuration Service API Routes
|--------------------------------------------------------------------------
*/

// Public endpoint to obtain ephemeral RSA encryption key
Route::get('/encryption-key', [EmailConfigurationController::class, 'getEncryptionKey']);

// Core configuration endpoints
$registerRoutes = function () {
    Route::get('/encryption-key', [EmailConfigurationController::class, 'getEncryptionKey']);
    Route::get('/email', [EmailConfigurationController::class, 'getConfiguration']);
    Route::post('/email', [EmailConfigurationController::class, 'saveConfiguration'])->middleware('decrypt.rsa:apiKey');
    Route::put('/email/api-key', [EmailConfigurationController::class, 'updateApiKey'])->middleware('decrypt.rsa:apiKey');
    Route::delete('/email', [EmailConfigurationController::class, 'removeConfiguration']);
    Route::post('/email/test', [EmailConfigurationController::class, 'sendTestEmail'])->middleware('decrypt.rsa:apiKey');
    Route::post('/email/dispatch', [EmailConfigurationController::class, 'dispatchEmail']);
};

// Direct routes (e.g. proxied with rewrite)
$registerRoutes();

// Grouped routes under /configuration/
Route::prefix('configuration')->group($registerRoutes);

// Grouped routes under /ticketing/configuration/
Route::prefix('ticketing/configuration')->group($registerRoutes);
