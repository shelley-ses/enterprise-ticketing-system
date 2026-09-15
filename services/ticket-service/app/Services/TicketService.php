<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TicketService
{
    protected TicketNotificationService $notificationService;
    protected TicketCacheService $cacheService;
    protected SLAService $slaService;

    public function __construct(
        TicketNotificationService $notificationService,
        TicketCacheService $cacheService,
        SLAService $slaService
    ) {
        $this->notificationService = $notificationService;
        $this->cacheService = $cacheService;
        $this->slaService = $slaService;
    }

    /**
     * Proper casing validation rule closure.
     */
    public function validateProperCasing(): \Closure
    {
        return function ($attribute, $value, $fail) {
            $trimmed = trim((string) $value);
            if (empty($trimmed)) return;
            if (!preg_match('/^[A-Z0-9]/', $trimmed)) {
                $fail('The title must start with an uppercase letter or number.');
            }
            $lettersOnly = preg_replace('/[^a-zA-Z]/', '', $trimmed);
            if (mb_strlen($lettersOnly) > 4 && $lettersOnly === mb_strtoupper($lettersOnly)) {
                $fail('The title must be in proper casing and not all uppercase.');
            }
            if ($trimmed === mb_strtolower($trimmed)) {
                $fail('The title must be in proper casing and not all lowercase.');
            }
        };
    }

    /**
     * Compute human-readable SLA label based on creation time.
     */
    public function slaLabel($createdAt): string
    {
        if (!$createdAt) {
            return 'On Track';
        }

        $createdAtObj = is_string($createdAt) ? Carbon::parse($createdAt) : $createdAt;
        $hours = now()->diffInHours($createdAtObj);
        if ($hours >= 48) {
            return 'Breached';
        }
        if ($hours >= 24) {
            return 'At Risk';
        }
        return 'On Track';
    }

    /**
     * Formatted ticket summary used across broadcasts and notifications.
     */
    public function getFullTicketDetails(int $ticketId): ?array
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
                'tt.type_name as ticket_type',
                't.sla_rule_id',
                't.response_due_at',
                't.resolution_due_at',
                't.first_response_at',
                't.resolved_at',
                't.response_sla_status',
                't.resolution_sla_status'
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

        $createdAtObj = is_string($row->created_at) ? Carbon::parse($row->created_at) : $row->created_at;
        $slaStatusEval = $this->slaService->evaluateSlaStatusForTicket($row);

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
            'sla_rule_id' => $row->sla_rule_id,
            'response_due_at' => $row->response_due_at,
            'resolution_due_at' => $row->resolution_due_at,
            'first_response_at' => $row->first_response_at,
            'resolved_at' => $row->resolved_at,
            'response_sla_status' => $slaStatusEval['response_sla_status'] ?? $row->response_sla_status,
            'resolution_sla_status' => $slaStatusEval['resolution_sla_status'] ?? $row->resolution_sla_status,
        ];
    }

    /**
     * Get cached form options for ticket creation modals.
     */
    public function getFormOptions(): array
    {
        return \Illuminate\Support\Facades\Cache::remember('ticket_form_options_cache', 3600, function () {
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
    }

    /**
     * Create external ticket submitted by a customer.
     */
    public function createTicket(array $validated, $user, ?int $departmentId = 2): array
    {
        $clientId = 1;
        if ($user && ($user instanceof \App\Models\Client)) {
            $clientId = $user->id;
        }

        $rawTitle = strip_tags($validated['title']);
        $cleanedTitle = preg_replace('/^(?:\d+[\.\)\-:]|\b[qQ]\d+[:\.]|\b(?:machine|problem|issue|item)[:\-])\s*/i', '', $rawTitle);
        $finalTitle = !empty(trim($cleanedTitle)) ? trim($cleanedTitle) : $rawTitle;

        $externalTypeId = DB::table('ticket_types')->where('type_name', 'External')->value('ticket_type_ID') ?? 2;

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
            'title' => $finalTitle,
            'description' => strip_tags($validated['description']),
            'resolved_at' => null,
            'closed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $priorityName = 'Low';
            if (!empty($validated['priority_ID'])) {
                $priorityName = DB::table('ticket_priorities')->where('priority_ID', $validated['priority_ID'])->value('priority_name') ?? 'Low';
            }
            $this->slaService->assignSlaToTicket(
                $ticketId,
                (int)$departmentId,
                (int)$validated['problem_category_ID'],
                $priorityName,
                now()
            );
        } catch (\Exception $e) {
            Log::warning("Failed to assign SLA in store: " . $e->getMessage());
        }

        $attachmentIds = $validated['attachments'] ?? [];
        if (!empty($attachmentIds)) {
            try {
                Http::post('http://attachment-service:8000/api/bind', [
                    'ticket_id' => $ticketId,
                    'attachment_ids' => $attachmentIds,
                    'is_proof' => false
                ]);
            } catch (\Exception $e) {
                Log::error("Failed to bind attachments in store: " . $e->getMessage());
            }
        }

        $storedAttachments = [];
        try {
            $resp = Http::get("http://attachment-service:8000/api/attachments?ticket_id={$ticketId}");
            if ($resp->successful()) {
                $storedAttachments = $resp->json('attachments') ?? [];
            }
        } catch (\Exception $e) {
            Log::error("Failed to fetch attachments in store: " . $e->getMessage());
        }

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        $this->cacheService->clearTicketCaches();

        $dashboardTicket = DB::table('tickets as t')
            ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->select('t.ticket_ID', 't.title', 'm.machine_name', 'm.serial_number', 'ts.status_name')
            ->where('t.ticket_ID', $ticketId)
            ->first();

        $customerId = $validated['created_by'] ?? 1;
        $clientName = DB::table('clients')->where('id', $customerId)->value('client_name') ?? 'Customer';
        $this->notificationService->notifyCS(
            'New Ticket Created',
            "New Ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $validated['title'] . "\" has been created by " . $clientName . ".",
            $ticketId
        );

        $this->notificationService->notifyCustomer(
            $customerId,
            'Ticket Created',
            "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $validated['title'] . "\" has been created successfully. Our team will review it shortly.",
            $ticketId
        );

        $categoryName = DB::table('problem_categories')->where('problem_category_ID', $validated['problem_category_ID'])->value('category_name') ?? '';
        $priorityName = DB::table('ticket_priorities')->where('priority_ID', $validated['priority_ID'] ?? 1)->value('priority_name') ?? '';
        $this->notificationService->sendCustomerEmail(
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
            'action_by_ID' => 2,
            'actor_type' => 'customer',
            'details' => json_encode([
                'machine_ID' => $validated['machine_ID'],
                'problem_category_ID' => $validated['problem_category_ID'],
                'title' => strip_tags($validated['title']),
            ]),
            'created_at' => now(),
        ]);

        $this->notificationService->broadcastTicketChange('created', $ticketId, [
            'status' => 'Open',
            'title' => $validated['title'],
            'customer_id' => $customerId,
        ]);

        try {
            Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "Hi! I am the Customer Support Assistant. A representative will be with you shortly. For your reference, this chat is for your ticket: TKT-" . str_pad((string)$ticketId, 4, '0', STR_PAD_LEFT) . ".",
                'sender_name' => 'Customer Support Assistant',
                'sender_type' => 'cs',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send initial internal message: " . $e->getMessage());
        }

        return [
            'message' => 'Ticket created successfully.',
            'ticket' => $ticket,
            'dashboard_ticket' => $dashboardTicket ? [
                'id' => 'TKT-' . str_pad((string) $dashboardTicket->ticket_ID, 3, '0', STR_PAD_LEFT),
                'title' => $dashboardTicket->title,
                'equipment' => $dashboardTicket->machine_name . ' - ' . $dashboardTicket->serial_number,
                'status' => $dashboardTicket->status_name,
            ] : null,
            'attachments' => $storedAttachments,
        ];
    }

    /**
     * Create internal ticket submitted by an employee.
     */
    public function createInternalTicket(array $validated, $user, ?int $requestedDepartmentId = null): array
    {
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

        try {
            $deptId = $requestedDepartmentId;
            if (!$deptId && !empty($user->department)) {
                $deptId = DB::table('departments')->whereRaw('LOWER(name) = ?', [strtolower($user->department)])->value('id');
            }
            if (!$deptId) {
                $deptId = 2;
            }
            $priorityName = 'Low';
            if (!empty($validated['priority_ID'])) {
                $priorityName = DB::table('ticket_priorities')->where('priority_ID', $validated['priority_ID'])->value('priority_name') ?? 'Low';
            }
            $this->slaService->assignSlaToTicket(
                $ticketId,
                (int)$deptId,
                (int)$validated['problem_category_ID'],
                $priorityName,
                now()
            );
        } catch (\Exception $e) {
            Log::warning("Failed to assign SLA in storeInternalTicket: " . $e->getMessage());
        }

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
                Http::post('http://attachment-service:8000/api/bind', [
                    'ticket_id' => $ticketId,
                    'attachment_ids' => $attachmentIds,
                    'is_proof' => false
                ]);
            } catch (\Exception $e) {
                Log::error("Failed to bind attachments in storeInternalTicket: " . $e->getMessage());
            }
        }

        $storedAttachments = [];
        try {
            $resp = Http::get("http://attachment-service:8000/api/attachments?ticket_id={$ticketId}");
            if ($resp->successful()) {
                $storedAttachments = $resp->json('attachments') ?? [];
            }
        } catch (\Exception $e) {
            Log::error("Failed to fetch attachments in storeInternalTicket: " . $e->getMessage());
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $this->notificationService->notifyCS(
            'New Internal Ticket Created',
            "New internal ticket {$ticketRef}: \"" . $validated['title'] . "\" has been created and awaits CSR delegation.",
            $ticketId
        );

        $this->notificationService->notifyRecipient(
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

        $this->notificationService->broadcastTicketChange('created', $ticketId, [
            'status' => 'Open',
            'title' => $validated['title'],
        ]);

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        $this->cacheService->clearTicketCaches();

        try {
            Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "Hi! I am the Customer Support Assistant. A representative will be with you shortly. For your reference, this chat is for your ticket: TKT-" . str_pad((string)$ticketId, 4, '0', STR_PAD_LEFT) . ".",
                'sender_name' => 'Customer Support Assistant',
                'sender_type' => 'cs',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send initial internal message: " . $e->getMessage());
        }

        return [
            'message' => 'Internal ticket created successfully.',
            'ticket' => $ticket,
            'id' => 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT),
            'attachments' => $storedAttachments,
        ];
    }

    /**
     * Get detailed ticket data including timeline, attachments, worklogs, and SLA.
     */
    public function showTicket(int $ticketId, $user, bool $isCustomer): ?array
    {
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
                't.problem_category_ID',
                't.machine_ID',
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
            return null;
        }

        if ($ticket->is_internal && $user instanceof \App\Models\Client) {
            return null;
        }

        $assignment = null;
        if (!($user instanceof \App\Models\Client)) {
            $assignment = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->where('employee_ID', $user->emp_id)
                ->first();
        }
        $accepted = $assignment && $assignment->assignment_status === 'accepted';

        $pendingReassign = DB::table('reassignment_requests as rr')
            ->leftJoin('employees as e', 'e.emp_id', '=', 'rr.employee_id')
            ->where('rr.ticket_id', $ticketId)
            ->where('rr.status', 'pending')
            ->select(
                'rr.*',
                DB::raw("CONCAT(e.first_name, ' ', e.last_name) as requesting_employee_name"),
                'e.department as requesting_employee_department'
            )
            ->first();

        $auditLogs = DB::table('ticket_audit_logs as tal')
            ->leftJoin('employees as e', function ($join) {
                $join->on('e.emp_id', '=', 'tal.action_by_ID')
                    ->where('tal.actor_type', '!=', 'customer');
            })
            ->leftJoin('clients as c', function ($join) {
                $join->on('c.id', '=', 'tal.action_by_ID')
                    ->where('tal.actor_type', '=', 'customer');
            })
            ->select(
                'tal.*',
                DB::raw("CONCAT(e.first_name, ' ', e.last_name) as employee_name"),
                'c.client_name as customer_name'
            )
            ->where('tal.ticket_ID', $ticketId)
            ->orderBy('tal.created_at', 'asc')
            ->get();

        $prioritiesMap = DB::table('ticket_priorities')->pluck('priority_name', 'priority_ID')->toArray();
        $statusesMap = DB::table('ticket_statuses')->pluck('status_name', 'ticket_status_ID')->toArray();
        $categoriesMap = DB::table('problem_categories')->pluck('category_name', 'problem_category_ID')->toArray();
        $machinesMap = DB::table('machines')->pluck('machine_name', 'machine_ID')->toArray();

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

        $timeline = [];
        foreach ($auditLogs as $log) {
            $formattedTime = $log->created_at ? Carbon::parse($log->created_at)->toIso8601String() : '';
            $details = json_decode($log->details, true) ?? [];

            $actorName = '';
            if ($log->actor_type === 'customer') {
                $actorName = trim($log->customer_name ?? '') ?: 'Customer';
            } else {
                $emp = trim($log->employee_name ?? '');
                $actorName = $emp ?: 'CS Representative';
            }

            $timelineText = '';
            if ($log->action_type === 'create') {
                $timelineText = "Ticket created by {$actorName}.";
            } elseif ($log->action_type === 'reopen') {
                $timelineText = "Ticket reopened by {$actorName}.";
            } elseif ($log->action_type === 'accept') {
                $timelineText = "Assignment accepted by {$actorName}.";
            } elseif ($log->action_type === 'reassign_request') {
                $reason = $details['reason'] ?? '';
                $timelineText = "Reassignment request submitted by {$actorName}. Reason: \"{$reason}\"";
            } elseif ($log->action_type === 'reassign_approve') {
                $timelineText = "Reassignment request approved by {$actorName}. Ticket status reset to Open.";
            } elseif ($log->action_type === 'reassign_deny') {
                $reason = $details['reason'] ?? '';
                $timelineText = "Reassignment request denied by {$actorName}." . ($reason !== '' ? " Reason: \"{$reason}\"." : '') . " Ticket status returned to In Progress.";
            } elseif ($log->action_type === 'status_change') {
                $newStatus = $details['status'] ?? '';
                $remarks = $details['remarks'] ?? '';
                $filesText = !empty($details['files']) ? ' (Attached: ' . implode(', ', $details['files']) . ')' : '';
                $timelineText = "Status updated to \"{$newStatus}\" by {$actorName}. Remarks: \"{$remarks}\"{$filesText}";
            } elseif ($log->action_type === 'proof_uploaded') {
                $timelineText = "Proof of completion uploaded by {$actorName}.";
            } elseif ($log->action_type === 'update') {
                $field = $details['field'] ?? '';
                $newVal = $details['new'] ?? '';
                if ($field === 'priority_ID') {
                    $priorityName = $prioritiesMap[$newVal] ?? $newVal;
                    $timelineText = "Priority updated to \"{$priorityName}\" by {$actorName}.";
                } elseif ($field === 'assigned_to') {
                    $empName = $employeeNamesMap[$newVal] ?? $newVal;
                    $timelineText = "Ticket assigned to {$empName} by {$actorName}.";
                } elseif ($field === 'ticket_status_ID') {
                    $statusName = $statusesMap[$newVal] ?? $newVal;
                    $timelineText = "Status updated to \"{$statusName}\" by {$actorName}.";
                } elseif ($field === 'title') {
                    $timelineText = "Ticket title edited by {$actorName} to \"{$newVal}\".";
                } elseif ($field === 'description') {
                    $timelineText = "Ticket description edited by {$actorName}.";
                } elseif ($field === 'problem_category_ID') {
                    $catName = $categoriesMap[$newVal] ?? $newVal;
                    $timelineText = "Category updated to \"{$catName}\" by {$actorName}.";
                } elseif ($field === 'machine_ID') {
                    $machName = $machinesMap[$newVal] ?? $newVal;
                    $timelineText = "Machine updated to \"{$machName}\" by {$actorName}.";
                } elseif ($field === 'proof_rejected') {
                    $timelineText = "Proof of completion rejected by {$actorName}.";
                } elseif ($field === 'rejection_reason') {
                    $timelineText = "Rejection reason updated by {$actorName} to: \"{$newVal}\".";
                } else {
                    $timelineText = "Ticket updated by {$actorName}: {$field} changed.";
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

        $statusHistory = [];
        $statusHistory[] = [
            'status' => 'Open',
            'timestamp' => $ticket->created_at ? Carbon::parse($ticket->created_at)->toIso8601String() : '',
            'actor' => 'System',
        ];
        foreach ($auditLogs as $log) {
            if ($log->action_type === 'status_change') {
                $details = json_decode($log->details, true);
                $statusHistory[] = [
                    'status' => $details['status'] ?? '',
                    'timestamp' => $log->created_at ? Carbon::parse($log->created_at)->toIso8601String() : '',
                    'actor' => $log->employee_name ?: 'Employee',
                ];
            } elseif ($log->action_type === 'update') {
                $details = json_decode($log->details, true);
                if (($details['field'] ?? '') === 'ticket_status_ID') {
                    $statusName = $statusesMap[$details['new'] ?? 0] ?? 'Unknown';
                    $statusHistory[] = [
                        'status' => $statusName,
                        'timestamp' => $log->created_at ? Carbon::parse($log->created_at)->toIso8601String() : '',
                        'actor' => $log->employee_name ?: 'CS Representative',
                    ];
                }
            } elseif ($log->action_type === 'create') {
                $statusHistory[] = [
                    'status' => 'Open',
                    'timestamp' => $log->created_at ? Carbon::parse($log->created_at)->toIso8601String() : '',
                    'actor' => 'Customer',
                ];
            }
        }

        $dbNotes = [];
        if (!$isCustomer) {
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
                    'timestamp' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : '',
                ])
                ->all();
        }

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
                'timestamp' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : '',
            ])
            ->all();

        foreach ($dbRemarks as $rem) {
            $timeline[] = [
                'id' => 'timeline-remark-' . $rem['id'],
                'type' => 'remark',
                'text' => "Remark added by " . $rem['author'] . ": \"" . $rem['remark'] . "\"",
                'timestamp' => $rem['timestamp'],
            ];
        }

        if (!$isCustomer) {
            foreach ($dbNotes as $note) {
                $timeline[] = [
                    'id' => 'timeline-note-' . $note['id'],
                    'type' => 'internal_note',
                    'text' => "Added staff internal note: \"" . $note['text'] . "\"",
                    'timestamp' => $note['timestamp'],
                ];
            }
        }

        usort($timeline, function($a, $b) {
            return strcmp($a['timestamp'], $b['timestamp']);
        });

        $attachments = [];
        try {
            $resp = Http::get("http://attachment-service:8000/api/attachments?ticket_id={$ticketId}");
            if ($resp->successful()) {
                $attachments = $resp->json('attachments') ?? [];
            }
        } catch (\Exception $e) {
            Log::error("Failed to fetch attachments for ticket {$ticketId}: " . $e->getMessage());
        }

        $proofAttachments = [];
        try {
            $assignments = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->pluck('assignment_ID')
                ->all();

            foreach ($assignments as $assignmentId) {
                $resp = Http::get("http://attachment-service:8000/api/attachments?assignment_id={$assignmentId}");
                if ($resp->successful()) {
                    $assignmentAttachments = $resp->json('attachments') ?? [];
                    $proofAttachments = array_merge($proofAttachments, $assignmentAttachments);
                }
            }

            if (empty($proofAttachments) && !empty($assignments)) {
                $dbProofs = DB::table('proof_of_completion')
                    ->whereIn('assignment_ID', $assignments)
                    ->get()
                    ->map(function ($row) {
                        return [
                            'id' => $row->proof_ID,
                            'name' => $row->file_name,
                            'url' => str_starts_with($row->file_path, 'http') ? $row->file_path : '/storage/' . $row->file_path,
                            'file_type' => $row->file_type,
                            'size' => $row->file_size,
                            'uploaded_at' => $row->uploaded_at
                        ];
                    })
                    ->all();
                $proofAttachments = $dbProofs;
            }
        } catch (\Exception $e) {
            Log::error("Failed to fetch proof attachments for ticket {$ticketId}: " . $e->getMessage());
        }

        $createdAtIso = $ticket->created_at ? Carbon::parse($ticket->created_at)->toIso8601String() : null;
        $updatedAtIso = $ticket->updated_at ? Carbon::parse($ticket->updated_at)->toIso8601String() : $createdAtIso;
        $resolvedAtIso = $ticket->resolved_at ? Carbon::parse($ticket->resolved_at)->toIso8601String() : null;

        $assigned = DB::table('ticket_assignments')
            ->where('ticket_ID', $ticketId)
            ->pluck('employee_ID')
            ->map(fn($id) => (int)$id)
            ->all();

        $department = null;
        if (!empty($assigned)) {
            $department = DB::table('employees')
                ->whereIn('emp_id', $assigned)
                ->value('department');
        }

        return [
            'id' => 'TKT-' . str_pad((string) $ticket->ticket_ID, 4, '0', STR_PAD_LEFT),
            'ticket_ID' => $ticket->ticket_ID,
            'title' => $ticket->title,
            'description' => $ticket->description,
            'category' => $ticket->category_name,
            'problem_category_ID' => $ticket->problem_category_ID,
            'machine_ID' => $ticket->machine_ID,
            'machine_name' => $ticket->machine_name,
            'serial_number' => $ticket->serial_number,
            'status' => $ticket->status_name,
            'priority' => $ticket->priority_name,
            'date' => $createdAtIso,
            'lastUpdate' => $updatedAtIso,
            'created_at' => $createdAtIso,
            'updated_at' => $updatedAtIso,
            'date_created' => $createdAtIso,
            'last_updated' => $updatedAtIso,
            'slaStatus' => $this->slaLabel($ticket->created_at),
            'equipment' => $ticket->machine_name ? ($ticket->machine_name . ($ticket->serial_number ? ' - ' . $ticket->serial_number : '')) : ($ticket->serial_number ?: 'Not specified'),
            'customer' => $ticket->client_name,
            'accepted' => $accepted,
            'reassignmentRequested' => !empty($pendingReassign),
            'reassignmentReason' => $pendingReassign ? $pendingReassign->reason : null,
            'reassignmentRequestedBy' => $pendingReassign ? ($pendingReassign->requesting_employee_name ?: 'Assigned Employee') : null,
            'reassignmentDepartment' => $pendingReassign ? ($pendingReassign->requesting_employee_department ?: $department) : $department,
            'reassignmentRequestedAt' => $pendingReassign ? ($pendingReassign->requested_at ? Carbon::parse($pendingReassign->requested_at)->toIso8601String() : ($pendingReassign->created_at ? Carbon::parse($pendingReassign->created_at)->toIso8601String() : null)) : null,
            'reassignmentEmployeeId' => $pendingReassign ? (int)$pendingReassign->employee_id : null,
            'proofRejected' => (bool)$ticket->proof_rejected,
            'rejectionReason' => $ticket->rejection_reason,
            'resolved_at' => $resolvedAtIso,
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
        ];
    }

    /**
     * Update ticket properties, status, or details.
     */
    public function updateTicket(int $ticketId, array $validated, $user): array
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return ['status' => 404, 'data' => ['message' => 'Ticket not found']];
        }

        if ($ticket->is_internal && $user instanceof \App\Models\Client) {
            return ['status' => 404, 'data' => ['message' => 'Ticket not found']];
        }

        if ($user instanceof \App\Models\Client) {
            $isEditingContent = array_key_exists('title', $validated) ||
                array_key_exists('description', $validated) ||
                array_key_exists('problem_category_ID', $validated) ||
                array_key_exists('machine_ID', $validated);

            if ($isEditingContent) {
                $statusName = DB::table('ticket_statuses')->where('ticket_status_ID', $ticket->ticket_status_ID)->value('status_name');
                $isOpen = ($ticket->ticket_status_ID == 1 || strtolower((string) $statusName) === 'open');
                $isAssigned = !empty($ticket->assigned_to);

                if (!$isOpen || $isAssigned) {
                    return ['status' => 403, 'data' => ['message' => 'Tickets can only be edited while Open and not yet assigned to an employee.']];
                }
            }
        }

        if (array_key_exists('ticket_status_ID', $validated)) {
            $newStatus = $validated['ticket_status_ID'];
            
            if ($newStatus == 3 && $ticket->is_internal) {
                $isCS = ($user && !($user instanceof \App\Models\Client) && strtolower($user->role) === 'customer service');
                if (!$isCS) {
                    return ['status' => 403, 'data' => ['message' => 'Only the assigned employee or customer service can resolve an internal ticket.']];
                }
            }
            
            if ($newStatus == 4 && $ticket->is_internal) {
                $isCS = ($user && !($user instanceof \App\Models\Client) && strtolower($user->role) === 'customer service');
                $isRequestor = ($user && !($user instanceof \App\Models\Client) && $user->emp_id == $ticket->requested_by);
                if (!$isCS && !$isRequestor) {
                    return ['status' => 403, 'data' => ['message' => 'Only the requestor or a customer service agent can close an internal ticket.']];
                }
            }
        }

        if (array_key_exists('ticket_status_ID', $validated) && $validated['ticket_status_ID'] == 3) {
            $department = DB::table('employees')
                ->where('emp_id', $ticket->assigned_to)
                ->value('department');
            if (empty($department)) {
                return ['status' => 422, 'data' => ['message' => 'Cannot resolve ticket: Department is not set.']];
            }
            $hasAssignment = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->exists();
            if (!$hasAssignment) {
                return ['status' => 422, 'data' => ['message' => 'Cannot resolve ticket: No employees are assigned.']];
            }
        }

        if (array_key_exists('ticket_status_ID', $validated) && ($validated['ticket_status_ID'] == 2 || $validated['ticket_status_ID'] == 8)) {
            if ($ticket->ticket_status_ID == 3 || $ticket->ticket_status_ID == 4) {
                $resolvedAt = $ticket->resolved_at ? Carbon::parse($ticket->resolved_at) : null;
                if ($resolvedAt && $resolvedAt->diffInHours(now()) > 48) {
                    return ['status' => 422, 'data' => ['message' => 'Cannot reopen ticket: More than 48 hours have passed since resolution.']];
                }
            }
        }

        $assignedBy = 2;
        $actorType = 'employee';
        if ($user && ($user instanceof \App\Models\Client || ($user->role ?? '') === 'customer')) {
            $actorType = 'customer';
            $assignedBy = $user->id ?? $user->client_id ?? 1;
        } else {
            if ($user && isset($user->emp_id)) {
                $assignedBy = $user->emp_id;
            } else {
                $assignedBy = DB::table('employees')
                    ->where('email', $validated['assigned_by_email'] ?? '')
                    ->value('emp_id') ?? 2;
            }
        }

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

        if (array_key_exists('title', $validated) && $validated['title'] !== null) {
            $newTitle = strip_tags(trim($validated['title']));
            if ($ticket->title !== $newTitle) {
                $changes[] = ['field' => 'title', 'old' => $ticket->title, 'new' => $newTitle];
            }
        }

        if (array_key_exists('description', $validated) && $validated['description'] !== null) {
            $newDesc = trim($validated['description']);
            if ($ticket->description !== $newDesc) {
                $changes[] = ['field' => 'description', 'old' => $ticket->description, 'new' => $newDesc];
            }
        }

        if (array_key_exists('problem_category_ID', $validated) && $validated['problem_category_ID'] !== null) {
            if ($ticket->problem_category_ID != $validated['problem_category_ID']) {
                $changes[] = ['field' => 'problem_category_ID', 'old' => $ticket->problem_category_ID, 'new' => $validated['problem_category_ID']];
            }
        }

        if (array_key_exists('machine_ID', $validated) && $validated['machine_ID'] !== null) {
            if ($ticket->machine_ID != $validated['machine_ID']) {
                $changes[] = ['field' => 'machine_ID', 'old' => $ticket->machine_ID, 'new' => $validated['machine_ID']];
            }
        }

        if (empty($changes)) {
            return ['status' => 200, 'data' => ['message' => 'No changes to update.']];
        }

        DB::transaction(function () use ($ticketId, $validated, $assignedBy, $changes, $ticket, $actorType) {
            $update = ['updated_at' => now()];
            if (array_key_exists('ticket_status_ID', $validated) && $validated['ticket_status_ID'] !== null) {
                $statusToSet = $validated['ticket_status_ID'];
                $update['ticket_status_ID'] = $statusToSet;
                
                if ($statusToSet == 3 || $statusToSet == 4) {
                    if (!$ticket->resolved_at) {
                        $update['resolved_at'] = now();
                    }
                    if ($statusToSet == 4) {
                        $update['closed_at'] = now();
                    }
                    try {
                        $this->slaService->recordResolution($ticketId, now());
                    } catch (\Exception $e) {
                        Log::warning("Failed to record resolution SLA in updateTicket: " . $e->getMessage());
                    }
                }

                if ($actorType === 'employee') {
                    try {
                        $this->slaService->recordFirstResponse($ticketId, now());
                    } catch (\Exception $e) {}
                }
                
                if (($statusToSet == 2 || $statusToSet == 8) && ($ticket->ticket_status_ID == 3 || $ticket->ticket_status_ID == 4 || $ticket->ticket_status_ID == 6)) {
                    $isProofRejection = ($statusToSet == 2 && $ticket->ticket_status_ID == 6 && (array_key_exists('proof_rejected', $validated) && $validated['proof_rejected']));

                    if (!$isProofRejection) {
                        $update['resolved_at'] = null;
                        $update['closed_at'] = null;
                        $update['proof_rejected'] = false;
                        $update['rejection_reason'] = null;
                        $update['assigned_to'] = null;
                        DB::table('ticket_assignments')->where('ticket_ID', $ticketId)->delete();
                    } else {
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
            if (array_key_exists('title', $validated) && $validated['title'] !== null) {
                $update['title'] = strip_tags(trim($validated['title']));
            }
            if (array_key_exists('description', $validated) && $validated['description'] !== null) {
                $update['description'] = trim($validated['description']);
            }
            if (array_key_exists('problem_category_ID', $validated) && $validated['problem_category_ID'] !== null) {
                $update['problem_category_ID'] = $validated['problem_category_ID'];
            }
            if (array_key_exists('machine_ID', $validated) && $validated['machine_ID'] !== null) {
                $update['machine_ID'] = $validated['machine_ID'];
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
                $this->notificationService->notifyRecipient(
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
            $this->notificationService->notifyCustomer(
                $ticket->created_by,
                'Proof of Completion Rejected',
                "The proof of completion for ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been rejected by customer service.",
                $ticketId,
                $proofRejectCustData
            );

            $catNameRej = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioNameRej = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->notificationService->sendCustomerEmail(
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
                $this->notificationService->notifyRecipient(
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
            $this->notificationService->notifyCustomer(
                $ticket->created_by,
                $notificationTitle,
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " {$statusText}.",
                $ticketId,
                $closedData
            );

            $catNameClose = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioNameClose = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->notificationService->sendCustomerEmail(
                $ticket->created_by,
                $notificationTitle,
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " {$statusText}.",
                $ticketId,
                $ticket->title,
                $catNameClose,
                $prioNameClose
            );
        }

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

                $this->notificationService->notifyCustomer(
                    $ticket->created_by,
                    $customerTitle,
                    "Your ticket {$ticketRefFields} {$detailText}.",
                    $ticketId,
                    $customerData
                );

                if ($ticket->requested_by) {
                    $this->notificationService->notifyRecipient(
                        $ticket->requested_by,
                        'employee',
                        'Ticket Updated',
                        "Your requested ticket {$ticketRefFields} {$detailText}.",
                        $ticketId
                    );
                }

                $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                $this->notificationService->sendCustomerEmail(
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

        if (array_key_exists('ticket_status_ID', $validated) && ($validated['ticket_status_ID'] == 2 || $validated['ticket_status_ID'] == 8) && ($ticket->ticket_status_ID == 3 || $ticket->ticket_status_ID == 4)) {
            $assignedEmployeeId = $ticket->assigned_to;
            if ($assignedEmployeeId) {
                $this->notificationService->notifyRecipient(
                    $assignedEmployeeId,
                    'employee',
                    'Ticket Reopened by Customer',
                    "Ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened by the customer and is back in progress.",
                    $ticketId
                );
            }
            $this->notificationService->notifyCustomer(
                $ticket->created_by,
                'Ticket Reopened',
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened.",
                $ticketId
            );
            $catNameR = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioNameR = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->notificationService->sendCustomerEmail(
                $ticket->created_by,
                'Ticket Reopened',
                "Your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened.",
                $ticketId,
                $ticket->title,
                $catNameR,
                $prioNameR
            );
            $this->notificationService->notifyCS(
                'Ticket Reopened by Customer',
                "Ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . " has been reopened by the customer.",
                $ticketId
            );
        }

        $this->notificationService->broadcastTicketChange('updated', $ticketId, [
            'ticket_status_ID' => $validated['ticket_status_ID'] ?? $ticket->ticket_status_ID,
            'priority_ID' => $validated['priority_ID'] ?? $ticket->priority_ID,
        ]);

        $this->cacheService->clearTicketCaches();
        return ['status' => 200, 'data' => ['message' => 'Ticket updated successfully.']];
    }

    /**
     * Discard an unassigned open ticket.
     */
    public function destroyTicket(int $ticketId, $user): array
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return ['status' => 404, 'data' => ['message' => 'Ticket not found']];
        }

        $statusName = DB::table('ticket_statuses')->where('ticket_status_ID', $ticket->ticket_status_ID)->value('status_name');
        if (strtolower($statusName) !== 'open' || !empty($ticket->assigned_to)) {
            return ['status' => 403, 'data' => ['message' => 'Only unassigned open tickets can be discarded.']];
        }

        if ($user instanceof \App\Models\Client && (int)$ticket->created_by !== (int)$user->id) {
            return ['status' => 403, 'data' => ['message' => 'You do not have permission to discard this ticket.']];
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

        $this->notificationService->broadcastTicketChange('updated', $ticketId);
        $this->cacheService->clearTicketCaches();

        return ['status' => 200, 'data' => ['message' => 'Ticket discarded successfully.']];
    }
}
