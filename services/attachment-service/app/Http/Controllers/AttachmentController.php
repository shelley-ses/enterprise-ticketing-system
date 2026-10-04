<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\TicketAttachment;
use App\Models\ProofOfCompletion;
use App\Services\ClamAVScanner;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class AttachmentController extends Controller
{
    protected ClamAVScanner $scanner;

    public function __construct(ClamAVScanner $scanner)
    {
        $this->scanner = $scanner;
    }

    /**
     * Retrieve active file upload constraints and malware scanning toggle from configuration-service.
     * Caches locally for 30s for ultra-fast performance with seamless fallback.
     */
    protected function getFileLimitsConfig(): array
    {
        $defaults = [
            'maxFileSizeMB' => 15,
            'allowedFileTypes' => ['PDF', 'DOCX', 'DOC', 'JPG', 'JPEG', 'PNG'],
            'maxFileCount' => 5,
            'malwareScanningEnabled' => true,
        ];

        try {
            return Cache::remember('ticket:config:file_limits', 30, function () use ($defaults) {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $response = Http::timeout(5)->get("{$configUrl}/api/ticket-configurations/file_limits");

                if ($response->successful()) {
                    $json = $response->json();
                    $val = $json['value'] ?? $json;
                    if (is_array($val)) {
                        return [
                            'maxFileSizeMB' => isset($val['maxFileSizeMB']) ? (float)$val['maxFileSizeMB'] : $defaults['maxFileSizeMB'],
                            'allowedFileTypes' => isset($val['allowedFileTypes']) && is_array($val['allowedFileTypes'])
                                ? array_values(array_unique(array_map('strtoupper', $val['allowedFileTypes'])))
                                : $defaults['allowedFileTypes'],
                            'maxFileCount' => isset($val['maxFileCount']) ? (int)$val['maxFileCount'] : $defaults['maxFileCount'],
                            'malwareScanningEnabled' => isset($val['malwareScanningEnabled']) ? (bool)$val['malwareScanningEnabled'] : $defaults['malwareScanningEnabled'],
                        ];
                    }
                }

                return $defaults;
            });
        } catch (\Throwable $e) {
            Log::warning("Failed to fetch file limits from configuration-service: " . $e->getMessage());
            return $defaults;
        }
    }

    /**
     * Upload and scan files enforcing system-wide file upload limits.
     * Applies only to new file uploads; historical ticket attachments are preserved.
     */
    public function upload(Request $request)
    {
        $config = $this->getFileLimitsConfig();
        $maxFileSizeMB = (float) ($config['maxFileSizeMB'] ?? 15);
        $maxFileCount = (int) ($config['maxFileCount'] ?? 5);
        $allowedFileTypes = $config['allowedFileTypes'] ?? ['PDF', 'DOCX', 'DOC', 'JPG', 'JPEG', 'PNG'];
        $malwareScanningEnabled = (bool) ($config['malwareScanningEnabled'] ?? true);

        $request->validate([
            'attachments' => 'required|array',
            'is_proof' => 'nullable|string' // 'true' or 'false'
        ]);

        $files = $request->file('attachments');
        if (!is_array($files)) {
            return response()->json([
                'message' => 'Attachments must be provided as an array.',
                'errors' => ['attachments' => ['Attachments must be provided as an array.']]
            ], 422);
        }

        // 1. Enforce file count restriction
        if (count($files) > $maxFileCount) {
            return response()->json([
                'message' => "Upload limit exceeded: You can upload a maximum of {$maxFileCount} files at a time.",
                'errors' => [
                    'attachments' => ["A maximum of {$maxFileCount} files can be uploaded at a time."]
                ]
            ], 422);
        }

        $maxFileSizeBytes = (int) round($maxFileSizeMB * 1024 * 1024);
        $allowedUpper = array_map('strtoupper', $allowedFileTypes);

        // 2. Pre-validate size and allowed types on each file before saving or scanning
        foreach ($files as $file) {
            if (!$file || !$file->isValid()) {
                return response()->json([
                    'message' => 'Invalid file upload encountered.',
                    'errors' => ['attachments' => ['One or more files failed to upload cleanly.']]
                ], 422);
            }

            if ($file->getSize() > $maxFileSizeBytes) {
                $fileName = $file->getClientOriginalName();
                return response()->json([
                    'message' => "File '{$fileName}' exceeds the maximum allowed size of {$maxFileSizeMB} MB.",
                    'errors' => [
                        'attachments' => ["File '{$fileName}' exceeds the limit of {$maxFileSizeMB} MB."]
                    ]
                ], 422);
            }

            $ext = strtoupper($file->getClientOriginalExtension());
            if (!in_array($ext, $allowedUpper, true)) {
                $fileName = $file->getClientOriginalName();
                return response()->json([
                    'message' => "File type '.{$ext}' is not permitted for '{$fileName}'. Allowed formats: " . implode(', ', $allowedFileTypes) . ".",
                    'errors' => [
                        'attachments' => ["File extension '.{$ext}' is not permitted."]
                    ]
                ], 422);
            }
        }

        $isProof = filter_var($request->input('is_proof', false), FILTER_VALIDATE_BOOLEAN);
        $uploaded = [];

        try {
            foreach ($files as $file) {
                $origName = $file->getClientOriginalName();
                $safeName = basename(preg_replace('/[^a-zA-Z0-9_.-]/', '_', $origName));
                $uuid = Str::uuid()->toString();

                // Save temporarily to perform scan on disk path
                $tempPath = $file->storeAs("temp-scans", "{$uuid}_{$safeName}", 'local');
                $fullTempPath = storage_path("app/{$tempPath}");

                // 3. Conditional Malware Scanning via ClamAV
                if ($malwareScanningEnabled) {
                    try {
                        $isClean = $this->scanner->scan($fullTempPath);
                    } catch (\Exception $e) {
                        @unlink($fullTempPath);
                        Log::error("ClamAV Scanning failed with exception: " . $e->getMessage());
                        return response()->json([
                            'message' => 'Unable to verify file security. Please try again later.'
                        ], 500);
                    }

                    if (!$isClean) {
                        @unlink($fullTempPath);
                        return response()->json([
                            'message' => 'Security threat detected: We detected a potential virus or malware in the uploaded file: "' . $origName . '". This upload has been blocked for safety.',
                            'virus_detected' => true,
                            'file_name' => $origName
                        ], 422);
                    }
                } else {
                    Log::info("Malware scanning disabled by system configuration. Bypassing ClamAV scan for {$origName}");
                }

                // Move from local temp scan to public disk pending folder
                $pendingPath = "ticket-attachments/pending/{$uuid}/{$safeName}";
                Storage::disk('public')->put($pendingPath, file_get_contents($fullTempPath));
                @unlink($fullTempPath); // delete local temp file

                if ($isProof) {
                    $record = ProofOfCompletion::create([
                        'assignment_ID' => null,
                        'file_name' => $safeName,
                        'file_path' => $pendingPath,
                        'file_type' => $file->getClientMimeType(),
                        'file_size' => $file->getSize(),
                        'uploaded_at' => now(),
                    ]);

                    $uploaded[] = [
                        'id' => $record->proof_ID,
                        'name' => $safeName,
                        'url' => '/storage/' . $pendingPath,
                        'is_proof' => true
                    ];
                } else {
                    $record = TicketAttachment::create([
                        'ticket_id' => null,
                        'file_name' => $safeName,
                        'file_path' => $pendingPath,
                        'file_type' => $file->getClientMimeType(),
                        'uploaded_at' => now(),
                    ]);

                    $uploaded[] = [
                        'id' => $record->attachment_id,
                        'name' => $safeName,
                        'url' => '/storage/' . $pendingPath,
                        'is_proof' => false
                    ];
                }
            }

            return response()->json([
                'message' => 'Files uploaded successfully.',
                'attachments' => $uploaded
            ], 200);

        } catch (\Exception $e) {
            Log::error("Attachment upload exception: " . $e->getMessage());
            return response()->json(['message' => 'Upload failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Bind pending attachments to a Ticket or Assignment.
     */
    public function bind(Request $request)
    {
        $request->validate([
            'ticket_id' => 'nullable|integer',
            'assignment_id' => 'nullable|integer',
            'attachment_ids' => 'required|array',
            'attachment_ids.*' => 'integer',
            'is_proof' => 'nullable|boolean'
        ]);

        $isProof = $request->input('is_proof', false);
        $ticketId = $request->input('ticket_id');
        $assignmentId = $request->input('assignment_id');
        $attachmentIds = $request->input('attachment_ids');

        $bound = [];

        if ($isProof) {
            if (!$assignmentId) {
                return response()->json(['message' => 'assignment_id is required for proof binding.'], 400);
            }

            $attachments = ProofOfCompletion::whereIn('proof_ID', $attachmentIds)
                ->whereNull('assignment_ID')
                ->get();

            foreach ($attachments as $att) {
                $oldPath = $att->file_path;
                $newPath = "ticket-attachments/proofs/{$assignmentId}/" . basename($oldPath);

                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->move($oldPath, $newPath);
                }

                $att->update([
                    'assignment_ID' => $assignmentId,
                    'file_path' => $newPath
                ]);

                $bound[] = $att;
            }
        } else {
            if (!$ticketId) {
                return response()->json(['message' => 'ticket_id is required for ticket attachment binding.'], 400);
            }

            $attachments = TicketAttachment::whereIn('attachment_id', $attachmentIds)
                ->whereNull('ticket_id')
                ->get();

            foreach ($attachments as $att) {
                $oldPath = $att->file_path;
                $newPath = "ticket-attachments/{$ticketId}/" . basename($oldPath);

                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->move($oldPath, $newPath);
                }

                $att->update([
                    'ticket_id' => $ticketId,
                    'file_path' => $newPath
                ]);

                $bound[] = $att;
            }
        }

        return response()->json([
            'message' => 'Attachments bound successfully.',
            'bound_count' => count($bound),
            'file_names' => collect($bound)->pluck('file_name')->all()
        ], 200);
    }

    /**
     * Retrieve attachments for a Ticket or Assignment.
     */
    public function index(Request $request)
    {
        $ticketId = $request->query('ticket_id');
        $assignmentId = $request->query('assignment_id');

        if ($ticketId) {
            $attachments = TicketAttachment::where('ticket_id', $ticketId)->get();
            return response()->json([
                'attachments' => $attachments->map(function ($row) {
                    return [
                        'id' => $row->attachment_id,
                        'name' => $row->file_name,
                        'url' => str_starts_with($row->file_path, 'http') ? $row->file_path : '/storage/' . $row->file_path,
                        'file_type' => $row->file_type,
                        'uploaded_at' => $row->uploaded_at
                    ];
                })
            ]);
        }

        if ($assignmentId) {
            $attachments = ProofOfCompletion::where('assignment_ID', $assignmentId)->get();
            return response()->json([
                'attachments' => $attachments->map(function ($row) {
                    return [
                        'id' => $row->proof_ID,
                        'name' => $row->file_name,
                        'url' => str_starts_with($row->file_path, 'http') ? $row->file_path : '/storage/' . $row->file_path,
                        'file_type' => $row->file_type,
                        'size' => $row->file_size,
                        'uploaded_at' => $row->uploaded_at
                    ];
                })
            ]);
        }

        return response()->json(['message' => 'Specify ticket_id or assignment_id.'], 400);
    }

    /**
     * Delete an attachment.
     */
    public function destroy(Request $request, $id)
    {
        $isProof = filter_var($request->query('is_proof', false), FILTER_VALIDATE_BOOLEAN);

        if ($isProof) {
            $attachment = ProofOfCompletion::find($id);
            if ($attachment) {
                if ($attachment->file_path) {
                    Storage::disk('public')->delete($attachment->file_path);
                }
                $attachment->delete();
                return response()->json(['message' => 'Proof file deleted.']);
            }
        } else {
            $attachment = TicketAttachment::find($id);
            if ($attachment) {
                if ($attachment->file_path) {
                    Storage::disk('public')->delete($attachment->file_path);
                }
                $attachment->delete();
                return response()->json(['message' => 'Attachment file deleted.']);
            }
        }

        return response()->json(['message' => 'Attachment not found.'], 404);
    }

    /**
     * Serve an attachment directly with correct Content-Type for preview.
     */
    public function serve(Request $request, $path)
    {
        $cleanPath = ltrim($path, '/');
        if (!Storage::disk('public')->exists($cleanPath)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $fullPath = Storage::disk('public')->path($cleanPath);
        $mime = Storage::disk('public')->mimeType($cleanPath) ?: 'application/octet-stream';

        return response()->file($fullPath, [
            'Content-Type' => $mime,
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Download an attachment with proper Content-Disposition header.
     */
    public function download(Request $request, $path)
    {
        $cleanPath = ltrim($path, '/');
        if (!Storage::disk('public')->exists($cleanPath)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $filename = basename($cleanPath);
        return Storage::disk('public')->download($cleanPath, $filename, [
            'Access-Control-Allow-Origin' => '*',
        ]);
    }
}
