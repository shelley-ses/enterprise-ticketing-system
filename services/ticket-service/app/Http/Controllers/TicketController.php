<?php

namespace App\Http\Controllers;

use App\Events\TicketChanged;
use App\Mail\TicketNotificationMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;

class TicketController extends Controller
{
    private function clearTicketCaches()
    {
        try {
            Cache::forget('cs_dashboard_counts');
            Cache::forget('ticket_form_options_cache');

            $redis = \Illuminate\Support\Facades\Redis::connection('cache');
            $prefix = config('cache.prefix') ?? 'laravel_cache';
            
            $patterns = [
                '*cs_incoming_tickets_*',
                '*cs_dashboard_recent_*',
                '*customer_dashboard_recent_*',
                '*customer_dashboard_counts_*'
            ];
            
            $driver = config('database.redis.client', 'phpredis');
            
            foreach ($patterns as $pattern) {
                if ($driver === 'phpredis') {
                    $client = $redis->client();
                    $iterator = null;
                    $loopCount = 0;
                    do {
                        $keys = $client->scan($iterator, $pattern, 100);
                        if ($keys === false) {
                            break;
                        }
                        if (!empty($keys)) {
                            foreach ($keys as $key) {
                                $this->forgetCleanKey($key, $prefix);
                            }
                        }
                        $loopCount++;
                    } while ($iterator > 0 && $loopCount < 1000);
                } else {
                    $iterator = 0;
                    $loopCount = 0;
                    do {
                        $response = $redis->scan($iterator, ['match' => $pattern, 'count' => 100]);
                        $iterator = $response[0];
                        $keys = $response[1];
                        if (!empty($keys)) {
                            foreach ($keys as $key) {
                                $this->forgetCleanKey($key, $prefix);
                            }
                        }
                        $loopCount++;
                    } while ($iterator != 0 && $loopCount < 1000);
                }
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('Redis cache clearing failed: ' . $e->getMessage());
        }
    }

    private function forgetCleanKey($key, $prefix)
    {
        $cleanKey = $key;
        if (strpos($key, ':') !== false) {
            $parts = explode(':', $key);
            $cleanKey = end($parts);
        } else {
            if (str_starts_with($key, $prefix)) {
                $cleanKey = substr($key, strlen($prefix));
            }
        }
        Cache::forget($cleanKey);
    }

    private function slaLabel($createdAt): string
    {
        if (!$createdAt) {
            return 'On Track';
        }

        $hours = now()->diffInHours($createdAt);
        if ($hours >= 48) {
            return 'Breached';
        }
        if ($hours >= 24) {
            return 'At Risk';
        }
        return 'On Track';
    }

    private function getFullTicketDetails(int $ticketId): ?array
    {
        $row = DB::table('tickets as t')
            ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
            ->leftJoin('employees as e', 'e.emp_id', '=', 't.assigned_to')
            ->leftJoin('ticket_types as tt', 'tt.ticket_type_ID', '=', 't.ticket_type_ID')
            ->select(
                't.ticket_ID',
                't.title',
                't.is_internal',
                't.requested_by',
                'pc.category_name',
                'ts.status_name',
                'tp.priority_name',
                'e.department',
                't.created_at',
                'c.client_name',
                'm.machine_name',
                'm.serial_number',
                'tt.type_name as ticket_type'
            )
            ->where('t.ticket_ID', $ticketId)
            ->first();

        if (!$row) {
            return null;
        }

        $assignments = DB::table('ticket_assignments')
            ->where('ticket_ID', $ticketId)
            ->get();

        $assignedIds = $assignments->pluck('employee_ID')->map(fn($id) => (int)$id)->all();

        $pendingReassign = DB::table('reassignment_requests')
            ->where('ticket_id', $ticketId)
            ->where('status', 'pending')
            ->first();

        $createdAtObj = is_string($row->created_at) ? \Carbon\Carbon::parse($row->created_at) : $row->created_at;

        return [
            'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
            'ticket_ID' => (int) $row->ticket_ID,
            'customer' => $row->client_name ?: 'Unknown Customer',
            'title' => $row->title,
            'category' => $row->category_name,
            'status' => $row->status_name,
            'priority' => $row->priority_name,
            'department' => $row->department,
            'equipment' => $row->machine_name . ' - ' . $row->serial_number,
            'sla' => $this->slaLabel($createdAtObj),
            'date' => $createdAtObj ? $createdAtObj->format('m/d/Y') : now()->format('m/d/Y'),
            'assigned' => $assignedIds,
            'reassignmentRequested' => !empty($pendingReassign),
            'reassignmentReason' => $pendingReassign ? $pendingReassign->reason : null,
            'type' => $row->ticket_type ?? 'External',
            'ticket_type' => $row->ticket_type ?? 'External',
            'is_internal' => (bool)$row->is_internal,
            'requested_by' => $row->requested_by,
        ];
    }

    private function broadcastTicketChange(string $action, int $ticketId, array $payload = []): void
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();

        $fullTicket = null;
        if ($ticketId > 0) {
            $fullTicket = $this->getFullTicketDetails($ticketId);
        }

        $assignedEmpIds = [];
        if ($ticketId > 0) {
            $assignedEmpIds = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->pluck('employee_ID')
                ->map(fn($id) => (int)$id)
                ->all();
        }

        event(new TicketChanged(array_merge([
            'action' => $action,
            'ticket_ID' => $ticketId,
            'ticketId' => $ticketId,
            'updated_at' => now()->toISOString(),
            'customer_id' => $ticket?->created_by,
            'assigned_to' => $ticket?->assigned_to,
            'employee_ids' => $assignedEmpIds,
            'ticket_status_ID' => $ticket?->ticket_status_ID,
            'ticket' => $fullTicket,
        ], $payload)));
    }

    private function getRecipientInfo(Request $request): array
    {
        $user = $request->user();
        if (!$user) {
            return [null, null];
        }
        if ($user instanceof \App\Models\Client) {
            return [$user->id, 'client'];
        }
        return [$user->emp_id, 'employee'];
    }

