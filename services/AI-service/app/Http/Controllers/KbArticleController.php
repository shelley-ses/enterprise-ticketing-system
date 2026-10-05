<?php

namespace App\Http\Controllers;

use App\Exceptions\ArticleMissingEmbeddingsException;
use App\Models\KbArticle;
use App\Models\KbChunk;
use App\Models\KbEmbedding;
use App\Services\RagService;
use App\Services\AuditLoggingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class KbArticleController extends Controller
{
    protected RagService $ragService;
    protected AuditLoggingService $auditLoggingService;

    public function __construct(RagService $ragService, AuditLoggingService $auditLoggingService)
    {
        $this->ragService = $ragService;
        $this->auditLoggingService = $auditLoggingService;
    }

    /**
     * Resolves the authenticated user, role, and acting administrator name.
     */
    protected function resolveActor(Request $request): array
    {
        $authHeader = $request->header('Authorization');
        $actorName = $request->input('actor') ?? $request->header('X-Actor-Name') ?? 'Super Admin';
        $role = 'guest';
        $isSuperAdmin = false;

        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
            $parts = explode('.', $token);
            if (count($parts) === 3) {
                $payloadB64 = $parts[1];
                $remainder = strlen($payloadB64) % 4;
                if ($remainder) {
                    $payloadB64 .= str_repeat('=', 4 - $remainder);
                }
                $payloadJson = base64_decode(strtr($payloadB64, '-_', '+/'));
                $payload = json_decode($payloadJson, true);

                if (is_array($payload)) {
                    $tokenRole = strtolower(str_replace([' ', '_', '-'], '', (string) ($payload['role'] ?? '')));
                    $tokenDept = strtolower(str_replace([' ', '_', '-'], '', (string) ($payload['department'] ?? '')));
                    $role = $tokenRole ?: 'employee';

                    $isSuperAdmin = in_array($tokenRole, ['superadmin', 'systemadministrator', 'admin'])
                        || in_array($tokenDept, ['superadmin', 'admin']);

                    $tokenName = trim(($payload['first_name'] ?? '') . ' ' . ($payload['last_name'] ?? ''));
                    if (empty($tokenName)) {
                        $tokenName = $payload['name'] ?? $payload['email'] ?? null;
                    }
                    if (!empty($tokenName)) {
                        $actorName = $tokenName;
                    }
                }
            }
        } elseif ($user = (auth('api')->user() ?? $request->user())) {
            $userRole = strtolower(str_replace([' ', '_', '-'], '', (string) ($user->role ?? '')));
            $userDept = strtolower(str_replace([' ', '_', '-'], '', (string) ($user->department ?? '')));
            $role = $userRole ?: 'employee';
            $isSuperAdmin = in_array($userRole, ['superadmin', 'systemadministrator', 'admin'])
                || in_array($userDept, ['superadmin', 'admin']);
            $actorName = $user->name ?? $user->email ?? 'Super Admin';
        }

        // Internal token check
        $internalToken = $request->header('X-Internal-Token');
        $expectedToken = env('INTERNAL_TOKEN');
        if (!empty($internalToken) && !empty($expectedToken) && hash_equals((string) $expectedToken, (string) $internalToken)) {
            $isSuperAdmin = true;
            $role = 'superadmin';
            $actorName = $request->input('actor') ?? 'Internal Service';
        }

        return [
            'actor' => $actorName ?: 'Super Admin',
            'role' => $role,
            'is_super_admin' => $isSuperAdmin,
        ];
    }

    /**
     * Format a KbArticle model for standardized frontend consumption.
     */
    public function formatArticle(KbArticle $article): array
    {
        $publishedAt = $article->published_at ? $article->published_at->format('Y-m-d H:i:s') : null;
        $archivedAt = $article->archived_at ? $article->archived_at->format('Y-m-d H:i:s') : null;
        $createdAt = $article->created_at ? $article->created_at->format('Y-m-d') : now()->format('Y-m-d');

        return [
            'id' => (int) $article->id,
            'title' => (string) $article->title,
            'category' => (string) ($article->category ?? 'Troubleshooting Guides'),
            'machine' => $article->machine,
            'version' => (string) ($article->version ?? '1.0'),
            'file_type' => (string) ($article->file_type ?? 'PDF'),
            'fileType' => (string) ($article->file_type ?? 'PDF'),
            'uploaded_by' => (string) ($article->uploaded_by ?? 'Super Admin'),
            'uploadedBy' => (string) ($article->uploaded_by ?? 'Super Admin'),
            'uploadDate' => $createdAt,
            'upload_date' => $createdAt,
            'size' => (string) ($article->size ?? '1.5 MB'),
            'status' => $article->status === 'Published' ? 'Ready' : $article->status,
            'publish_state' => $article->status,
            'publishState' => $article->status,
            'processing_status' => (string) ($article->processing_status ?? 'Ready for AI Search'),
            'processingStatus' => (string) ($article->processing_status ?? 'Ready for AI Search'),
            'tags' => is_array($article->tags) ? $article->tags : [],
            'description' => (string) ($article->description ?? ''),
            'content' => (string) ($article->content ?? ''),
            'history' => is_array($article->history) ? $article->history : [],
            'published_at' => $publishedAt,
            'archived_at' => $archivedAt,
            'chunks_count' => $article->chunks()->count(),
            'embeddings_count' => $article->embeddings()->count(),
            'active_embeddings_count' => $article->embeddings()->where('is_active', true)->count(),
            'created_at' => $article->created_at?->toIso8601String(),
            'updated_at' => $article->updated_at?->toIso8601String(),
        ];
    }

    /**
     * GET /api/articles
     * List all articles with optional filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = KbArticle::query();

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }
        if ($request->filled('machine')) {
            $query->where('machine', $request->query('machine'));
        }
        if ($request->filled('search')) {
            $q = $request->query('search');
            $query->where(function ($b) use ($q) {
                $b->where('title', 'like', "%{$q}%")
                  ->orWhere('description', 'like', "%{$q}%");
            });
        }

        $articles = $query->orderBy('created_at', 'desc')->get();

        $formatted = $articles->map(fn (KbArticle $a) => $this->formatArticle($a))->values();

        return response()->json([
            'success' => true,
            'data' => $formatted,
            'count' => $formatted->count(),
        ]);
    }

    /**
     * GET /api/articles/categories
     * Returns standard and active categories.
     */
    public function categories(): JsonResponse
    {
        $defaults = [
            'User Manuals',
            'Troubleshooting Guides',
            'FAQs',
            'Product Specifications',
            'Maintenance Guides',
            'Installation Guides',
            'Warranty Documents',
        ];

        $inDb = KbArticle::distinct()->whereNotNull('category')->pluck('category')->toArray();
        $merged = array_values(array_unique(array_merge($defaults, $inDb)));

        return response()->json([
            'success' => true,
            'data' => $merged,
        ]);
    }

    /**
     * GET /api/articles/{id}
     * Retrieve single article details.
     */
    public function show($id): JsonResponse
    {
        $article = KbArticle::find($id);
        if (!$article) {
            return response()->json(['success' => false, 'message' => 'Article not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatArticle($article),
        ]);
    }

    /**
     * POST /api/articles
     * Create a new article (Draft by default).
     */
    public function store(Request $request): JsonResponse
    {
        $auth = $this->resolveActor($request);
        if (!$auth['is_super_admin']) {
            return response()->json(['success' => false, 'message' => 'Forbidden: Only Super Administrators can create articles.'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'category' => 'nullable|string|max:100',
            'machine' => 'nullable|string|max:100',
            'version' => 'nullable|string|max:20',
            'file_type' => 'nullable|string|max:20',
            'size' => 'nullable|string|max:50',
            'tags' => 'nullable|array',
            'description' => 'nullable|string',
            'content' => 'nullable|string',
            'status' => 'nullable|in:Draft,Published,Archived',
            'auto_index' => 'nullable|boolean',
        ]);

        $status = $validated['status'] ?? 'Draft';
        $actor = $auth['actor'];

        $historyEntry = [
            'id' => (string) Str::uuid(),
            'type' => 'created',
            'timestamp' => now()->format('Y-m-d H:i:s'),
            'actor' => $actor,
            'action' => 'Created',
            'details' => "Article created in {$status} state.",
        ];

        $article = KbArticle::create([
            'title' => $validated['title'],
            'category' => $validated['category'] ?? 'Troubleshooting Guides',
            'machine' => $validated['machine'] ?? null,
            'version' => $validated['version'] ?? '1.0',
            'file_type' => $validated['file_type'] ?? 'PDF',
            'uploaded_by' => $actor,
            'size' => $validated['size'] ?? '1.5 MB',
            'status' => 'Draft', // initial state
            'processing_status' => !empty($validated['content']) ? 'Ready for AI Search' : 'Draft',
            'tags' => $validated['tags'] ?? [],
            'description' => $validated['description'] ?? '',
            'content' => $validated['content'] ?? '',
            'history' => [$historyEntry],
        ]);

        // Process embeddings if content is provided
        if (!empty($validated['content']) || !empty($article->description)) {
            $this->ragService->indexArticle($article);
            // Default embeddings are inactive until published
            KbEmbedding::where('article_id', $article->id)->update(['is_active' => false]);
        }

        // If explicitly requested to publish immediately
        if ($status === 'Published') {
            try {
                $article = $this->ragService->publishArticle($article, $actor);
            } catch (ArticleMissingEmbeddingsException $e) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'error_code' => 'NO_EMBEDDINGS',
                    'data' => $this->formatArticle($article),
                ], 422);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Article created successfully.',
            'data' => $this->formatArticle($article),
        ], 201);
    }

    /**
     * PUT/PATCH /api/articles/{id}
     * Update article metadata without affecting embeddings or pipeline.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $auth = $this->resolveActor($request);
        if (!$auth['is_super_admin']) {
            return response()->json(['success' => false, 'message' => 'Forbidden: Only Super Administrators can update articles.'], 403);
        }

        $article = KbArticle::find($id);
        if (!$article) {
            return response()->json(['success' => false, 'message' => 'Article not found.'], 404);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'category' => 'sometimes|nullable|string|max:100',
            'machine' => 'sometimes|nullable|string|max:100',
            'version' => 'sometimes|nullable|string|max:20',
            'tags' => 'sometimes|nullable|array',
            'description' => 'sometimes|nullable|string',
        ]);

        $history = is_array($article->history) ? $article->history : [];
        $history[] = [
            'id' => (string) Str::uuid(),
            'type' => 'metadata',
            'timestamp' => now()->format('Y-m-d H:i:s'),
            'actor' => $auth['actor'],
            'action' => 'Updated Metadata',
            'details' => 'Article metadata modified.',
        ];

        $article->fill($validated);
        $article->history = $history;
        $article->save();

        return response()->json([
            'success' => true,
            'message' => 'Article metadata updated successfully.',
            'data' => $this->formatArticle($article),
        ]);
    }

    /**
     * POST /api/articles/{id}/publish
     * Super Admin action: Publish article, activating existing embeddings without re-extraction.
     * Blocks publishing if the article has no successfully processed embeddings.
     */
    public function publish(Request $request, $id): JsonResponse
    {
        $auth = $this->resolveActor($request);
        if (!$auth['is_super_admin']) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden: Only Super Administrators can publish articles.',
            ], 403);
        }

        $article = KbArticle::find($id);
        if (!$article) {
            return response()->json(['success' => false, 'message' => 'Article not found.'], 404);
        }

        // Explicit Check: Blocks publishing when the article has no successfully processed embeddings
        $embeddingsCount = KbEmbedding::where('article_id', $article->id)->count();
        $isProcessed = ($article->processing_status === 'Ready for AI Search' || $article->processing_status === 'Ready');

        if ($embeddingsCount === 0 || !$isProcessed) {
            Log::warning('Publish blocked: article lacks processed embeddings', [
                'article_id' => $article->id,
                'title' => $article->title,
                'embeddings_count' => $embeddingsCount,
                'processing_status' => $article->processing_status,
            ]);

            return response()->json([
                'success' => false,
                'message' => "Cannot publish article: no successfully processed embeddings exist for this article. Please extract and process document content before publishing.",
                'error_code' => 'NO_EMBEDDINGS',
            ], 422);
        }

        try {
            $updated = $this->ragService->publishArticle($article, $auth['actor']);

            return response()->json([
                'success' => true,
                'message' => 'Article published successfully and activated in RAG search index.',
                'data' => $this->formatArticle($updated),
            ]);
        } catch (ArticleMissingEmbeddingsException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'error_code' => 'NO_EMBEDDINGS',
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Failed to publish article: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to publish article: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/articles/{id}/archive
     * Super Admin action: Archive article, removing its embeddings from active search index
     * while preserving article record, chunks, and file intact.
     */
    public function archive(Request $request, $id): JsonResponse
    {
        $auth = $this->resolveActor($request);
        if (!$auth['is_super_admin']) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden: Only Super Administrators can archive articles.',
            ], 403);
        }

        $article = KbArticle::find($id);
        if (!$article) {
            return response()->json(['success' => false, 'message' => 'Article not found.'], 404);
        }

        try {
            $updated = $this->ragService->archiveArticle($article, $auth['actor']);

            return response()->json([
                'success' => true,
                'message' => 'Article archived successfully; embeddings deactivated from active search index.',
                'data' => $this->formatArticle($updated),
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to archive article: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to archive article: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /api/articles/{id}
     * Permanently delete an article, its physical stored file, and all its search embeddings.
     * Enforces Super Admin RBAC, blocks deletion if article is mid-processing,
     * records independent audit log, and publishes ArticleDeleted event.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $auth = $this->resolveActor($request);
        if (!$auth['is_super_admin']) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden: Only Super Administrators can permanently delete articles.',
            ], 403);
        }

        $article = KbArticle::find($id);
        if (!$article) {
            return response()->json([
                'success' => false,
                'message' => 'Article not found.',
            ], 404);
        }

        // Block deletion if article has an active process in progress (e.g. mid-extraction or indexing)
        if ($article->processing_status === 'Processing' || $article->status === 'Processing') {
            return response()->json([
                'success' => false,
                'error_code' => 'PROCESS_IN_PROGRESS',
                'message' => 'Article cannot be deleted while processing is in progress. Please wait until text extraction and indexing completes.',
            ], 409);
        }

        $articleId = (int) $article->id;
        $title = $article->title;
        $category = $article->category;
        $actor = $auth['actor'] ?? 'Super Admin';
        $actorRole = $auth['role'] ?? 'Super Admin';

        // Record independent audit log entry before deletion so it survives the hard-delete
        $this->auditLoggingService->logArticleDeletion(
            articleId: $articleId,
            title: $title,
            actor: $actor,
            actorRole: $actorRole,
            extraDetails: [
                'category' => $category,
                'machine' => $article->machine,
                'version' => $article->version,
                'file_type' => $article->file_type,
                'file_path' => $article->file_path,
                'status_before_delete' => $article->status,
            ],
            ipAddress: $request->ip()
        );

        // Permanently hard-delete stored files, embeddings, chunks, and database record
        try {
            $this->ragService->deleteArticle($article, $actor, skipAuditLog: true);
        } catch (\App\Exceptions\ArticleProcessingInProgressException $e) {
            return response()->json([
                'success' => false,
                'error_code' => 'PROCESS_IN_PROGRESS',
                'message' => $e->getMessage(),
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => "Article \"{$title}\" and its active search embeddings were permanently deleted.",
            'data' => [
                'id' => $articleId,
                'title' => $title,
            ],
        ]);
    }

    /**
     * POST /api/articles/{id}/reindex
     * Force re-indexing of an article when file or content has changed.
     */
    public function reindex(Request $request, $id): JsonResponse
    {
        $auth = $this->resolveActor($request);
        if (!$auth['is_super_admin']) {
            return response()->json(['success' => false, 'message' => 'Forbidden: Only Super Administrators can re-index articles.'], 403);
        }

        $article = KbArticle::find($id);
        if (!$article) {
            return response()->json(['success' => false, 'message' => 'Article not found.'], 404);
        }

        $this->ragService->indexArticle($article);
        $this->ragService->refreshIndex($id);

        return response()->json([
            'success' => true,
            'message' => 'Article re-indexed successfully.',
            'data' => $this->formatArticle($article->fresh()),
        ]);
    }
}
