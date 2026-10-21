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
        if ($user) {
            $val = $user->client_ID ?? $user->client_id ?? $user->id ?? $user->emp_id;
            if ($val) {
                return (int) $val;
            }
        }

        foreach (['client_id', 'client_ID', 'clientId', 'created_by', 'user_id', 'id'] as $key) {
            if ($request->filled($key)) {
                return (int) $request->input($key);
            }
        }

        if ($request->hasHeader('X-Client-Id')) {
            $hVal = (int) $request->header('X-Client-Id');
            if ($hVal > 0) return $hVal;
        }

        if ($request->hasHeader('X-User-Id')) {
            $hVal = (int) $request->header('X-User-Id');
            if ($hVal > 0) return $hVal;
        }

        // Try auth('api') guard
        try {
            $apiUser = auth('api')->user();
            if ($apiUser) {
                $val = $apiUser->client_ID ?? $apiUser->client_id ?? $apiUser->id ?? $apiUser->emp_id;
                if ($val) {
                    return (int) $val;
                }
            }
        } catch (\Throwable $e) {}

        // Fallback: decode JWT bearer payload if present or inspect Sanctum token
        $bearer = $request->bearerToken();
        if ($bearer) {
            if (str_contains($bearer, '.')) {
                $parts = explode('.', $bearer);
                if (count($parts) === 3) {
                    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
                    if (is_array($payload)) {
                        foreach (['sub', 'client_id', 'client_ID', 'user_id', 'id'] as $claim) {
                            if (!empty($payload[$claim])) {
                                return (int) $payload[$claim];
                            }
                        }
                    }
                }
            } elseif (str_contains($bearer, '|')) {
                try {
                    [$tokenId] = explode('|', $bearer, 2);
                    $tokenRecord = \Illuminate\Support\Facades\DB::table('personal_access_tokens')->where('id', $tokenId)->first();
                    if ($tokenRecord && !empty($tokenRecord->tokenable_id)) {
                        return (int) $tokenRecord->tokenable_id;
                    }
                } catch (\Throwable $e) {}
            }
        }

        return null;
    }

    public function saveDraft(Request $request)
    {
        $clientId = $this->resolveClientId($request);
        if (!$clientId) {
            return response()->json(['message' => 'Unauthorized client. Valid credentials required.'], 401);
        }

        $rawDraftId = $request->input('draft_id', $request->input('id'));
        $draftId = (!empty($rawDraftId) && is_numeric($rawDraftId)) ? (int) $rawDraftId : null;

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