    public function getNotifications(Request $request)
    {
        list($recipientId, $recipientType) = $this->getRecipientInfo($request);
        if (!$recipientId) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $notifications = DB::table('notifications')
            ->where('recipient_id', $recipientId)
            ->where('recipient_type', $recipientType)
            ->orderBy('created_at', 'desc')
            ->get();

        $unreadCount = DB::table('notifications')
            ->where('recipient_id', $recipientId)
            ->where('recipient_type', $recipientType)
            ->where('is_read', false)
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markNotificationsRead(Request $request)
    {
        list($recipientId, $recipientType) = $this->getRecipientInfo($request);
        if (!$recipientId) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        DB::table('notifications')
            ->where('recipient_id', $recipientId)
            ->where('recipient_type', $recipientType)
            ->update([
                'is_read' => true,
                'updated_at' => now(),
            ]);

        $this->broadcastTicketChange('notifications_read', 0);

        return response()->json([
            'message' => 'All notifications marked as read.',
            'unread_count' => 0,
        ]);
    }

    public function markNotificationRead(Request $request, int $id)
    {
        list($recipientId, $recipientType) = $this->getRecipientInfo($request);
        if (!$recipientId) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        DB::table('notifications')
            ->where('id', $id)
            ->where('recipient_id', $recipientId)
            ->where('recipient_type', $recipientType)
            ->update([
                'is_read' => true,
                'updated_at' => now(),
            ]);

        $updatedNotification = DB::table('notifications')->where('id', $id)->first();

        $unreadCount = DB::table('notifications')
            ->where('recipient_id', $recipientId)
            ->where('recipient_type', $recipientType)
            ->where('is_read', false)
            ->count();

        $this->broadcastTicketChange('notification_read', 0);

        return response()->json([
            'message' => 'Notification marked as read.',
            'notification' => $updatedNotification,
            'unread_count' => $unreadCount,
        ]);
    }

    private function notifyRecipient(int $recipientId, string $recipientType, string $title, string $message, ?int $ticketId = null, ?array $data = null): void
    {
        DB::table('notifications')->insert([
            'recipient_id' => $recipientId,
            'recipient_type' => $recipientType,
            'title' => $title,
            'message' => $message,
            'ticket_id' => $ticketId,
            'data' => $data ? json_encode($data) : null,
            'is_read' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function sendTicketEmail(int $empId, string $subject, string $message, int $ticketId, string $ticketTitle, string $category, string $priority): void
    {
        $employee = DB::table('employees')->where('emp_id', $empId)->first();
        if (!$employee || !$employee->email) {
            return;
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $ticketLink = url("/tickets/{$ticketId}");

        try {
            Mail::to($employee->email)->send(new TicketNotificationMail(
                $subject,
                $message,
                $ticketRef,
                $ticketTitle,
                $category,
                $priority,
                $ticketLink
            ));
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to send ticket email to {$employee->email}: {$e->getMessage()}");
        }
    }

    private function sendCustomerEmail(int $customerId, string $subject, string $message, int $ticketId, string $ticketTitle, string $category, string $priority): void
    {
        $client = DB::table('clients')->where('id', $customerId)->first();
        if (!$client || !$client->email) {
            return;
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $ticketLink = url("/tickets/{$ticketId}");

        try {
            Mail::to($client->email)->send(new TicketNotificationMail(
                $subject,
                $message,
                $ticketRef,
                $ticketTitle,
                $category,
                $priority,
                $ticketLink
            ));
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to send customer email to {$client->email}: {$e->getMessage()}");
        }
    }

    private function notifyCS(string $title, string $message, ?int $ticketId = null, ?array $data = null, ?int $excludeUserId = null): void
    {
        $csUsers = DB::table('employees')->where('role', 'customer service')->pluck('emp_id');
        foreach ($csUsers as $csEmpId) {
            if ($excludeUserId !== null && (int) $csEmpId === $excludeUserId) {
                continue;
            }
            $this->notifyRecipient($csEmpId, 'employee', $title, $message, $ticketId, $data);
        }
    }

    private function notifyCustomer(int $customerId, string $title, string $message, ?int $ticketId = null, ?array $data = null): void
    {
        $this->notifyRecipient($customerId, 'client', $title, $message, $ticketId, $data);

        if ($ticketId) {
            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first(['requested_by']);
            if ($ticket && $ticket->requested_by) {
                $this->notifyRecipient($ticket->requested_by, 'employee', $title, $message, $ticketId, $data);
            }
        }
    }

    public function customerDashboard(Request $request)
    {
        $createdBy = (int) ($request->query('created_by', 1));
        $limit = (int) ($request->query('limit', 5));
        if ($limit < 1) {
            $limit = 5;
        }
        if ($limit > 20) {
            $limit = 20;
        }

        $summary = Cache::remember("customer_dashboard_counts_{$createdBy}", 60, function () use ($createdBy) {
            $statusCounts = DB::table('tickets as t')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->select('ts.status_name', DB::raw('COUNT(*) as total'))
                ->where('t.created_by', $createdBy)
                ->where('t.is_internal', false)
                ->groupBy('ts.status_name')
                ->get();

            $sum = [
                'open' => 0,
                'in_progress' => 0,
                'resolved' => 0,
                'closed' => 0,
            ];

            foreach ($statusCounts as $row) {
                $key = str_replace(' ', '_', strtolower($row->status_name));
                if (array_key_exists($key, $sum)) {
                    $sum[$key] = (int) $row->total;
                }
            }
            return $sum;
        });

        $recentTickets = Cache::remember("customer_dashboard_recent_{$createdBy}_{$limit}", 60, function () use ($createdBy, $limit) {
            return DB::table('tickets as t')
                ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
                ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
                ->select(
                    't.ticket_ID',
                    't.title',
                    't.description',
                    'm.machine_name',
                    'm.serial_number',
                    'ts.status_name',
                    't.created_at',
                    't.updated_at',
                    't.assigned_to',
                    'pc.category_name',
                    'tp.priority_name'
                )
                ->where('t.created_by', $createdBy)
                ->where('t.is_internal', false)
                ->orderByDesc('t.created_at')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => [
                    'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 3, '0', STR_PAD_LEFT),
                    'ticket_ID' => $row->ticket_ID,
                    'title' => $row->title,
                    'description' => $row->description,
                    'category' => $row->category_name,
                    'equipment' => $row->machine_name . ' - ' . $row->serial_number,
                    'status' => $row->status_name,
                    'priority' => $row->priority_name ?? 'Low',
                    'date_created' => $row->created_at,
                    'last_updated' => $row->updated_at ?? $row->created_at,
                    'assigned_to' => $row->assigned_to,
                ])
                ->values()
                ->toArray();
        });

        return response()->json([
            'summary' => $summary,
            'recent_tickets' => $recentTickets,
        ]);
    }

    public function formOptions()
    {
        $options = \Illuminate\Support\Facades\Cache::remember('ticket_form_options_cache', 3600, function () {
            $machines = DB::table('machines')
                ->select('machine_ID', 'machine_name', 'serial_number')
                ->orderBy('machine_name')
                ->get();

            $problemCategories = DB::table('problem_categories')
                ->select('problem_category_ID', 'category_name')
                ->where('is_active', true)
                ->orderBy('category_name')
                ->get();

            $ticketTypes = DB::table('ticket_types')
                ->select('ticket_type_ID', 'type_name')
                ->orderBy('type_name')
                ->get();

            $priorities = DB::table('ticket_priorities')
                ->select('priority_ID', 'priority_name')
                ->orderBy('priority_ID')
                ->get();

            return [
                'machines' => $machines,
                'machine_categories' => DB::table('machine_categories')->orderBy('category_name')->get(),
                'problem_categories' => $problemCategories,
                'ticket_types' => $ticketTypes,
                'ticket_priorities' => $priorities,
                'ticket_statuses' => DB::table('ticket_statuses')->orderBy('ticket_status_ID')->get(),
                'slas' => DB::table('slas')->where('is_active', true)->orderBy('sla_ID')->get(),

                // For dropdown options used by customer create-ticket modal.
                'equipment_options' => $machines->map(fn ($row) => [
                    'value' => $row->machine_ID,
                    'label' => $row->machine_name . ' - ' . $row->serial_number,
                ])->values()->all(),
                'category_options' => $problemCategories->map(fn ($row) => [
                    'value' => $row->problem_category_ID,
                    'label' => $row->category_name,
                ])->values()->all(),
                'priority_options' => $priorities->map(fn ($row) => [
                    'value' => $row->priority_ID,
                    'label' => $row->priority_name,
                ])->values()->all(),
                'ticket_type_options' => $ticketTypes->map(fn ($row) => [
                    'value' => $row->ticket_type_ID,
                    'label' => $row->type_name,
                ])->values()->all(),
            ];
        });

        return response()->json($options);
    }

    public function csDashboard(Request $request)
    {
        $limit = (int) ($request->query('limit', 10));
        if ($limit < 1) {
            $limit = 10;
        }
        if ($limit > 50) {
            $limit = 50;
        }

        $summary = Cache::remember('cs_dashboard_counts', 60, function () {
            $statusCounts = DB::table('tickets as t')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->where('t.ticket_status_ID', '!=', 9)
                ->select('ts.status_name', DB::raw('COUNT(*) as total'))
                ->groupBy('ts.status_name')
                ->get();

            $sum = [
                'open' => 0,
                'in_progress' => 0,
                'resolved' => 0,
                'closed' => 0,
            ];

            foreach ($statusCounts as $row) {
                $key = str_replace(' ', '_', strtolower($row->status_name));
                if (array_key_exists($key, $sum)) {
                    $sum[$key] = (int) $row->total;
                }
            }
            return $sum;
        });

        $recentTickets = Cache::remember("cs_dashboard_recent_{$limit}", 60, function () use ($limit) {
            return DB::table('tickets as t')
                ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
                ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
                ->where('t.ticket_status_ID', '!=', 9)
                ->select(
                    't.ticket_ID',
                    't.title',
                    'm.machine_name',
                    'm.serial_number',
                    'ts.status_name',
                    'tp.priority_name',
                    't.created_at',
                    't.updated_at',
                    't.requested_by',
                    'c.client_name'
                )
                ->orderByDesc('t.created_at')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => [
                    'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 3, '0', STR_PAD_LEFT),
                    'title' => $row->title,
                    'customer' => $row->client_name ?: 'Unknown Customer',
                    'equipment' => $row->machine_name . ' - ' . $row->serial_number,
                    'status' => $row->status_name,
                    'priority' => $row->priority_name,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                    'requested_by' => $row->requested_by,
                ])
                ->values()
                ->toArray();
        });

        return response()->json([
            'summary' => $summary,
            'recent_tickets' => $recentTickets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_ID' => ['required', 'integer', 'exists:machines,machine_ID'],
            'problem_category_ID' => ['required', 'integer', 'exists:problem_categories,problem_category_ID'],
            'created_by' => ['nullable', 'integer', 'exists:clients,id'],
            'assigned_to' => ['nullable', 'integer', 'exists:employees,emp_id'],
            'ticket_type_ID' => ['nullable', 'integer', 'exists:ticket_types,ticket_type_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'ticket_status_ID' => ['nullable', 'integer', 'exists:ticket_statuses,ticket_status_ID'],
            'sla_ID' => ['nullable', 'integer', 'exists:slas,sla_ID'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['integer'],
        ]);

        $user = auth('api')->user() ?? $request->user();

        $clientId = 1;
        if ($user && ($user instanceof \App\Models\Client)) {
            $clientId = $user->id;
        }

        $externalTypeId = DB::table('ticket_types')->where('type_name', 'External')->value('ticket_type_ID');

        $ticketId = DB::table('tickets')->insertGetId([
            'machine_ID' => $validated['machine_ID'],
            'problem_category_ID' => $validated['problem_category_ID'],
            'created_by' => $validated['created_by'] ?? $clientId,
            'requested_by' => null,
            'assigned_to' => $validated['assigned_to'] ?? null,
            'ticket_type_ID' => $validated['ticket_type_ID'] ?? $externalTypeId,
            'is_internal' => false,
            'priority_ID' => $validated['priority_ID'] ?? null,
            'ticket_status_ID' => $validated['ticket_status_ID'] ?? 1,
            'sla_ID' => $validated['sla_ID'] ?? null,
            'title' => strip_tags($validated['title']),
            'description' => strip_tags($validated['description']),
            'resolved_at' => null,
            'closed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $attachmentIds = $validated['attachments'] ?? [];
        if (!empty($attachmentIds)) {
            try {
                \Illuminate\Support\Facades\Http::post('http://attachment-service:8000/api/bind', [
                    'ticket_id' => $ticketId,
                    'attachment_ids' => $attachmentIds,
                    'is_proof' => false
                ]);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Failed to bind attachments in store: " . $e->getMessage());
            }
        }

        $storedAttachments = [];
        try {
            $resp = \Illuminate\Support\Facades\Http::get("http://attachment-service:8000/api/attachments?ticket_id={$ticketId}");
            if ($resp->successful()) {
                $storedAttachments = $resp->json('attachments') ?? [];
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to fetch attachments in store: " . $e->getMessage());
        }

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        $this->clearTicketCaches();

        $dashboardTicket = DB::table('tickets as t')
            ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->select('t.ticket_ID', 't.title', 'm.machine_name', 'm.serial_number', 'ts.status_name')
            ->where('t.ticket_ID', $ticketId)
            ->first();

        $customerId = $validated['created_by'] ?? 1;
        $clientName = DB::table('clients')->where('id', $customerId)->value('client_name') ?? 'Customer';
        $this->notifyCS(
            'New Ticket Created',
            "New Ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $validated['title'] . "\" has been created by " . $clientName . ".",
            $ticketId
        );

        $this->notifyCustomer(
            $customerId,
            'Ticket Created',
            "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $validated['title'] . "\" has been created successfully. Our team will review it shortly.",
            $ticketId
        );

        $categoryName = DB::table('problem_categories')->where('problem_category_ID', $validated['problem_category_ID'])->value('category_name') ?? '';
        $priorityName = DB::table('ticket_priorities')->where('priority_ID', $validated['priority_ID'] ?? 1)->value('priority_name') ?? '';
        $this->sendCustomerEmail(
            $customerId,
            'Ticket Created',
            "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $validated['title'] . "\" has been created successfully.",
            $ticketId,
            $validated['title'],
            $categoryName,
            $priorityName
        );

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => $ticketId,
            'action_type' => 'create',
            'action_by_ID' => 2, // Default to placeholder employee ID
            'actor_type' => 'customer',
            'details' => json_encode([
                'machine_ID' => $validated['machine_ID'],
                'problem_category_ID' => $validated['problem_category_ID'],
                'title' => strip_tags($validated['title']),
            ]),
            'created_at' => now(),
        ]);

        $this->broadcastTicketChange('created', $ticketId, [
            'status' => 'Open',
            'title' => $validated['title'],
            'customer_id' => $validated['created_by'] ?? 1,
        ]);

        // Auto-generate initial welcome message in chat
        try {
            \Illuminate\Support\Facades\Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "Hi! I am the Customer Support Assistant. A representative will be with you shortly. For your reference, this chat is for your ticket: TKT-" . str_pad((string)$ticketId, 4, '0', STR_PAD_LEFT) . ".",
                'sender_name' => 'Customer Support Assistant',
                'sender_type' => 'cs',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to send initial internal message: " . $e->getMessage());
        }

        return response()->json([
            'message' => 'Ticket created successfully.',
            'ticket' => $ticket,
            'dashboard_ticket' => $dashboardTicket ? [
                'id' => 'TKT-' . str_pad((string) $dashboardTicket->ticket_ID, 3, '0', STR_PAD_LEFT),
                'title' => $dashboardTicket->title,
                'equipment' => $dashboardTicket->machine_name . ' - ' . $dashboardTicket->serial_number,
                'status' => $dashboardTicket->status_name,
            ] : null,
            'attachments' => $storedAttachments,
        ], 201);
    }

    public function storeInternalTicket(Request $request)
    {
        $user = $request->user();
        if (!$user || $user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Only employees can create internal tickets.'], 403);
        }

        $validated = $request->validate([
            'machine_ID' => ['required', 'integer', 'exists:machines,machine_ID'],
            'problem_category_ID' => ['required', 'integer', 'exists:problem_categories,problem_category_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['integer'],
        ]);

        $internalTypeId = DB::table('ticket_types')->where('type_name', 'Internal')->value('ticket_type_ID');
        $empId = $user->emp_id;

        $ticketId = DB::table('tickets')->insertGetId([
            'machine_ID' => $validated['machine_ID'],
            'problem_category_ID' => $validated['problem_category_ID'],
            'created_by' => 1,
            'requested_by' => $empId,
            'assigned_to' => null,
            'ticket_type_ID' => $internalTypeId,
            'is_internal' => true,
            'priority_ID' => $validated['priority_ID'] ?? null,
            'ticket_status_ID' => 1,
            'sla_ID' => null,
            'title' => strip_tags($validated['title']),
            'description' => strip_tags($validated['description']),
            'resolved_at' => null,
            'closed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => $ticketId,
            'action_type' => 'create',
            'action_by_ID' => $empId,
            'actor_type' => 'employee',
            'details' => json_encode([
                'machine_ID' => $validated['machine_ID'],
                'problem_category_ID' => $validated['problem_category_ID'],
                'title' => strip_tags($validated['title']),
            ]),
            'created_at' => now(),
        ]);

        $attachmentIds = $validated['attachments'] ?? [];
        if (!empty($attachmentIds)) {
            try {
                \Illuminate\Support\Facades\Http::post('http://attachment-service:8000/api/bind', [
                    'ticket_id' => $ticketId,
                    'attachment_ids' => $attachmentIds,
                    'is_proof' => false
                ]);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Failed to bind attachments in storeInternalTicket: " . $e->getMessage());
            }
        }

        $storedAttachments = [];
        try {
            $resp = \Illuminate\Support\Facades\Http::get("http://attachment-service:8000/api/attachments?ticket_id={$ticketId}");
            if ($resp->successful()) {
                $storedAttachments = $resp->json('attachments') ?? [];
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to fetch attachments in storeInternalTicket: " . $e->getMessage());
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $this->notifyCS(
            'New Internal Ticket Created',
            "New internal ticket {$ticketRef}: \"" . $validated['title'] . "\" has been created and awaits CSR delegation.",
            $ticketId
        );

        $this->notifyRecipient(
            $empId,
            'employee',
            'Internal Ticket Created',
            "Your internal ticket {$ticketRef}: \"" . $validated['title'] . "\" has been submitted successfully.",
            $ticketId,
            [
                'ticket_id' => $ticketId,
                'ticket_ref' => $ticketRef,
                'title' => $validated['title'],
            ]
        );

        $this->broadcastTicketChange('created', $ticketId, [
            'status' => 'Open',
            'title' => $validated['title'],
        ]);

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        $this->clearTicketCaches();

        // Auto-generate initial welcome message in chat
        try {
            \Illuminate\Support\Facades\Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "Hi! I am the Customer Support Assistant. A representative will be with you shortly. For your reference, this chat is for your ticket: TKT-" . str_pad((string)$ticketId, 4, '0', STR_PAD_LEFT) . ".",
                'sender_name' => 'Customer Support Assistant',
                'sender_type' => 'cs',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to send initial internal message: " . $e->getMessage());
        }

        return response()->json([
            'message' => 'Internal ticket created successfully.',
            'ticket' => $ticket,
            'id' => 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT),
            'attachments' => $storedAttachments,
        ], 201);
    }

    public function csIncoming(Request $request)
    {
        $perPage = max(1, min((int) $request->query('limit', 50), 200));
        $typeFilter = $request->query('type') ?? 'all';
        $page = $request->query('page', 1);

        $cacheKey = "cs_incoming_tickets_{$perPage}_{$typeFilter}_{$page}";

        $result = Cache::remember($cacheKey, 60, function () use ($perPage, $typeFilter) {
            $query = DB::table('tickets as t')
                ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
                ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
                ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
                ->leftJoin('employees as e', 'e.emp_id', '=', 't.assigned_to')
                ->leftJoin('ticket_types as tt', 'tt.ticket_type_ID', '=', 't.ticket_type_ID')
                ->where('t.ticket_status_ID', '!=', 9)
                ->select(
                    't.ticket_ID',
                    't.title',
                    't.description',
                    't.is_internal',
                    't.requested_by',
                    'pc.category_name',
                    'ts.status_name',
                    'tp.priority_name',
                    'e.department',
                    't.created_at',
                    'c.client_name',
                    'm.machine_name',
                    'm.serial_number',
                    'tt.type_name as ticket_type',
                    't.proof_rejected',
                    't.rejection_reason'
                );

            if ($typeFilter === 'internal') {
                $query->where('t.is_internal', true);
            } elseif ($typeFilter === 'external') {
                $query->where('t.is_internal', false);
            }

            $paginated = $query->orderByDesc('t.created_at')
                ->paginate($perPage);

            $rows = collect($paginated->items());
            $ticketIds = $rows->pluck('ticket_ID')->toArray();

            $assignments = collect();
            $pendingReassigns = collect();

            if (!empty($ticketIds)) {
                $assignments = DB::table('ticket_assignments')
                    ->whereIn('ticket_ID', $ticketIds)
                    ->get()
                    ->groupBy('ticket_ID');

                $pendingReassigns = DB::table('reassignment_requests')
                    ->whereIn('ticket_id', $ticketIds)
                    ->where('status', 'pending')
                    ->get()
                    ->keyBy('ticket_id');
            }

            $incomingTickets = $rows->map(function ($row) use ($assignments, $pendingReassigns) {
                $assignedIds = isset($assignments[$row->ticket_ID])
                    ? $assignments[$row->ticket_ID]->pluck('employee_ID')->map(fn($id) => (int)$id)->all()
                    : [];

                $accepted = isset($assignments[$row->ticket_ID])
                    ? $assignments[$row->ticket_ID]->contains('assignment_status', 'accepted')
                    : false;

                $pendingReassign = $pendingReassigns->get($row->ticket_ID);

                $createdAtObj = is_string($row->created_at) ? \Carbon\Carbon::parse($row->created_at) : $row->created_at;

                return [
                    'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
                    'ticket_ID' => (int) $row->ticket_ID,
                    'customer' => $row->client_name ?: 'Unknown Customer',
                    'title' => $row->title,
                    'category' => $row->category_name,
                    'status' => $row->status_name,
                    'priority' => $row->priority_name,
                    'department' => $row->department,
                    'equipment' => $row->machine_name . ' - ' . $row->serial_number,
                    'sla' => $this->slaLabel($createdAtObj),
                    'date' => $createdAtObj ? $createdAtObj->format('m/d/Y') : now()->format('m/d/Y'),
                    'assigned' => $assignedIds,
                    'accepted' => $accepted,
                    'reassignmentRequested' => !empty($pendingReassign),
                    'reassignmentReason' => $pendingReassign ? $pendingReassign->reason : null,
                    'proofRejected' => (bool)$row->proof_rejected,
                    'rejectionReason' => $row->rejection_reason,
                    'type' => $row->ticket_type ?? 'External',
                    'ticket_type' => $row->ticket_type ?? 'External',
                    'is_internal' => (bool)$row->is_internal,
                    'requested_by' => $row->requested_by,
                ];
            })->values()->toArray();

            return [
                'incoming_tickets' => $incomingTickets,
                'pagination' => [
                    'total' => $paginated->total(),
                    'per_page' => $paginated->perPage(),
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                ]
            ];
        });

        return response()->json($result);
    }

    public function assignableEmployees(Request $request)
    {
        $department = $request->query('department');
        $ticketId = $request->query('ticket_id');

        $query = DB::table('employees')
            ->select('emp_id as id', DB::raw("CONCAT(first_name, ' ', last_name) as name"), 'email', 'role', 'department', 'is_active')
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer service'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['superadmin'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['super admin']);

        if ($department) {
            $query->where('department', $department);
        }

        if ($ticketId) {
            $requestedBy = DB::table('tickets')->where('ticket_ID', $ticketId)->value('requested_by');
            if ($requestedBy) {
                $query->where('emp_id', '!=', $requestedBy);
            }
        }

        $employees = $query
            ->orderByDesc('is_active')
            ->orderBy(DB::raw("CONCAT(first_name, ' ', last_name)"))
            ->get();

        return response()->json([
            'employees' => $employees,
        ]);
    }

    public function getDepartments(Request $request)
    {
        $rows = DB::table('departments')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json([
            'departments' => $rows,
        ]);
    }

    public function assignTicket(Request $request, int $ticketId)
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        if ($ticket->ticket_status_ID == 3) {
            return response()->json(['message' => 'Resolved tickets cannot be reassigned.'], 422);
        }

        $validated = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['integer', 'exists:employees,emp_id'],
            'assigned_by_email' => ['nullable', 'email'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
        ]);

        $employees = DB::table('employees')
            ->whereIn('emp_id', $validated['employee_ids'])
            ->select('emp_id as id', 'role')
            ->get();

        $invalid = $employees->contains(function ($row) {
            return strtolower((string) $row->role) === 'customer service';
        });

        if ($invalid) {
            return response()->json([
                'message' => 'Customer-service users cannot be assignees.',
            ], 422);
        }

        $assignedBy = DB::table('employees')
            ->where('email', $validated['assigned_by_email'] ?? '')
            ->value('emp_id');
        if (!$assignedBy) {
            $assignedBy = 2;
        }

        DB::transaction(function () use ($ticketId, $validated, $assignedBy) {
            $pendingAssignmentId = DB::table('ticket_statuses')
                ->whereRaw('LOWER(status_name) = ?', ['pending assignment'])
                ->value('ticket_status_ID') ?? 7;

            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
            $changes = [];

            if ($ticket && $ticket->assigned_to != $validated['employee_ids'][0]) {
                $changes[] = ['field' => 'assigned_to', 'old' => $ticket->assigned_to, 'new' => $validated['employee_ids'][0]];
            }
            if ($ticket && array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null && $ticket->priority_ID != $validated['priority_ID']) {
                $changes[] = ['field' => 'priority_ID', 'old' => $ticket->priority_ID, 'new' => $validated['priority_ID']];
            }

            DB::table('tickets')
                ->where('ticket_ID', $ticketId)
                ->update([
                    'assigned_to' => $validated['employee_ids'][0],
                    'ticket_status_ID' => $pendingAssignmentId,
                    'priority_ID' => $validated['priority_ID'] ?? DB::raw('priority_ID'),
                    'updated_at' => now(),
                ]);

            $existing = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->get()
                ->keyBy('employee_ID');

            $newEmpIds = $validated['employee_ids'];
            $toRemove = $existing->keys()->diff($newEmpIds);
            $toAdd = collect($newEmpIds)->diff($existing->keys());

            if ($toRemove->isNotEmpty()) {
                DB::table('ticket_assignments')
                    ->where('ticket_ID', $ticketId)
                    ->whereIn('employee_ID', $toRemove)
                    ->delete();
            }

            foreach ($toAdd as $employeeId) {
                DB::table('ticket_assignments')->insert([
                    'ticket_ID' => $ticketId,
                    'employee_ID' => $employeeId,
                    'assigned_by' => $assignedBy,
                    'assignment_status' => 'assigned',
                    'assigned_at' => now(),
                    'completed_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('reassignment_requests')
                ->where('ticket_id', $ticketId)
                ->where('status', 'pending')
                ->update([
                    'status' => 'approved',
                    'reviewed_at' => now(),
                    'updated_at' => now(),
                ]);

            foreach ($changes as $chg) {
                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticketId,
                    'action_type' => 'update',
                    'action_by_ID' => $assignedBy,
                    'actor_type' => 'employee',
                    'details' => json_encode($chg),
                    'created_at' => now(),
                ]);
            }

            DB::table('tickets')
                ->where('ticket_ID', $ticketId)
                ->whereNull('first_cs_response_at')
                ->update(['first_cs_response_at' => now()]);
        });

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if ($ticket) {
            $customerId = $ticket->created_by;
            $title = $ticket->title;
            $empNames = DB::table('employees')->whereIn('emp_id', $validated['employee_ids'])->selectRaw("CONCAT(first_name, ' ', last_name) as name")->pluck('name')->all();
            $empNamesStr = implode(', ', $empNames);

            $categoryName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $priorityName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID)->value('priority_name') ?? '';
            $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
            $ticketLink = url("/tickets/{$ticketId}");

            $notificationData = [
                'ticket_id' => $ticketId,
                'ticket_ref' => $ticketRef,
                'title' => $title,
                'category' => $categoryName,
                'priority' => $priorityName,
                'type' => 'ticket_assigned',
            ];

            foreach ($validated['employee_ids'] as $employeeId) {
                $this->notifyRecipient(
                    $employeeId,
                    'employee',
                    'Ticket Assigned',
                    "Ticket {$ticketRef}: \"" . $title . "\" has been assigned to you.",
                    $ticketId,
                    $notificationData
                );

                $this->sendTicketEmail(
                    $employeeId,
                    'Ticket Assigned',
                    "Ticket {$ticketRef}: \"{$title}\" has been assigned to you.",
                    $ticketId,
                    $title,
                    $categoryName,
                    $priorityName
                );
            }

            $this->notifyCustomer(
                $customerId,
                'Engineer Assigned',
                "Engineer " . $empNamesStr . " has been assigned to your ticket {$ticketRef}: \"" . $title . "\".",
                $ticketId,
                $notificationData
            );

            $this->sendCustomerEmail(
                $customerId,
                'Engineer Assigned',
                "Engineer(s) have been assigned to your ticket {$ticketRef}: \"" . $title . "\".",
                $ticketId,
                $title,
                $categoryName,
                $priorityName
            );

            $this->notifyCS(
                'Ticket Assigned',
                "Ticket {$ticketRef}: \"" . $title . "\" has been assigned to " . $empNamesStr . ".",
                $ticketId,
                null,
                $assignedBy
            );

            if ($ticket->requested_by) {
                $this->notifyRecipient(
                    $ticket->requested_by,
                    'employee',
                    'Ticket Assigned',
                    "Your requested ticket {$ticketRef}: \"" . $title . "\" has been assigned to " . $empNamesStr . ".",
                    $ticketId,
                    $notificationData
                );
            }
        }

        $this->broadcastTicketChange('assigned', $ticketId, [
            'assigned_to' => $validated['employee_ids'][0],
            'employee_ids' => $validated['employee_ids'],
        ]);

        // Auto-generate system assignment message in chat
        try {
            $empNames = DB::table('employees')
                ->whereIn('emp_id', $validated['employee_ids'])
                ->selectRaw("CONCAT(first_name, ' ', last_name) as name")
                ->pluck('name')
                ->all();
            $empNamesStr = implode(', ', $empNames);

            \Illuminate\Support\Facades\Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "System: A Service Engineer ({$empNamesStr}) has been assigned to your ticket.",
                'sender_name' => 'System',
                'sender_type' => 'system',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to send internal assignment message in assignTicket: " . $e->getMessage());
        }

        $updatedTicket = DB::table('tickets')
            ->where('ticket_ID', $ticketId)
            ->first();

        $this->clearTicketCaches();

        return response()->json([
            'message' => 'Ticket assigned successfully.',
            'ticket' => $updatedTicket,
        ]);
    }

    public function acceptTicket(Request $request, int $ticketId)
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        if ($ticket->ticket_status_ID == 3) {
            return response()->json(['message' => 'Resolved tickets cannot be reassigned.'], 422);
        }

        $user = $request->user();

        // 1. Employee accept logic
        if ($user && $user->role !== 'customer service') {
            $empId = $user->emp_id;

            $assignment = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->where('employee_ID', $empId)
                ->first();

            if (!$assignment) {
                return response()->json(['message' => 'You are not assigned to this ticket.'], 403);
            }

            DB::transaction(function () use ($ticketId, $empId) {
                DB::table('ticket_assignments')
                    ->where('ticket_ID', $ticketId)
                    ->where('employee_ID', $empId)
                    ->update([
                        'assignment_status' => 'accepted',
                        'accepted_at' => now(),
                        'updated_at' => now(),
                    ]);

                $inProgressId = DB::table('ticket_statuses')
                    ->whereRaw('LOWER(status_name) = ?', ['in progress'])
                    ->value('ticket_status_ID') ?? 2;

                DB::table('tickets')
                    ->where('ticket_ID', $ticketId)
                    ->update([
                        'ticket_status_ID' => $inProgressId,
                        'updated_at' => now(),
                    ]);

                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticketId,
                    'action_type' => 'accept',
                    'action_by_ID' => $empId,
                    'actor_type' => 'employee',
                    'details' => json_encode(['message' => 'Assignment accepted by employee.']),
                    'created_at' => now(),
                ]);
            });

            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
            if ($ticket) {
                $customerId = $ticket->created_by;
                $title = $ticket->title;
                $emp = DB::table('employees')->where('emp_id', $empId)->first();
                $empName = $emp ? ($emp->first_name . ' ' . $emp->last_name) : 'Engineer';

                $this->notifyCustomer(
                    $customerId,
                    'Ticket Accepted',
                    "Engineer " . $empName . " has accepted and is now working on your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $title . "\".",
                    $ticketId
                );

                $catNameAcc = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                $prioNameAcc = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                $this->sendCustomerEmail(
                    $customerId,
                    'Ticket Accepted',
                    "Engineer " . $empName . " has accepted and is now working on your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $title . "\".",
                    $ticketId,
                    $title,
                    $catNameAcc,
                    $prioNameAcc
                );

                $this->notifyCS(
                    'Ticket Accepted',
                    "Engineer " . $empName . " has accepted ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $title . "\".",
                    $ticketId
                );
            }

            $this->broadcastTicketChange('accepted', $ticketId, [
                'assigned_to' => $empId,
                'employee_ids' => [$empId],
            ]);

            // Auto-generate system acceptance message in chat
            try {
                $emp = DB::table('employees')->where('emp_id', $empId)->first();
                $empName = $emp ? ($emp->first_name . ' ' . $emp->last_name) : 'Engineer';

                \Illuminate\Support\Facades\Http::withHeaders([
                    'X-Internal-Token' => env('INTERNAL_TOKEN'),
                ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                    'message' => "System: Service Engineer {$empName} has accepted and is now working on your ticket.",
                    'sender_name' => 'System',
                    'sender_type' => 'system',
                    'sender_id' => null,
                ]);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Failed to send internal acceptance message in acceptTicket: " . $e->getMessage());
            }

            $this->clearTicketCaches();

            return response()->json(['message' => 'Ticket accepted and updated.']);
        }

        // 2. Customer Service assign logic
        // Guard: non-CS employees should only use the branch above (which returns early).
        // If a non-CS employee somehow reaches here, it means they are not assigned to
        // this ticket — return a clear error instead of silently resetting the ticket status.
        if ($user && $user->role !== 'customer service') {
            return response()->json(['message' => 'You are not assigned to this ticket.'], 403);
        }

        // Only unauthenticated requests or CS users proceed below.
        if (!$user) {
            return response()->json(['message' => 'Unauthorized. Please log in.'], 401);
        }

        $validated = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['integer', 'exists:employees,emp_id'],
            'assigned_by_email' => ['nullable', 'email'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
        ]);

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $assignedBy = DB::table('employees')
            ->where('email', $validated['assigned_by_email'] ?? '')
            ->value('emp_id') ?? ($user ? $user->emp_id : 2);

        $employees = collect($validated['employee_ids'] ?? []);
        $changes = [];

        if ($employees->count() > 0) {
            $newAssigned = $employees->first();
            if ($ticket->assigned_to != $newAssigned) {
                $changes[] = ['field' => 'assigned_to', 'old' => $ticket->assigned_to, 'new' => $newAssigned];
            }
        }

        if (array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null) {
            if ($ticket->priority_ID != $validated['priority_ID']) {
                $changes[] = ['field' => 'priority_ID', 'old' => $ticket->priority_ID, 'new' => $validated['priority_ID']];
            }
        }

        DB::transaction(function () use ($ticketId, $validated, $assignedBy, $employees, $changes) {
            $pendingAssignmentId = DB::table('ticket_statuses')
                ->whereRaw('LOWER(status_name) = ?', ['pending assignment'])
                ->value('ticket_status_ID') ?? 7;

            $update = ['updated_at' => now(), 'ticket_status_ID' => $pendingAssignmentId];
            if ($employees->count() > 0) {
                $update['assigned_to'] = $employees->first();
            }
            if (array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null) {
                $update['priority_ID'] = $validated['priority_ID'];
            }

            DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

            if ($employees->count() > 0) {
                $existing = DB::table('ticket_assignments')
                    ->where('ticket_ID', $ticketId)
                    ->get()
                    ->keyBy('employee_ID');

                $newEmpIds = $employees->all();
                $toRemove = $existing->keys()->diff($newEmpIds);
                $toAdd = collect($newEmpIds)->diff($existing->keys());

                if ($toRemove->isNotEmpty()) {
                    DB::table('ticket_assignments')
                        ->where('ticket_ID', $ticketId)
                        ->whereIn('employee_ID', $toRemove)
                        ->delete();
                }

                foreach ($toAdd as $employeeId) {
                    DB::table('ticket_assignments')->insert([
                        'ticket_ID' => $ticketId,
                        'employee_ID' => $employeeId,
                        'assigned_by' => $assignedBy,
                        'assignment_status' => 'assigned',
                        'assigned_at' => now(),
                        'completed_at' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                DB::table('reassignment_requests')
                    ->where('ticket_id', $ticketId)
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'approved',
                        'reviewed_at' => now(),
                        'updated_at' => now(),
                    ]);
            }

            foreach ($changes as $chg) {
                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticketId,
                    'action_type' => 'update',
                    'action_by_ID' => $assignedBy,
                    'actor_type' => 'employee',
                    'details' => json_encode($chg),
                    'created_at' => now(),
                ]);
            }
        });

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $ticketLink = url("/tickets/{$ticketId}");

        foreach ($employees as $employeeId) {
            $empName = DB::table('employees')->where('emp_id', $employeeId)->selectRaw("CONCAT(first_name, ' ', last_name) as name")->value('name') ?? 'Employee';
            $this->notifyRecipient(
                $employeeId,
                'employee',
                'Ticket Assigned',
                "Ticket {$ticketRef}: \"" . $ticket->title . "\" has been assigned to you.",
                $ticketId,
                ['ticket_id' => $ticketId, 'ticket_ref' => $ticketRef, 'title' => $ticket->title, 'type' => 'ticket_assigned']
            );

            $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->sendTicketEmail(
                $employeeId,
                'Ticket Assigned',
                "Ticket {$ticketRef}: \"{$ticket->title}\" has been assigned to you.",
                $ticketId,
                $ticket->title,
                $catName,
                $prioName
            );
        }

        // Notify customer that a technician has been assigned (not yet accepted)
        $this->notifyCustomer(
            $ticket->created_by,
            'Ticket Assigned',
            "Your ticket {$ticketRef}: \"" . $ticket->title . "\" has been assigned to a technician and is pending their acceptance.",
            $ticketId
        );

        $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
        $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
        $this->sendCustomerEmail(
            $ticket->created_by,
            'Ticket Assigned',
            "Your ticket {$ticketRef}: \"" . $ticket->title . "\" has been assigned to a technician and is pending their acceptance.",
            $ticketId,
            $ticket->title,
            $catName,
            $prioName
        );
        
        $this->broadcastTicketChange('assigned', $ticketId, [
            'assigned_to' => $employees->first(),
            'employee_ids' => $employees->all(),
        ]);

        // Auto-generate system assignment message in chat
        try {
            $empNames = DB::table('employees')
                ->whereIn('emp_id', $employees->all())
                ->selectRaw("CONCAT(first_name, ' ', last_name) as name")
                ->pluck('name')
                ->all();
            $empNamesStr = implode(', ', $empNames);

            \Illuminate\Support\Facades\Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "System: A Service Engineer ({$empNamesStr}) has been assigned to your ticket.",
                'sender_name' => 'System',
                'sender_type' => 'system',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to send internal assignment message in acceptTicket (CS): " . $e->getMessage());
        }

        $this->clearTicketCaches();

        return response()->json(['message' => 'Ticket assigned successfully.']);
    }

    public function updateTicket(Request $request, int $ticketId)
    {
        $validated = $request->validate([
            'ticket_status_ID' => ['nullable', 'integer', 'exists:ticket_statuses,ticket_status_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'assigned_by_email' => ['nullable', 'email'],
            'proof_rejected' => ['nullable', 'boolean'],
            'rejection_reason' => ['nullable', 'string'],
        ]);

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $user = $request->user();

        // Customers must not update internal tickets
        if ($ticket->is_internal && $user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        if (array_key_exists('ticket_status_ID', $validated)) {
            $newStatus = $validated['ticket_status_ID'];
            
            // Resolve access rule:
            if ($newStatus == 3 && $ticket->is_internal) {
                $isCS = ($user && !($user instanceof \App\Models\Client) && strtolower($user->role) === 'customer service');
                if (!$isCS) {
                    return response()->json(['message' => 'Only the assigned employee or customer service can resolve an internal ticket.'], 403);
                }
            }
            
            // Close access rule:
            if ($newStatus == 4 && $ticket->is_internal) {
                $isCS = ($user && !($user instanceof \App\Models\Client) && strtolower($user->role) === 'customer service');
                $isRequestor = ($user && !($user instanceof \App\Models\Client) && $user->emp_id == $ticket->requested_by);
                if (!$isCS && !$isRequestor) {
                    return response()->json(['message' => 'Only the requestor or a customer service agent can close an internal ticket.'], 403);
                }
            }
        }

        // Resolving check: Must have department and assignments
        if (array_key_exists('ticket_status_ID', $validated) && $validated['ticket_status_ID'] == 3) {
            $department = DB::table('employees')
                ->where('emp_id', $ticket->assigned_to)
                ->value('department');
            if (empty($department)) {
                return response()->json(['message' => 'Cannot resolve ticket: Department is not set.'], 422);
            }
            $hasAssignment = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->exists();
            if (!$hasAssignment) {
                return response()->json(['message' => 'Cannot resolve ticket: No employees are assigned.'], 422);
            }
        }

        // Reopening check: Must be within 48 hours of resolution
        if (array_key_exists('ticket_status_ID', $validated) && ($validated['ticket_status_ID'] == 2 || $validated['ticket_status_ID'] == 8)) {
            if ($ticket->ticket_status_ID == 3 || $ticket->ticket_status_ID == 4) {
                $resolvedAt = $ticket->resolved_at ? \Carbon\Carbon::parse($ticket->resolved_at) : null;
                if ($resolvedAt && $resolvedAt->diffInHours(now()) > 48) {
                    return response()->json(['message' => 'Cannot reopen ticket: More than 48 hours have passed since resolution.'], 422);
                }
            }
        }

        $assignedBy = DB::table('employees')
            ->where('email', $validated['assigned_by_email'] ?? '')
            ->value('emp_id') ?? 2;

        $changes = [];

        if (array_key_exists('ticket_status_ID', $validated) && $validated['ticket_status_ID'] !== null) {
            $statusToSet = $validated['ticket_status_ID'];
            if ($ticket->ticket_status_ID != $statusToSet) {
                $changes[] = ['field' => 'ticket_status_ID', 'old' => $ticket->ticket_status_ID, 'new' => $statusToSet];
            }
        }

        if (array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null) {
            if ($ticket->priority_ID != $validated['priority_ID']) {
                $changes[] = ['field' => 'priority_ID', 'old' => $ticket->priority_ID, 'new' => $validated['priority_ID']];
            }
        }

        if (array_key_exists('proof_rejected', $validated)) {
            if ((bool)$ticket->proof_rejected != (bool)$validated['proof_rejected']) {
                $changes[] = ['field' => 'proof_rejected', 'old' => $ticket->proof_rejected, 'new' => $validated['proof_rejected']];
            }
        }

        if (array_key_exists('rejection_reason', $validated)) {
            if ($ticket->rejection_reason != $validated['rejection_reason']) {
                $changes[] = ['field' => 'rejection_reason', 'old' => $ticket->rejection_reason, 'new' => $validated['rejection_reason']];
            }
        }

        if (empty($changes)) {
            return response()->json(['message' => 'No changes to update.']);
        }

        $user = $request->user();
        $actorType = ($user && $user instanceof \App\Models\Client) ? 'customer' : 'employee';

        DB::transaction(function () use ($ticketId, $validated, $assignedBy, $changes, $ticket, $actorType) {
            $update = ['updated_at' => now()];
            if (array_key_exists('ticket_status_ID', $validated) && $validated['ticket_status_ID'] !== null) {
                $statusToSet = $validated['ticket_status_ID'];
                $update['ticket_status_ID'] = $statusToSet;
                
                if ($statusToSet == 3) {
                    if (!$ticket->resolved_at) {
                        $update['resolved_at'] = now();
                    }
                }
                if ($statusToSet == 4) {
                    if (!$ticket->resolved_at) {
                        $update['resolved_at'] = now();
                    }
                    $update['closed_at'] = now();
                }
                
                // Reset metadata if reopened
                if (($statusToSet == 2 || $statusToSet == 8) && ($ticket->ticket_status_ID == 3 || $ticket->ticket_status_ID == 4 || $ticket->ticket_status_ID == 6)) {
                    $isProofRejection = ($statusToSet == 2 && $ticket->ticket_status_ID == 6 && (array_key_exists('proof_rejected', $validated) && $validated['proof_rejected']));

                    if (!$isProofRejection) {
                        $update['resolved_at'] = null;
                        $update['closed_at'] = null;
                        $update['proof_rejected'] = false;
                        $update['rejection_reason'] = null;
                        $update['assigned_to'] = null;

                        // Delete assignments for this ticket
                        DB::table('ticket_assignments')->where('ticket_ID', $ticketId)->delete();
                    } else {
                        // It is a proof rejection. Reset resolved/closed dates, but KEEP assignments.
                        $update['resolved_at'] = null;
                        $update['closed_at'] = null;
                    }
                }
            }
            if (array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null) {
                $update['priority_ID'] = $validated['priority_ID'];
            }
            if (array_key_exists('proof_rejected', $validated)) {
                $update['proof_rejected'] = $validated['proof_rejected'];
            }
            if (array_key_exists('rejection_reason', $validated)) {
                $update['rejection_reason'] = $validated['rejection_reason'];
            }

            DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

            foreach ($changes as $chg) {
                $actionType = 'update';
                if ($chg['field'] === 'ticket_status_ID' && ($chg['old'] == 3 || $chg['old'] == 4) && ($chg['new'] == 2 || $chg['new'] == 8)) {
                    $actionType = 'reopen';
                }

                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticketId,
                    'action_type' => $actionType,
                    'action_by_ID' => $assignedBy,
                    'actor_type' => $actorType,
                    'details' => json_encode($chg),
                    'created_at' => now(),
                ]);
            }
        });

        // Send notifications on proof rejection or approval
        if (array_key_exists('proof_rejected', $validated) && $validated['proof_rejected']) {
            $assignedEmployeeId = $ticket->assigned_to;
            if ($assignedEmployeeId) {
                $ticketRefForProof = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
                $proofRejectData = [
                    'ticket_id' => $ticketId,
                    'ticket_ref' => $ticketRefForProof,
                    'reason' => $validated['rejection_reason'] ?? '',
                    'type' => 'proof_rejected',
                ];
                $this->notifyRecipient(
                    $assignedEmployeeId,
                    'employee',
                    'Proof of Completion Rejected',
                    "Your proof of completion for ticket {$ticketRefForProof} has been rejected. Reason: \"" . ($validated['rejection_reason'] ?? '') . "\".",
                    $ticketId,
                    $proofRejectData
                );
            }
            
            $proofRejectCustData = [
                'ticket_id' => $ticketId,
                'ticket_ref' => 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT),
                'type' => 'proof_rejected',
            ];
            $this->notifyCustomer(
                $ticket->created_by,
                'Proof of Completion Rejected',
                "The proof of completion for ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been rejected by customer service.",
                $ticketId,
                $proofRejectCustData
            );

            $catNameRej = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioNameRej = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->sendCustomerEmail(
                $ticket->created_by,
                'Proof of Completion Rejected',
                "The proof of completion for your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been rejected.",
                $ticketId,
                $ticket->title,
                $catNameRej,
                $prioNameRej
            );
        } else if (array_key_exists('ticket_status_ID', $validated) && ($validated['ticket_status_ID'] == 3 || $validated['ticket_status_ID'] == 4) && $ticket->ticket_status_ID == 6) {
            $assignedEmployeeId = $ticket->assigned_to;
            if ($assignedEmployeeId) {
                $this->notifyRecipient(
                    $assignedEmployeeId,
                    'employee',
                    'Proof of Completion Approved',
                    "Your proof of completion for ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been approved.",
                    $ticketId
                );
            }

            $statusName = DB::table('ticket_statuses')->where('ticket_status_ID', $validated['ticket_status_ID'])->value('status_name') ?? 'Closed';
            $notificationTitle = "Ticket {$statusName}";
            $statusText = "has been marked as {$statusName}";

            $closedData = [
                'ticket_id' => $ticketId,
                'ticket_ref' => 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT),
                'type' => 'ticket_closed',
            ];
            $this->notifyCustomer(
                $ticket->created_by,
                $notificationTitle,
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " {$statusText}.",
                $ticketId,
                $closedData
            );

            $catNameClose = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioNameClose = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->sendCustomerEmail(
                $ticket->created_by,
                $notificationTitle,
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " {$statusText}.",
                $ticketId,
                $ticket->title,
                $catNameClose,
                $prioNameClose
            );
        }

        // Notify customer of field changes
        foreach ($changes as $chg) {
            $field = $chg['field'];
            $oldVal = $chg['old'];
            $newVal = $chg['new'];
            
            $detailText = '';
            if ($field === 'ticket_status_ID') {
                $oldStatus = DB::table('ticket_statuses')->where('ticket_status_ID', $oldVal)->value('status_name') ?? $oldVal;
                $newStatus = DB::table('ticket_statuses')->where('ticket_status_ID', $newVal)->value('status_name') ?? $newVal;
                $detailText = "status was updated from \"{$oldStatus}\" to \"{$newStatus}\"";
            } elseif ($field === 'priority_ID') {
                $oldPriority = DB::table('ticket_priorities')->where('priority_ID', $oldVal)->value('priority_name') ?? $oldVal;
                $newPriority = DB::table('ticket_priorities')->where('priority_ID', $newVal)->value('priority_name') ?? $newVal;
                $detailText = "priority was updated from \"{$oldPriority}\" to \"{$newPriority}\"";
            }
            
            if ($detailText) {
                $ticketRefFields = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
                $customerTitle = 'Ticket Updated';
                $customerData = null;

                // Dedicated notifications for Resolved/Closed via updateTicket
                if ($field === 'ticket_status_ID') {
                    $newStatusName = DB::table('ticket_statuses')->where('ticket_status_ID', $newVal)->value('status_name') ?? '';
                    if ($newStatusName === 'Resolved') {
                        $customerTitle = 'Ticket Resolved';
                        $customerData = [
                            'ticket_id' => $ticketId,
                            'ticket_ref' => $ticketRefFields,
                            'type' => 'ticket_resolved',
                            'feedback_link' => url("/feedback/{$ticketId}"),
                        ];
                    } elseif ($newStatusName === 'Closed') {
                        $customerTitle = 'Ticket Closed';
                        $customerData = [
                            'ticket_id' => $ticketId,
                            'ticket_ref' => $ticketRefFields,
                            'type' => 'ticket_closed',
                        ];
                    }
                }

                $this->notifyCustomer(
                    $ticket->created_by,
                    $customerTitle,
                    "Your ticket {$ticketRefFields} {$detailText}.",
                    $ticketId,
                    $customerData
                );

                if ($ticket->requested_by) {
                    $this->notifyRecipient(
                        $ticket->requested_by,
                        'employee',
                        'Ticket Updated',
                        "Your requested ticket {$ticketRefFields} {$detailText}.",
                        $ticketId
                    );
                }

                $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                $this->sendCustomerEmail(
                    $ticket->created_by,
                    $customerTitle,
                    "Your ticket {$ticketRefFields}: \"" . $ticket->title . "\" {$detailText}.",
                    $ticketId,
                    $ticket->title,
                    $catName,
                    $prioName
                );
            }
        }

        // Notify employee/CS if ticket reopened by customer
        if (array_key_exists('ticket_status_ID', $validated) && ($validated['ticket_status_ID'] == 2 || $validated['ticket_status_ID'] == 8) && ($ticket->ticket_status_ID == 3 || $ticket->ticket_status_ID == 4)) {
            $assignedEmployeeId = $ticket->assigned_to;
            if ($assignedEmployeeId) {
                $this->notifyRecipient(
                    $assignedEmployeeId,
                    'employee',
                    'Ticket Reopened by Customer',
                    "Ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened by the customer and is back in progress.",
                    $ticketId
                );
            }
            $this->notifyCustomer(
                $ticket->created_by,
                'Ticket Reopened',
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened.",
                $ticketId
            );
            $catNameR = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioNameR = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->sendCustomerEmail(
                $ticket->created_by,
                'Ticket Reopened',
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened.",
                $ticketId,
                $ticket->title,
                $catNameR,
                $prioNameR
            );
            $this->notifyCS(
                'Ticket Reopened by Customer',
                "Ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened by the customer.",
                $ticketId
            );
        }

        $this->broadcastTicketChange('updated', $ticketId, [
            'ticket_status_ID' => $validated['ticket_status_ID'] ?? $ticket->ticket_status_ID,
            'priority_ID' => $validated['priority_ID'] ?? $ticket->priority_ID,
        ]);

        $this->clearTicketCaches();

        return response()->json(['message' => 'Ticket updated successfully.']);
    }

