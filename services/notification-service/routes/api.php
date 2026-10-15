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

Route::middleware('auth:api')->get('/user', function (Request $request) {
    return $request->user();
});

Route::post('/security-alerts', function (Request $request) {
    $payload = $request->all();
    \Illuminate\Support\Facades\Log::warning("Notification Service received Security Alert: " . json_encode($payload));

    try {
        if (\Illuminate\Support\Facades\Schema::hasTable('notifications')) {
            $adminIds = \Illuminate\Support\Facades\DB::table('employees')
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(role)'), ['superadmin', 'super admin', 'admin'])
                ->pluck('emp_id');

            $fileInfo = $payload['file'] ?? [];
            $uploader = $payload['uploader'] ?? [];
            $threat = $fileInfo['threat_name'] ?? 'Detected Threat';
            $fileName = $fileInfo['original_name'] ?? 'Unknown File';
            $uploaderEmail = $uploader['email'] ?? 'Unknown';

            foreach ($adminIds as $adminId) {
                \Illuminate\Support\Facades\DB::table('notifications')->insert([
                    'recipient_id'   => $adminId,
                    'recipient_type' => 'employee',
                    'title'          => 'Security Alert: Malware Detected on Upload',
                    'message'        => "Potential threat '{$threat}' detected in file '{$fileName}' uploaded by {$uploaderEmail}. The file was quarantined.",
                    'ticket_id'      => $payload['ticket_id'] ?? null,
                    'data'           => json_encode($payload),
                    'is_read'        => false,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ]);
            }
        }
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning("Notification Service failed to record security notification: " . $e->getMessage());
    }

    return response()->json([
        'success' => true,
        'message' => 'Security alert received and processed successfully.',
    ], 200);
});
