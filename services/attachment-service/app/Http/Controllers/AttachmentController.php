<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\TicketAttachment;
use App\Models\ProofOfCompletion;
use App\Services\ClamAVScanner;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AttachmentController extends Controller
{
    protected ClamAVScanner $scanner;

    public function __construct(ClamAVScanner $scanner)
    {
        $this->scanner = $scanner;
    }

    /**
     * Upload and scan files.
     */
    public function upload(Request $request)
    {
        $request->validate([
            'attachments' => 'required|array',
            'attachments.*' => 'file|max:15360', // Max 15MB
            'is_proof' => 'nullable|string' // 'true' or 'false'
        ]);

        $isProof = filter_var($request->input('is_proof', false), FILTER_VALIDATE_BOOLEAN);
        $uploaded = [];

        try {
            foreach ($request->file('attachments') as $file) {
                if (!$file->isValid()) {
                    return response()->json(['message' => 'Invalid file upload.'], 422);
                }

                $origName = $file->getClientOriginalName();
                $safeName = basename(preg_replace('/[^a-zA-Z0-9_.-]/', '_', $origName));
                $uuid = Str::uuid()->toString();

                // Save temporarily to perform scan on disk path
                $tempPath = $file->storeAs("temp-scans", "{$uuid}_{$safeName}", 'local');
                $fullTempPath = storage_path("app/{$tempPath}");

                // Scan the file
                try {
                    $isClean = $this->scanner->scan($fullTempPath);
                } catch (\Exception $e) {
                    // Cleanup temp file
                    @unlink($fullTempPath);
                    Log::error("ClamAV Scanning failed with exception: " . $e->getMessage());
                    return response()->json([
                        'message' => 'Unable to verify file security. Please try again later.'
                    ], 500);
                }

                if (!$isClean) {
                    // Cleanup temp file
                    @unlink($fullTempPath);
                    return response()->json([
                        'message' => 'Security threat detected: We detected a potential virus or malware in the uploaded file: "' . $origName . '". This upload has been blocked for safety.',
                        'virus_detected' => true,
                        'file_name' => $origName
                    ], 422);
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
}