    public function employeeTickets(Request $request)
    {
        $employeeEmail = (string) $request->query('employee_email', '');
        if ($employeeEmail === '') {
            return response()->json(['message' => 'employee_email is required'], 422);
        }

        $employeeId = DB::table('employees')->where('email', $employeeEmail)->value('emp_id');
        if (!$employeeId) {
            return response()->json(['tickets' => []]);
        }

        $rows = DB::table('ticket_assignments as ta')
            ->join('tickets as t', 't.ticket_ID', '=', 'ta.ticket_ID')
            ->leftJoin('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
            ->leftJoin('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
            ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->leftJoin('ticket_types as tt', 'tt.ticket_type_ID', '=', 't.ticket_type_ID')
            ->where('ta.employee_ID', $employeeId)
            ->orderByDesc('ta.assigned_at')
            ->select(
                't.ticket_ID',
                't.title',
                'pc.category_name',
                'ts.status_name',
                'tp.priority_name',
                't.created_at',
                't.updated_at',
                'm.machine_name',
                'm.serial_number',
                'c.client_name',
                'ta.assignment_status',
                't.proof_rejected',
                't.rejection_reason',
                'tt.type_name as ticket_type'
            )
            ->get();

        $ticketIds = $rows->pluck('ticket_ID')->toArray();
        $pendingReassigns = collect();
        $deniedReassigns = collect();

        if (!empty($ticketIds)) {
            $pendingReassigns = DB::table('reassignment_requests')
                ->whereIn('ticket_id', $ticketIds)
                ->where('status', 'pending')
                ->get()
                ->keyBy('ticket_id');

            $deniedReassigns = DB::table('reassignment_requests')
                ->whereIn('ticket_id', $ticketIds)
                ->where('status', 'denied')
                ->get()
                ->keyBy('ticket_id');
        }

        $tickets = $rows->map(function ($row) use ($pendingReassigns, $deniedReassigns) {
            $pendingReassign = $pendingReassigns->get($row->ticket_ID);
            $deniedReassign = $deniedReassigns->get($row->ticket_ID);

            $createdAtObj = is_string($row->created_at) ? \Carbon\Carbon::parse($row->created_at) : $row->created_at;
            $updatedAtObj = is_string($row->updated_at) ? \Carbon\Carbon::parse($row->updated_at) : $row->updated_at;

            return [
                'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
                'ticket_ID' => $row->ticket_ID,
                'title' => $row->title,
                'customer' => $row->client_name ?: 'Unknown Customer',
                'facility' => null,
                'equipment' => ($row->machine_name || $row->serial_number) ? ($row->machine_name . ($row->serial_number ? ' - ' . $row->serial_number : '')) : 'Unspecified Equipment',
                'status' => $row->status_name ?? 'Open',
                'priority' => $row->priority_name ?? 'Low',
                'category' => $row->category_name ?? 'General',
                'date' => $createdAtObj ? $createdAtObj->format('Y-m-d') : now()->format('Y-m-d'),
                'slaStatus' => $this->slaLabel($row->created_at),
                'lastUpdate' => $updatedAtObj ? $updatedAtObj->format('M d, Y') : ($createdAtObj ? $createdAtObj->format('M d, Y') : now()->format('M d, Y')),
                'accepted' => $row->assignment_status === 'accepted',
                'escalated' => strtolower((string) ($row->priority_name ?? '')) === 'critical',
                'reassignmentRequested' => !empty($pendingReassign),
                'reassignmentReason' => $pendingReassign ? $pendingReassign->reason : null,
                'deniedReassignment' => !empty($deniedReassign),
                'proofRejected' => (bool)$row->proof_rejected,
                'rejectionReason' => $row->rejection_reason,
                'type' => $row->ticket_type ?? 'External',
                'ticket_type' => $row->ticket_type ?? 'External',
                'is_internal' => ($row->ticket_type ?? '') === 'Internal',
            ];
        })->values();

        return response()->json([
            'tickets' => $tickets,
        ]);
    }

    public function employeeProfile(Request $request)
    {
        $user = $request->user();
        if (!$user || $user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $employee = DB::table('employees')->where('emp_id', $user->emp_id)->first();
        if (!$employee) {
            return response()->json(['message' => 'Employee not found'], 404);
        }

        return response()->json([
            'emp_id' => $employee->emp_id,
            'name' => $employee->first_name . ' ' . $employee->last_name,
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'email' => $employee->email,
            'department' => $employee->department,
            'role' => $employee->role,
        ]);
    }

    public function internalTickets(Request $request)
    {
        $user = $request->user();
        if (!$user || $user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $internalTypeId = DB::table('ticket_types')
            ->whereRaw('LOWER(type_name) = ?', ['internal'])
            ->value('ticket_type_ID');

        $rows = DB::table('tickets as t')
            ->join('ticket_types as tt', 'tt.ticket_type_ID', '=', 't.ticket_type_ID')
            ->leftJoin('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
            ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->leftJoin('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
            ->where('t.ticket_type_ID', $internalTypeId)
            ->where('t.requested_by', $user->emp_id)
            ->orderByDesc('t.created_at')
            ->select(
                't.ticket_ID',
                't.title',
                't.description',
                't.assigned_to',
                'pc.category_name',
                'ts.status_name',
                'tp.priority_name',
                't.created_at',
                't.updated_at',
                'm.machine_name',
                'm.serial_number',
                'c.client_name',
                'tt.type_name as ticket_type'
            )
            ->get();

        $tickets = $rows->map(function ($row) {
            return [
                'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
                'ticket_ID' => $row->ticket_ID,
                'title' => $row->title,
                'description' => $row->description,
                'category' => $row->category_name ?? 'General',
                'status' => $row->status_name ?? 'Open',
                'priority' => $row->priority_name ?? 'Low',
                'customer' => $row->client_name ?: 'Unknown Customer',
                'equipment' => ($row->machine_name || $row->serial_number) ? ($row->machine_name . ($row->serial_number ? ' - ' . $row->serial_number : '')) : 'Unspecified Equipment',
                'date' => optional($row->created_at)->format('Y-m-d') ?? now()->format('Y-m-d'),
                'lastUpdate' => optional($row->updated_at)->format('M d, Y') ?? now()->format('M d, Y'),
                'slaStatus' => $this->slaLabel($row->created_at),
                'type' => $row->ticket_type ?? 'Internal',
                'is_internal' => true,
                'assigned_to' => $row->assigned_to,
            ];
        })->values();

        return response()->json([
            'tickets' => $tickets,
        ]);
    }

    public function reassignRequest(Request $request, int $ticketId)
    {
        $validated = $request->validate([
            'reason' => ['required', 'string'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $empId = $user->emp_id;

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $assignment = DB::table('ticket_assignments')
            ->where('ticket_ID', $ticketId)
            ->where('employee_ID', $empId)
            ->first();

        if (!$assignment) {
            return response()->json(['message' => 'You are not assigned to this ticket.'], 403);
        }

        DB::transaction(function () use ($ticketId, $empId, $validated) {
            DB::table('reassignment_requests')->insert([
                'ticket_id' => $ticketId,
                'employee_id' => $empId,
                'reason' => $validated['reason'],
                'status' => 'pending',
                'requested_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->where('employee_ID', $empId)
                ->update([
                    'assignment_status' => 'reassign_requested',
                    'updated_at' => now(),
                ]);

            DB::table('ticket_audit_logs')->insert([
                'ticket_ID' => $ticketId,
                'action_type' => 'reassign_request',
                'action_by_ID' => $empId,
                'actor_type' => 'employee',
                'details' => json_encode(['reason' => $validated['reason']]),
                'created_at' => now(),
            ]);
        });

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if ($ticket) {
            $customerId = $ticket->created_by;
            $title = $ticket->title;
            $emp = DB::table('employees')->where('emp_id', $empId)->first();
            $empName = $emp ? ($emp->first_name . ' ' . $emp->last_name) : 'Engineer';
            $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);

            $csData = [
                'ticket_id' => $ticketId,
                'ticket_ref' => $ticketRef,
                'title' => $title,
                'requesting_employee' => $empName,
                'reason' => $validated['reason'],
                'type' => 'reassignment_request',
            ];

            $this->notifyCS(
                'Reassignment Requested',
                "Engineer " . $empName . " has requested reassignment for Ticket {$ticketRef}: \"" . $title . "\". Reason: \"" . $validated['reason'] . "\".",
                $ticketId,
                $csData
            );

            $this->notifyCustomer(
                $customerId,
                'Reassignment Requested',
                "Engineer " . $empName . " has requested reassignment for your ticket {$ticketRef}: \"" . $title . "\".",
                $ticketId
            );

            $catNameReas = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioNameReas = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->sendCustomerEmail(
                $customerId,
                'Reassignment Requested',
                "Engineer " . $empName . " has requested reassignment for your ticket {$ticketRef}: \"" . $title . "\".",
                $ticketId,
                $title,
                $catNameReas,
                $prioNameReas
            );
        }

        $this->broadcastTicketChange('reassign_requested', $ticketId, [
            'employee_id' => $empId,
            'reason' => $validated['reason'],
        ]);

        $this->clearTicketCaches();

        return response()->json(['message' => 'Reassignment request submitted successfully.']);
    }

    public function reassignRespond(Request $request, int $ticketId)
    {
        $rules = [
            'action' => ['required', 'string', 'in:approve,deny'],
        ];

        $user = $request->user();
        if (!$user || $user->role !== 'customer service') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $csEmpId = $user->emp_id;

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        if ($ticket->ticket_status_ID == 3) {
            return response()->json(['message' => 'Resolved tickets cannot be reassigned.'], 422);
        }

        $pendingRequest = DB::table('reassignment_requests')
            ->where('ticket_id', $ticketId)
            ->where('status', 'pending')
            ->first();

        if (!$pendingRequest) {
            return response()->json(['message' => 'No pending reassignment request found for this ticket.'], 404);
        }

        $targetEmpId = $pendingRequest->employee_id;

        if ($request->input('action') === 'approve') {
            $rules['new_employee_id'] = ['nullable', 'integer', 'exists:employees,emp_id'];
        } else {
            $rules['reason'] = ['nullable', 'string'];
        }

        $validated = $request->validate($rules);

        $newEmpId = $validated['new_employee_id'] ?? null;

        DB::transaction(function () use ($ticketId, $pendingRequest, $validated, $csEmpId, $targetEmpId, $newEmpId) {
            if ($validated['action'] === 'approve') {
                DB::table('reassignment_requests')
                    ->where('request_id', $pendingRequest->request_id)
                    ->update([
                        'status' => 'approved',
                        'reviewed_at' => now(),
                        'updated_at' => now(),
                    ]);

                DB::table('ticket_assignments')
                    ->where('ticket_ID', $ticketId)
                    ->where('employee_ID', $targetEmpId)
                    ->delete();

                $updateData = ['updated_at' => now()];
                if ($newEmpId) {
                    $inProgressId = DB::table('ticket_statuses')
                        ->whereRaw('LOWER(status_name) = ?', ['in progress'])
                        ->value('ticket_status_ID') ?? 2;
                    $updateData['assigned_to'] = $newEmpId;
                    $updateData['ticket_status_ID'] = $inProgressId;
                } else {
                    $updateData['assigned_to'] = null;
                }

                DB::table('tickets')
                    ->where('ticket_ID', $ticketId)
                    ->update($updateData);

                if ($newEmpId) {
                    DB::table('ticket_assignments')->insert([
                        'ticket_ID' => $ticketId,
                        'employee_ID' => $newEmpId,
                        'assigned_by' => $csEmpId,
                        'assignment_status' => 'assigned',
                        'assigned_at' => now(),
                        'completed_at' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticketId,
                    'action_type' => 'reassign_approve',
                    'action_by_ID' => $csEmpId,
                    'actor_type' => 'employee',
                    'details' => json_encode([
                        'message' => 'Reassignment request approved.',
                        'new_employee_id' => $newEmpId,
                    ]),
                    'created_at' => now(),
                ]);
            } else {
                DB::table('reassignment_requests')
                    ->where('request_id', $pendingRequest->request_id)
                    ->update([
                        'status' => 'denied',
                        'reviewed_at' => now(),
                        'updated_at' => now(),
                    ]);

                DB::table('ticket_assignments')
                    ->where('ticket_ID', $ticketId)
                    ->where('employee_ID', $targetEmpId)
                    ->update([
                        'assignment_status' => 'assigned',
                        'updated_at' => now(),
                    ]);

                $openId = DB::table('ticket_statuses')
                    ->whereRaw('LOWER(status_name) = ?', ['open'])
                    ->value('ticket_status_ID') ?? 1;

                DB::table('tickets')
                    ->where('ticket_ID', $ticketId)
                    ->update([
                        'assigned_to' => $targetEmpId,
                        'ticket_status_ID' => $openId,
                        'updated_at' => now(),
                    ]);

                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticketId,
                    'action_type' => 'reassign_deny',
                    'action_by_ID' => $csEmpId,
                    'actor_type' => 'employee',
                    'details' => json_encode([
                        'message' => 'Reassignment request denied.',
                        'reason' => $validated['reason'] ?? '',
                    ]),
                    'created_at' => now(),
                ]);
            }
        });

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if ($ticket) {
            $customerId = $ticket->created_by;
            $title = $ticket->title;
            $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
            $categoryName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $priorityName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID)->value('priority_name') ?? '';
            $ticketLink = url("/tickets/{$ticketId}");

            if ($validated['action'] === 'approve') {
                $this->notifyRecipient(
                    $targetEmpId,
                    'employee',
                    'Reassignment Approved',
                    "Your reassignment request for Ticket {$ticketRef}: \"" . $title . "\" was approved.",
                    $ticketId,
                    ['ticket_id' => $ticketId, 'ticket_ref' => $ticketRef, 'title' => $title, 'type' => 'reassignment_approved']
                );

                if ($newEmpId) {
                    $newEmpData = DB::table('employees')->where('emp_id', $newEmpId)->first();
                    $newEmpName = $newEmpData ? ($newEmpData->first_name . ' ' . $newEmpData->last_name) : 'Engineer';

                    $assignData = [
                        'ticket_id' => $ticketId,
                        'ticket_ref' => $ticketRef,
                        'title' => $title,
                        'category' => $categoryName,
                        'priority' => $priorityName,
                        'type' => 'ticket_assigned',
                    ];

                    $this->notifyRecipient(
                        $newEmpId,
                        'employee',
                        'Ticket Reassigned',
                        "Ticket {$ticketRef}: \"" . $title . "\" has been reassigned to you.",
                        $ticketId,
                        $assignData
                    );

                    $this->sendTicketEmail(
                        $newEmpId,
                        'Ticket Reassigned',
                        "Ticket {$ticketRef}: \"{$title}\" has been reassigned to you.",
                        $ticketId,
                        $title,
                        $categoryName,
                        $priorityName
                    );
                }

                $this->notifyCS(
                    'Reassignment Approved',
                    "Reassignment request for Ticket {$ticketRef}: \"" . $title . "\" was approved." . ($newEmpId ? " Ticket reassigned to {$newEmpName}." : ""),
                    $ticketId,
                    null,
                    $csEmpId
                );
            } else {
                $denialData = [
                    'ticket_id' => $ticketId,
                    'ticket_ref' => $ticketRef,
                    'title' => $title,
                    'type' => 'reassignment_denied',
                    'reason' => $validated['reason'] ?? '',
                ];

                $this->notifyRecipient(
                    $targetEmpId,
                    'employee',
                    'Reassignment Rejected',
                    "Your reassignment request for Ticket {$ticketRef}: \"" . $title . "\" was rejected. Reason: \"" . ($validated['reason'] ?? '') . "\".",
                    $ticketId,
                    $denialData
                );

                $this->notifyCS(
                    'Reassignment Rejected',
                    "Reassignment request for Ticket {$ticketRef}: \"" . $title . "\" was rejected by CSR. Reason: \"" . ($validated['reason'] ?? '') . "\".",
                    $ticketId,
                    null,
                    $csEmpId
                );
            }

            $this->notifyCustomer(
                $customerId,
                $validated['action'] === 'approve' ? 'Ticket Reassigned' : 'Reassignment Rejected',
                $validated['action'] === 'approve'
                    ? "Reassignment request for your ticket {$ticketRef}: \"" . $title . "\" was approved. The ticket has been reassigned to a new engineer."
                    : "Reassignment request for ticket {$ticketRef}: \"" . $title . "\" was rejected.",
                $ticketId
            );

            $reassignEmailSubject = $validated['action'] === 'approve' ? 'Ticket Reassigned' : 'Reassignment Rejected';
            $reassignEmailMessage = $validated['action'] === 'approve'
                ? "Reassignment request for your ticket {$ticketRef}: \"" . $title . "\" was approved. The ticket has been reassigned to a new engineer."
                : "Reassignment request for ticket {$ticketRef}: \"" . $title . "\" was rejected.";
            $this->sendCustomerEmail(
                $customerId,
                $reassignEmailSubject,
                $reassignEmailMessage,
                $ticketId,
                $title,
                $categoryName,
                $priorityName
            );
        }

        $this->broadcastTicketChange('reassigned_response', $ticketId, [
            'action' => $validated['action'],
            'employee_id' => $targetEmpId,
        ]);

        $this->clearTicketCaches();

        return response()->json(['message' => 'Reassignment request responded to successfully.']);
    }

    public function reassignmentRequests(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $status = $request->query('status');

        $query = DB::table('reassignment_requests as rr')
            ->join('tickets as t', 't.ticket_ID', '=', 'rr.ticket_id')
            ->join('employees as e', 'e.emp_id', '=', 'rr.employee_id')
            ->select(
                'rr.request_id',
                'rr.ticket_id',
                'rr.employee_id',
                'rr.reason',
                'rr.status',
                'rr.requested_at',
                'rr.reviewed_at',
                't.title as ticket_title',
                'e.first_name',
                'e.last_name',
                'e.email as employee_email'
            );

        if ($user->role !== 'customer service') {
            $query->where('rr.employee_id', $user->emp_id);
        }

        if ($status) {
            $query->where('rr.status', $status);
        }

        $requests = $query->orderByDesc('rr.requested_at')->get()->map(function ($row) {
            return [
                'request_id' => $row->request_id,
                'ticket_id' => $row->ticket_id,
                'id' => 'TKT-' . str_pad((string) $row->ticket_id, 4, '0', STR_PAD_LEFT),
                'employee_id' => $row->employee_id,
                'employee_name' => trim($row->first_name . ' ' . $row->last_name),
                'employee_email' => $row->employee_email,
                'reason' => $row->reason,
                'status' => $row->status,
                'requested_at' => $row->requested_at,
                'reviewed_at' => $row->reviewed_at,
                'ticket_title' => $row->ticket_title,
            ];
        });

        return response()->json([
            'requests' => $requests,
        ]);
    }

    public function show(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $ticket = DB::table('tickets as t')
            ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
            ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->leftJoin('ticket_types as tt', 'tt.ticket_type_ID', '=', 't.ticket_type_ID')
            ->select(
                't.ticket_ID',
                't.title',
                't.description',
                'pc.category_name',
                'ts.status_name',
                'tp.priority_name',
                't.created_at',
                't.updated_at',
                'm.machine_name',
                'm.serial_number',
                'c.client_name',
                't.assigned_to',
                't.proof_rejected',
                't.rejection_reason',
                't.resolved_at',
                't.closed_at',
                't.is_internal',
                't.requested_by',
                'tt.type_name as ticket_type'
            )
            ->where('t.ticket_ID', $ticketId)
            ->first();

        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        // Customers must not view internal tickets
        if ($ticket->is_internal && $user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        // Check if accepted
        $assignment = DB::table('ticket_assignments')
            ->where('ticket_ID', $ticketId)
            ->where('employee_ID', $user->emp_id)
            ->first();

        $accepted = $assignment && $assignment->assignment_status === 'accepted';

        // Check reassignment request
        $pendingReassign = DB::table('reassignment_requests')
            ->where('ticket_id', $ticketId)
            ->where('status', 'pending')
            ->first();

        // Fetch audit logs
        $auditLogs = DB::table('ticket_audit_logs as tal')
            ->leftJoin('employees as e', 'e.emp_id', '=', 'tal.action_by_ID')
            ->select('tal.*', DB::raw("CONCAT(e.first_name, ' ', e.last_name) as employee_name"))
            ->where('tal.ticket_ID', $ticketId)
            ->orderBy('tal.created_at', 'asc')
            ->get();

        // Preload maps to avoid N+1 queries in loops
        $prioritiesMap = DB::table('ticket_priorities')->pluck('priority_name', 'priority_ID')->toArray();
        $statusesMap = DB::table('ticket_statuses')->pluck('status_name', 'ticket_status_ID')->toArray();

        $employeeIds = [];
        foreach ($auditLogs as $log) {
            if ($log->action_type === 'update') {
                $details = json_decode($log->details, true);
                if (($details['field'] ?? '') === 'assigned_to' && !empty($details['new'])) {
                    $employeeIds[] = (int)$details['new'];
                }
            }
        }

        $employeeNamesMap = [];
        if (!empty($employeeIds)) {
            $employeeNamesMap = DB::table('employees')
                ->whereIn('emp_id', array_unique($employeeIds))
                ->select('emp_id', DB::raw("CONCAT(first_name, ' ', last_name) as name"))
                ->pluck('name', 'emp_id')
                ->toArray();
        }

        $internalNotes = [];
        $timeline = [];

        foreach ($auditLogs as $log) {
            $formattedTime = $log->created_at ? \Carbon\Carbon::parse($log->created_at)->format('Y-m-d H:i:s') : '';
            $details = json_decode($log->details, true);

            // Reconstruct timeline events
            $timelineText = '';
            if ($log->action_type === 'create') {
                $timelineText = "Ticket created by customer.";
            } elseif ($log->action_type === 'reopen') {
                $empName = $log->employee_name ?: (($log->actor_type === 'customer') ? 'customer' : 'CS Representative');
                $timelineText = "Ticket reopened by {$empName}.";
            } elseif ($log->action_type === 'accept') {
                $empName = $log->employee_name ?: 'Employee';
                $timelineText = "Assignment accepted by {$empName}.";
            } elseif ($log->action_type === 'reassign_request') {
                $empName = $log->employee_name ?: 'Employee';
                $reason = $details['reason'] ?? '';
                $timelineText = "Reassignment request submitted by {$empName}. Reason: \"{$reason}\"";
            } elseif ($log->action_type === 'reassign_approve') {
                $empName = $log->employee_name ?: 'CS Representative';
                $timelineText = "Reassignment request approved by {$empName}. Ticket status reset to Open.";
            } elseif ($log->action_type === 'reassign_deny') {
                $empName = $log->employee_name ?: 'CS Representative';
                $timelineText = "Reassignment request denied by {$empName}.";
            } elseif ($log->action_type === 'status_change') {
                $newStatus = $details['status'] ?? '';
                $remarks = $details['remarks'] ?? '';
                $filesText = !empty($details['files']) ? ' (Attached: ' . implode(', ', $details['files']) . ')' : '';
                $empName = $log->employee_name ?: (($log->actor_type === 'customer') ? 'customer' : 'employee');
                $timelineText = "Status updated to \"{$newStatus}\" by {$empName}. Remarks: \"{$remarks}\"{$filesText}";
            } elseif ($log->action_type === 'proof_uploaded') {
                $timelineText = "Proof of completion uploaded.";
            } elseif ($log->action_type === 'update') {
                // Priority / assignment updates from CS
                $field = $details['field'] ?? '';
                $newVal = $details['new'] ?? '';
                if ($field === 'priority_ID') {
                    $priorityName = $prioritiesMap[$newVal] ?? $newVal;
                    $timelineText = "Priority updated to \"{$priorityName}\".";
                } elseif ($field === 'assigned_to') {
                    $empName = $employeeNamesMap[$newVal] ?? $newVal;
                    $timelineText = "Ticket assigned to {$empName}.";
                } elseif ($field === 'ticket_status_ID') {
                    $statusName = $statusesMap[$newVal] ?? $newVal;
                    $empName = $log->employee_name ?: (($log->actor_type === 'customer') ? 'customer' : 'CS Representative');
                    $timelineText = "Status updated to \"{$statusName}\" by {$empName}.";
                } else {
                    $timelineText = "Ticket updated: {$field} set to {$newVal}.";
                }
            }

            if ($timelineText) {
                $timeline[] = [
                    'id' => 'timeline-' . $log->log_ID,
                    'type' => 'system',
                    'text' => $timelineText,
                    'timestamp' => $formattedTime,
                ];
            }
        }

        // Build status history from audit logs
        $statusHistory = [];
        // Include the initial status
        $statusHistory[] = [
            'status' => 'Open',
            'timestamp' => optional($ticket->created_at)->format('Y-m-d H:i:s') ?? '',
            'actor' => 'System',
        ];
        foreach ($auditLogs as $log) {
            if ($log->action_type === 'status_change') {
                $details = json_decode($log->details, true);
                $statusHistory[] = [
                    'status' => $details['status'] ?? '',
                    'timestamp' => $log->created_at ? \Carbon\Carbon::parse($log->created_at)->format('Y-m-d H:i:s') : '',
                    'actor' => $log->employee_name ?: 'Employee',
                ];
            } elseif ($log->action_type === 'update') {
                $details = json_decode($log->details, true);
                if (($details['field'] ?? '') === 'ticket_status_ID') {
                    $statusName = $statusesMap[$details['new'] ?? 0] ?? 'Unknown';
                    $statusHistory[] = [
                        'status' => $statusName,
                        'timestamp' => $log->created_at ? \Carbon\Carbon::parse($log->created_at)->format('Y-m-d H:i:s') : '',
                        'actor' => $log->employee_name ?: 'CS Representative',
                    ];
                }
            } elseif ($log->action_type === 'create') {
                $statusHistory[] = [
                    'status' => 'Open',
                    'timestamp' => $log->created_at ? \Carbon\Carbon::parse($log->created_at)->format('Y-m-d H:i:s') : '',
                    'actor' => 'Customer',
                ];
            }
        }

        // Fetch internal notes from DB table
        $dbNotes = DB::table('internal_notes as in')
            ->join('employees as e', 'e.emp_id', '=', 'in.employee_id')
            ->select('in.*', DB::raw("CONCAT(e.first_name, ' ', e.last_name) as employee_name"))
            ->where('in.ticket_id', $ticketId)
            ->orderBy('in.created_at', 'asc')
            ->get()
            ->map(fn($row) => [
                'id' => 'note-' . $row->id,
                'text' => $row->note,
                'author' => $row->employee_name ?: 'Staff Member',
                'timestamp' => $row->created_at ? \Carbon\Carbon::parse($row->created_at)->format('Y-m-d H:i:s') : '',
            ])
            ->all();

        // Fetch remarks from DB table
        $dbRemarks = DB::table('ticket_remarks as tr')
            ->join('employees as e', 'e.emp_id', '=', 'tr.employee_id')
            ->select('tr.*', DB::raw("CONCAT(e.first_name, ' ', e.last_name) as employee_name"))
            ->where('tr.ticket_id', $ticketId)
            ->orderBy('tr.created_at', 'asc')
            ->get()
            ->map(fn($row) => [
                'id' => 'remark-' . $row->id,
                'remark' => $row->remark,
                'author' => $row->employee_name ?: 'Staff Member',
                'timestamp' => $row->created_at ? \Carbon\Carbon::parse($row->created_at)->format('Y-m-d H:i:s') : '',
            ])
            ->all();

        // Append remarks to timeline
        foreach ($dbRemarks as $rem) {
            $timeline[] = [
                'id' => 'timeline-remark-' . $rem['id'],
                'type' => 'remark',
                'text' => "Remark added by " . $rem['author'] . ": \"" . $rem['remark'] . "\"",
                'timestamp' => $rem['timestamp'],
            ];
        }

        // Append internal notes to timeline for employee/CS review
        foreach ($dbNotes as $note) {
            $timeline[] = [
                'id' => 'timeline-note-' . $note['id'],
                'type' => 'internal_note',
                'text' => "Added staff internal note: \"" . $note['text'] . "\"",
                'timestamp' => $note['timestamp'],
            ];
        }

        // Sort timeline by timestamp
        usort($timeline, function($a, $b) {
            return strcmp($a['timestamp'], $b['timestamp']);
        });

        // Fetch attachments from attachment-service
        $attachments = [];
        try {
            $resp = \Illuminate\Support\Facades\Http::get("http://attachment-service:8000/api/attachments?ticket_id={$ticketId}");
            if ($resp->successful()) {
                $attachments = $resp->json('attachments') ?? [];
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to fetch attachments for ticket {$ticketId}: " . $e->getMessage());
        }

        // Fetch proof files from attachment-service
        $proofAttachments = [];
        try {
            $assignments = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->pluck('assignment_ID')
                ->all();

            foreach ($assignments as $assignmentId) {
                $resp = \Illuminate\Support\Facades\Http::get("http://attachment-service:8000/api/attachments?assignment_id={$assignmentId}");
                if ($resp->successful()) {
                    $assignmentAttachments = $resp->json('attachments') ?? [];
                    $proofAttachments = array_merge($proofAttachments, $assignmentAttachments);
                }
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to fetch proof attachments for ticket {$ticketId}: " . $e->getMessage());
        }

        $createdAtFormatted = $ticket->created_at ? \Carbon\Carbon::parse($ticket->created_at)->format('Y-m-d') : '';
        $updatedAtFormatted = $ticket->updated_at ? \Carbon\Carbon::parse($ticket->updated_at)->format('M d, Y') : '';

        // Fetch assigned employee IDs
        $assigned = DB::table('ticket_assignments')
            ->where('ticket_ID', $ticketId)
            ->pluck('employee_ID')
            ->map(fn($id) => (int)$id)
            ->all();

        // Fetch department from first assigned employee
        $department = null;
        if (!empty($assigned)) {
            $department = DB::table('employees')
                ->whereIn('emp_id', $assigned)
                ->value('department');
        }

        return response()->json([
            'id' => 'TKT-' . str_pad((string) $ticket->ticket_ID, 4, '0', STR_PAD_LEFT),
            'ticket_ID' => $ticket->ticket_ID,
            'title' => $ticket->title,
            'description' => $ticket->description,
            'category' => $ticket->category_name,
            'status' => $ticket->status_name,
            'priority' => $ticket->priority_name,
            'date' => $createdAtFormatted,
            'lastUpdate' => $updatedAtFormatted,
            'slaStatus' => $this->slaLabel($ticket->created_at),
            'equipment' => $ticket->machine_name ? ($ticket->machine_name . ' - ' . $ticket->serial_number) : '',
            'customer' => $ticket->client_name,
            'accepted' => $accepted,
            'reassignmentRequested' => !empty($pendingReassign),
            'reassignmentReason' => $pendingReassign ? $pendingReassign->reason : null,
            'proofRejected' => (bool)$ticket->proof_rejected,
            'rejectionReason' => $ticket->rejection_reason,
            'resolved_at' => $ticket->resolved_at,
            'internalNotes' => $dbNotes,
            'remarks' => $dbRemarks,
            'timeline' => $timeline,
            'attachments' => $attachments,
            'proofAttachments' => $proofAttachments,
            'proofFiles' => $proofAttachments,
            'assigned' => $assigned,
            'department' => $department,
            'status_history' => $statusHistory,
            'ticket_type' => $ticket->ticket_type ?? 'External',
            'is_internal' => (bool)$ticket->is_internal,
            'requested_by' => $ticket->requested_by,
        ]);
    }

    public function employeeUpdate(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $empId = $user->emp_id;

        // Verify assignment
        $assignment = DB::table('ticket_assignments')
            ->where('ticket_ID', $ticketId)
            ->where('employee_ID', $empId)
            ->first();

        if (!$assignment) {
            return response()->json(['message' => 'You are not assigned to this ticket.'], 403);
        }

        // Validate
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:In Progress,Pending,Resolved,Pending Assignment,On Hold'],
            'remarks' => ['nullable', 'string', 'max:250'],
            'internal_note' => ['nullable', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['integer'],
            'is_proof' => ['nullable', 'string'], // Flag to indicate if attachments are proof documents
        ]);

        $newStatusName = $validated['status'] ?? null;
        $remarksText = $validated['remarks'] ?? '';
        $internalNoteText = $validated['internal_note'] ?? null;
        $isProof = filter_var($request->input('is_proof', false), FILTER_VALIDATE_BOOLEAN);
        $attachmentIds = $validated['attachments'] ?? [];
        $attachmentNames = [];

        DB::transaction(function () use ($ticketId, $ticket, $empId, $newStatusName, $remarksText, $internalNoteText, $isProof, $request, $assignment, $attachmentIds, &$attachmentNames) {
            if ($isProof) {
                // Fetch old proofs from attachment-service and delete them
                try {
                    $resp = \Illuminate\Support\Facades\Http::get("http://attachment-service:8000/api/attachments?assignment_id={$assignment->assignment_ID}");
                    if ($resp->successful()) {
                        $oldProofs = $resp->json('attachments') ?? [];
                        foreach ($oldProofs as $oldProof) {
                            \Illuminate\Support\Facades\Http::delete("http://attachment-service:8000/api/attachments/{$oldProof['id']}?is_proof=true");
                        }
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error("Failed to delete old proofs in employeeUpdate: " . $e->getMessage());
                }
            }

            // Bind new attachments
            if (!empty($attachmentIds)) {
                try {
                    $resp = \Illuminate\Support\Facades\Http::post('http://attachment-service:8000/api/bind', [
                        'ticket_id' => $isProof ? null : $ticketId,
                        'assignment_id' => $isProof ? $assignment->assignment_ID : null,
                        'attachment_ids' => $attachmentIds,
                        'is_proof' => $isProof
                    ]);
                    if ($resp->successful()) {
                        $attachmentNames = $resp->json('file_names') ?? [];
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error("Failed to bind attachments in employeeUpdate: " . $e->getMessage());
                }
            }

            $emp = DB::table('employees')->where('emp_id', $empId)->first();
            $empName = $emp ? ($emp->first_name . ' ' . $emp->last_name) : 'Engineer';
            $customerId = $ticket->created_by;
            $title = $ticket->title;

            // 2. Process status update
            $statusChanged = false;
            if ($newStatusName) {
                // Map status name to ID
                $statusId = DB::table('ticket_statuses')
                    ->whereRaw('LOWER(status_name) = ?', [strtolower($newStatusName)])
                    ->value('ticket_status_ID');

                if ($statusId && $statusId != $ticket->ticket_status_ID) {
                    $statusChanged = true;
                    $updateFields = [
                        'updated_at' => now(),
                    ];

                    if ($newStatusName === 'Resolved' || $statusId == 3) {
                        $updateFields['resolved_at'] = now();
                    }
                    if ($newStatusName === 'Closed' || $statusId == 4) {
                        if (!$ticket->resolved_at) {
                            $updateFields['resolved_at'] = now();
                        }
                        $updateFields['closed_at'] = now();
                    }
                    $updateFields['ticket_status_ID'] = $statusId;

                    DB::table('tickets')
                        ->where('ticket_ID', $ticketId)
                        ->update($updateFields);

                    // Insert to audit log for status change
                    DB::table('ticket_audit_logs')->insert([
                        'ticket_ID' => $ticketId,
                        'action_type' => 'status_change',
                        'action_by_ID' => $empId,
                        'actor_type' => 'employee',
                        'details' => json_encode([
                            'status' => $newStatusName,
                            'remarks' => $remarksText,
                            'files' => $attachmentNames,
                        ]),
                        'created_at' => now(),
                    ]);

                    // Notify customer & CS of status change
                    $statusNameToNotify = $newStatusName;
                    $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);

                    $customerTitle = 'Ticket Status Updated';
                    if ($newStatusName === 'Resolved') {
                        $customerTitle = 'Ticket Resolved';
                    } elseif ($newStatusName === 'Pending') {
                        $customerTitle = 'Ticket Pending';
                    }

                    $customerNotificationData = null;
                    if ($newStatusName === 'Resolved') {
                        $customerNotificationData = [
                            'ticket_id' => $ticketId,
                            'ticket_ref' => $ticketRef,
                            'type' => 'ticket_resolved',
                            'feedback_link' => url("/feedback/{$ticketId}"),
                        ];
                    }

                    $this->notifyCustomer(
                        $customerId,
                        $customerTitle,
                        "Your ticket {$ticketRef} status has been updated to \"" . $statusNameToNotify . "\". Remark: \"" . $remarksText . "\".",
                        $ticketId,
                        $customerNotificationData
                    );

                    $this->notifyCS(
                        'Ticket Status Updated',
                        "Ticket {$ticketRef} status updated to \"" . $statusNameToNotify . "\" by " . $empName . ". Remark: \"" . $remarksText . "\".",
                        $ticketId
                    );

                    if ($ticket->requested_by && $ticket->requested_by != $empId) {
                        $this->notifyRecipient(
                            $ticket->requested_by,
                            'employee',
                            'Ticket Status Updated',
                            "Your requested ticket {$ticketRef} status has been updated to \"" . $statusNameToNotify . "\".",
                            $ticketId
                        );
                    }

                    $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                    $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                    $this->sendCustomerEmail(
                        $customerId,
                        $customerTitle,
                        "Your ticket {$ticketRef}: \"" . $ticket->title . "\" status has been updated to \"" . $statusNameToNotify . "\".",
                        $ticketId,
                        $ticket->title,
                        $catName,
                        $prioName
                    );
                }
            }

            // 3. Process remarks table entry
            if (!empty($remarksText)) {
                DB::table('ticket_remarks')->insert([
                    'ticket_id' => $ticketId,
                    'employee_id' => $empId,
                    'remark' => $remarksText,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                // If status did not change, notify customer/CS about the new remark
                if (!$statusChanged && !$isProof) {
                    $this->notifyCustomer(
                        $customerId,
                        'New Remark Added',
                        "Engineer " . $empName . " added a remark: \"" . $remarksText . "\" on ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                        $ticketId
                    );

                    $catNameRem = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                    $prioNameRem = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                    $this->sendCustomerEmail(
                        $customerId,
                        'New Remark Added',
                        "Engineer " . $empName . " added a remark: \"" . $remarksText . "\" on your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                        $ticketId,
                        $ticket->title,
                        $catNameRem,
                        $prioNameRem
                    );

                    $this->notifyCS(
                        'New Remark Added',
                        "Engineer " . $empName . " added a remark: \"" . $remarksText . "\" on ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                        $ticketId
                    );
                }
            }

            // 4. Process internal note
            if (!empty($internalNoteText)) {
                DB::table('internal_notes')->insert([
                    'ticket_id' => $ticketId,
                    'employee_id' => $empId,
                    'note' => $internalNoteText,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticketId,
                    'action_type' => 'internal_note',
                    'action_by_ID' => $empId,
                    'actor_type' => 'employee',
                    'details' => json_encode([
                        'note' => $internalNoteText,
                    ]),
                    'created_at' => now(),
                ]);

                // Notify CS of new internal note
                $this->notifyCS(
                    'New Internal Note',
                    "Engineer " . $empName . " added an internal note: \"" . $internalNoteText . "\" on ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                    $ticketId
                );
            }

            // 5. If it is a proof upload, update status to Pending Evaluation
            if ($isProof) {
                // If proof is uploaded, we update status to Pending Evaluation
                $pendingEvaluationId = DB::table('ticket_statuses')
                    ->whereRaw('LOWER(status_name) = ?', ['pending evaluation'])
                    ->value('ticket_status_ID');

                if ($pendingEvaluationId) {
                    DB::table('tickets')
                        ->where('ticket_ID', $ticketId)
                        ->update([
                            'ticket_status_ID' => $pendingEvaluationId,
                            'proof_rejected' => false,
                            'rejection_reason' => null,
                            'updated_at' => now(),
                        ]);

                    DB::table('ticket_audit_logs')->insert([
                        'ticket_ID' => $ticketId,
                        'action_type' => 'proof_uploaded',
                        'action_by_ID' => $empId,
                        'actor_type' => 'employee',
                        'details' => json_encode(['message' => 'Proof of completion uploaded. Ticket status set to Pending Evaluation.']),
                        'created_at' => now(),
                    ]);

                    // Notify customer & CS
                    $ticketRefProof = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
                    $proofUploadData = [
                        'ticket_id' => $ticketId,
                        'ticket_ref' => $ticketRefProof,
                        'employee_name' => $empName,
                        'type' => 'proof_uploaded',
                    ];
                    $this->notifyCustomer(
                        $customerId,
                        'Proof of Completion Uploaded',
                        "Proof of completion has been uploaded for ticket {$ticketRefProof} by " . $empName . ". Status is now Pending Evaluation.",
                        $ticketId,
                        $proofUploadData
                    );

                    $catNameProof = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                    $prioNameProof = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                    $this->sendCustomerEmail(
                        $customerId,
                        'Proof of Completion Uploaded',
                        "Proof of completion has been uploaded for your ticket {$ticketRefProof} by " . $empName . ". Status is now Pending Evaluation.",
                        $ticketId,
                        $ticket->title,
                        $catNameProof,
                        $prioNameProof
                    );

                    $this->notifyCS(
                        'Proof of Completion Uploaded',
                        "Proof of completion has been uploaded for ticket {$ticketRefProof} by " . $empName . ". Ticket status set to Pending Evaluation.",
                        $ticketId,
                        $proofUploadData
                    );
                }
            }
        });

        // Broadcast the update
        $this->broadcastTicketChange('updated', $ticketId);

        $this->clearTicketCaches();

        return response()->json(['message' => 'Ticket updated successfully.']);
    }

    public function destroy(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $statusName = DB::table('ticket_statuses')->where('ticket_status_ID', $ticket->ticket_status_ID)->value('status_name');
        if (strtolower($statusName) !== 'open' || !empty($ticket->assigned_to)) {
            return response()->json(['message' => 'Only unassigned open tickets can be discarded.'], 403);
        }

        if ($user instanceof \App\Models\Client && (int)$ticket->created_by !== (int)$user->id) {
            return response()->json(['message' => 'You do not have permission to discard this ticket.'], 403);
        }

        $discardedStatusId = DB::table('ticket_statuses')
            ->whereRaw('LOWER(status_name) = ?', ['discarded'])
            ->value('ticket_status_ID');

        if (!$discardedStatusId) {
            $discardedStatusId = DB::table('ticket_statuses')->insertGetId([
                'status_name' => 'Discarded',
                'color_code' => '#ef4444',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('tickets')->where('ticket_ID', $ticketId)->update([
            'ticket_status_ID' => $discardedStatusId,
            'updated_at' => now(),
        ]);

        $this->broadcastTicketChange('updated', $ticketId);

        $this->clearTicketCaches();

        return response()->json(['message' => 'Ticket discarded successfully.']);
    }

    public function getSuperAdminConfig(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $equipment = DB::table('machine_categories')
            ->select('category_ID as id', 'category_name as name')
            ->orderBy('category_name')
            ->get();

        $priorities = DB::table('ticket_priorities')
            ->select('priority_ID as id', 'priority_name as name', 'color_code as color')
            ->orderBy('priority_ID')
            ->get();

        return response()->json([
            'equipment' => $equipment,
            'priorities' => $priorities,
        ]);
    }

    public function createSuperAdminEquipment(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $id = DB::table('machine_categories')->insertGetId([
            'category_name' => $validated['name'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Keep problem_categories in sync!
        $exists = DB::table('problem_categories')->where('category_name', $validated['name'])->exists();
        if (!$exists) {
            DB::table('problem_categories')->insert([
                'category_name' => $validated['name'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Audit Log entry
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_create',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Equipment Configuration',
                'target' => $validated['name'],
                'text' => "Created equipment category '{$validated['name']}'",
            ]),
            'created_at' => now(),
        ]);

        // Dispatch Reverb WebSocket broadcast
        event(new \App\Events\TicketChanged(['type' => 'config']));

        $this->clearTicketCaches();

        return response()->json([
            'message' => 'Equipment category created successfully.',
            'id' => $id,
        ], 201);
    }

    public function updateSuperAdminEquipment(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $category = DB::table('machine_categories')->where('category_ID', $id)->first();
        if (!$category) {
            return response()->json(['message' => 'Equipment category not found'], 404);
        }

        DB::table('machine_categories')
            ->where('category_ID', $id)
            ->update([
                'category_name' => $validated['name'],
                'updated_at' => now(),
            ]);

        // Keep problem_categories in sync!
        DB::table('problem_categories')
            ->where('category_name', $category->category_name)
            ->update([
                'category_name' => $validated['name'],
                'updated_at' => now(),
            ]);

        // Audit Log entry
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_update',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Equipment Configuration',
                'target' => $validated['name'],
                'text' => "Updated equipment category from '{$category->category_name}' to '{$validated['name']}'",
            ]),
            'created_at' => now(),
        ]);

        // Dispatch Reverb WebSocket broadcast
        event(new \App\Events\TicketChanged(['type' => 'config']));

        $this->clearTicketCaches();

        return response()->json(['message' => 'Equipment category updated successfully.']);
    }

    public function deleteSuperAdminEquipment(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $category = DB::table('machine_categories')->where('category_ID', $id)->first();
        if (!$category) {
            return response()->json(['message' => 'Equipment category not found'], 404);
        }

        DB::table('machine_categories')->where('category_ID', $id)->delete();

        // Keep problem_categories in sync!
        DB::table('problem_categories')->where('category_name', $category->category_name)->delete();

        // Audit Log entry
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_delete',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Equipment Configuration',
                'target' => $category->category_name,
                'text' => "Deleted equipment category '{$category->category_name}'",
            ]),
            'created_at' => now(),
        ]);

        // Dispatch Reverb WebSocket broadcast
        event(new \App\Events\TicketChanged(['type' => 'config']));

        $this->clearTicketCaches();

        return response()->json(['message' => 'Equipment category deleted successfully.']);
    }

    public function createSuperAdminPriority(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'required|string|max:255',
        ]);

        $id = DB::table('ticket_priorities')->insertGetId([
            'priority_name' => $validated['name'],
            'color_code' => $validated['color'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Audit Log entry
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_create',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Priority Configuration',
                'target' => $validated['name'],
                'text' => "Created priority level '{$validated['name']}' with color '{$validated['color']}'",
            ]),
            'created_at' => now(),
        ]);

        // Dispatch Reverb WebSocket broadcast
        event(new \App\Events\TicketChanged(['type' => 'config']));

        $this->clearTicketCaches();

        return response()->json([
            'message' => 'Priority level created successfully.',
            'id' => $id,
        ], 201);
    }

    public function updateSuperAdminPriority(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'required|string|max:255',
        ]);

        $priority = DB::table('ticket_priorities')->where('priority_ID', $id)->first();
        if (!$priority) {
            return response()->json(['message' => 'Priority level not found'], 404);
        }

        DB::table('ticket_priorities')
            ->where('priority_ID', $id)
            ->update([
                'priority_name' => $validated['name'],
                'color_code' => $validated['color'],
                'updated_at' => now(),
            ]);

        // Audit Log entry
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_update',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Priority Configuration',
                'target' => $validated['name'],
                'text' => "Updated priority level from '{$priority->priority_name}' to '{$validated['name']}' (color: '{$validated['color']}')",
            ]),
            'created_at' => now(),
        ]);

        // Dispatch Reverb WebSocket broadcast
        event(new \App\Events\TicketChanged(['type' => 'config']));

        $this->clearTicketCaches();

        return response()->json(['message' => 'Priority level updated successfully.']);
    }

    public function deleteSuperAdminPriority(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $priority = DB::table('ticket_priorities')->where('priority_ID', $id)->first();
        if (!$priority) {
            return response()->json(['message' => 'Priority level not found'], 404);
        }

        DB::table('ticket_priorities')->where('priority_ID', $id)->delete();

        // Audit Log entry
        DB::table('ticket_audit_logs')->insert([
            'ticket_ID' => null,
            'action_type' => 'config_delete',
            'action_by_ID' => $user->emp_id,
            'actor_type' => 'superadmin',
            'details' => json_encode([
                'module' => 'Priority Configuration',
                'target' => $priority->priority_name,
                'text' => "Deleted priority level '{$priority->priority_name}'",
            ]),
            'created_at' => now(),
        ]);

        // Dispatch Reverb WebSocket broadcast
        event(new \App\Events\TicketChanged(['type' => 'config']));

        $this->clearTicketCaches();

        return response()->json(['message' => 'Priority level deleted successfully.']);
    }

    public function getSuperAdminAuditLogs(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $logs = DB::table('ticket_audit_logs as tal')
            ->leftJoin('employees as e', 'e.emp_id', '=', 'tal.action_by_ID')
            ->leftJoin('tickets as t', 't.ticket_ID', '=', 'tal.ticket_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->select('tal.*', 'e.first_name', 'e.last_name', 'e.role', 'c.client_name')
            ->orderBy('tal.created_at', 'desc')
            ->get();

        $formattedLogs = $logs->map(function ($log) {
            $firstName = $log->first_name ?? 'System';
            $lastName = $log->last_name ?? '';
            $userFullName = trim($firstName . ' ' . $lastName) ?: 'System';
            
            $role = 'System';
            if ($log->actor_type === 'superadmin') {
                $role = 'Super Admin';
            } elseif ($log->actor_type === 'customer') {
                $role = 'Customer';
                $userFullName = $log->client_name ?? 'Customer';
            } elseif ($log->role) {
                $role = ucwords($log->role);
            }

            // Default fallback mappings
            $action = 'Updated';
            $module = 'Tickets';
            $target = $log->ticket_ID ? 'TKT-' . str_pad((string) $log->ticket_ID, 4, '0', STR_PAD_LEFT) : 'System';
            $details = $log->details;

            $detailsDecoded = json_decode($log->details, true);
            if ($log->actor_type === 'superadmin' && $detailsDecoded) {
                // Config log mapping
                $module = $detailsDecoded['module'] ?? 'System';
                $target = $detailsDecoded['target'] ?? 'System';
                $details = $detailsDecoded['text'] ?? '';
                
                if (str_contains($log->action_type, 'create')) {
                    $action = 'Created';
                } elseif (str_contains($log->action_type, 'delete')) {
                    $action = 'Deleted';
                } else {
                    $action = 'Updated';
                }
            } else {
                // Standard ticket log mapping
                if ($log->action_type === 'create') {
                    $action = 'Created';
                    if ($detailsDecoded && isset($detailsDecoded['title'])) {
                        $details = "Created ticket \"" . $detailsDecoded['title'] . "\"";
                    }
                } elseif ($log->action_type === 'accept') {
                    $action = 'Accepted';
                } elseif ($log->action_type === 'reassign_request') {
                    $action = 'Reassign Requested';
                } elseif ($log->action_type === 'reassign_approve') {
                    $action = 'Reassign Approved';
                } elseif ($log->action_type === 'reassign_reject') {
                    $action = 'Reassign Rejected';
                } elseif ($log->action_type === 'internal_note') {
                    $action = 'Internal Note Added';
                } elseif ($log->action_type === 'employee_update') {
                    $action = 'Employee Updated';
                }

                if ($log->action_type !== 'create' && $detailsDecoded) {
                    if (isset($detailsDecoded['field'])) {
                        $field = $detailsDecoded['field'];
                        $oldVal = is_array($detailsDecoded['old']) ? json_encode($detailsDecoded['old']) : ($detailsDecoded['old'] ?? 'null');
                        $newVal = is_array($detailsDecoded['new']) ? json_encode($detailsDecoded['new']) : ($detailsDecoded['new'] ?? 'null');
                        $details = "Changed field '{$field}' from '{$oldVal}' to '{$newVal}'";
                    } elseif (isset($detailsDecoded['message'])) {
                        $details = $detailsDecoded['message'];
                    } elseif (isset($detailsDecoded['reason'])) {
                        $details = "Reason: " . $detailsDecoded['reason'];
                    } elseif (isset($detailsDecoded['note'])) {
                        $details = "Note: " . $detailsDecoded['note'];
                    }
                }
            }

            return [
                'id' => $log->log_ID,
                'timestamp' => $log->created_at,
                'user' => $userFullName,
                'role' => $role,
                'action' => $action,
                'module' => $module,
                'target' => $target,
                'details' => $details,
            ];
        });

        return response()->json($formattedLogs);
    }

    public function getSuperAdminHistory(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $logs = DB::table('ticket_audit_logs as tal')
            ->leftJoin('employees as e', 'e.emp_id', '=', 'tal.action_by_ID')
            ->select('tal.*', 'e.first_name', 'e.last_name', 'e.role')
            ->where('tal.actor_type', 'superadmin')
            ->orWhere('tal.action_type', 'like', 'config_%')
            ->orderBy('tal.created_at', 'desc')
            ->get();

        $formattedLogs = $logs->map(function ($log) {
            $firstName = $log->first_name ?? 'System';
            $lastName = $log->last_name ?? '';
            $userFullName = trim($firstName . ' ' . $lastName) ?: 'System';
            
            $role = 'Super Admin';
            $action = 'Updated';
            $module = 'System';
            $target = 'System';
            $details = $log->details;

            $detailsDecoded = json_decode($log->details, true);
            if ($detailsDecoded) {
                $module = $detailsDecoded['module'] ?? 'System';
                $target = $detailsDecoded['target'] ?? 'System';
                $details = $detailsDecoded['text'] ?? '';
            }

            if (str_contains($log->action_type, 'create')) {
                $action = 'Created';
            } elseif (str_contains($log->action_type, 'delete')) {
                $action = 'Deleted';
            } else {
                $action = 'Updated';
            }

            return [
                'id' => $log->log_ID,
                'timestamp' => $log->created_at,
                'user' => $userFullName,
                'role' => $role,
                'action' => $action,
                'module' => $module,
                'target' => $target,
                'details' => $details,
            ];
        });

        return response()->json($formattedLogs);
    }
}