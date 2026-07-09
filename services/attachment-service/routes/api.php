<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AttachmentController;

Route::post('/upload', [AttachmentController::class, 'upload']);
Route::post('/bind', [AttachmentController::class, 'bind']);
Route::get('/attachments', [AttachmentController::class, 'index']);
Route::delete('/attachments/{id}', [AttachmentController::class, 'destroy']);
