<?php

namespace App\Http\Controllers;

use App\Services\TicketDraftService;
use Illuminate\Http\Request;

class TicketDraftController extends Controller
{
    protected TicketDraftService $draftService;

    public function __construct(TicketDraftService $draftService)
    {
        $this->draftService = $draftService;
    }

    protected function resolveClientId(Request $request): ?int
    {
        $user = $request->user();
        if ($user && isset($user->id)) {
            return (int) $user->id;
        }

        if ($request->filled('client_id')) {
            return (int) $request->input('client_id');
        }

        if ($request->filled('created_by')) {
            return (int) $request->input('created_by');
        }

        return 1;
    }

    public function saveDraft(Request $request)
    {
        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => 'Unauthorized client.'], 401);
        }

        $draftId = $request->input('draft_id') ? (int) $request->input('draft_id') : null;

        $result = $this->draftService->saveDraft($clientId, $request->all(), $draftId);

        return response()->json($result, $result['status'] ?? 200);
    }

    public function listDrafts(Request $request)
    {
        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => 'Unauthorized client.'], 401);
        }

        $drafts = $this->draftService->getDrafts($clientId);

        return response()->json([
            'drafts' => $drafts,
            'total' => count($drafts),
        ], 200);
    }

    public function getDraft(Request $request, $id)
    {
        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => 'Unauthorized client.'], 401);
        }

        $draft = $this->draftService->getDraft($clientId, (int) $id);
        if (!$draft) {
            return response()->json([
                'error' => 'DRAFT_NOT_FOUND',
                'message' => 'Draft not found or you do not have permission to view it.',
            ], 404);
        }

        return response()->json([
            'draft' => $draft,
        ], 200);
    }

    public function deleteDraft(Request $request, $id)
    {
        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => 'Unauthorized client.'], 401);
        }

        $success = $this->draftService->deleteDraft($clientId, (int) $id);
        if (!$success) {
            return response()->json([
                'error' => 'DRAFT_NOT_FOUND',
                'message' => 'Draft not found or already deleted.',
            ], 404);
        }

        return response()->json([
            'message' => 'Draft deleted successfully.',
        ], 200);
    }
}
