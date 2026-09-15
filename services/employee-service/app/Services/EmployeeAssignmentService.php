<?php

namespace App\Services;

use App\Services\SLAService;
use App\Services\TicketCacheService;
use App\Services\TicketNotificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EmployeeAssignmentService
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
     * Assign one or more employees to a ticket.
     */
    public function assignTicket(int $ticketId, array $validated, int $assignedBy): array
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return ['status' => 404, 'data' => ['message' => 'Ticket not found']];
        }

        if ($ticket->ticket_status_ID == 3) {
            return ['status' => 422, 'data' => ['message' => 'Resolved tickets cannot be reassigned.']];
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

            $notificationData = [
                'ticket_id' => $ticketId,
                'ticket_ref' => $ticketRef,
                'title' => $title,
                'category' => $categoryName,
                'priority' => $priorityName,
                'type' => 'ticket_assigned',
            ];

            foreach ($validated['employee_ids'] as $employeeId) {
                $this->notificationService->notifyRecipient(
                    $employeeId,
                    'employee',
                    'Ticket Assigned',
                    "Ticket {$ticketRef}: \"" . $title . "\" has been assigned to you.",
                    $ticketId,
                    $notificationData
                );

                $this->notificationService->sendTicketEmail(
                    $employeeId,
                    'Ticket Assigned',
                    "Ticket {$ticketRef}: \"{$title}\" has been assigned to you.",
                    $ticketId,
                    $title,
                    $categoryName,
                    $priorityName
                );
            }

            $this->notificationService->notifyCustomer(
                $customerId,
                'Engineer Assigned',
                "Engineer " . $empNamesStr . " has been assigned to your ticket {$ticketRef}: \"" . $title . "\".",
                $ticketId,
                $notificationData
            );

            $this->notificationService->sendCustomerEmail(
                $customerId,
                'Engineer Assigned',
                "Engineer(s) have been assigned to your ticket {$ticketRef}: \"" . $title . "\".",
                $ticketId,
                $title,
                $categoryName,
                $priorityName
            );

            $this->notificationService->notifyCS(
                'Ticket Assigned',
                "Ticket {$ticketRef}: \"" . $title . "\" has been assigned to " . $empNamesStr . ".",
                $ticketId,
                null,
                $assignedBy
            );

            if ($ticket->requested_by) {
                $this->notificationService->notifyRecipient(
                    $ticket->requested_by,
                    'employee',
                    'Ticket Assigned',
                    "Your requested ticket {$ticketRef}: \"" . $title . "\" has been assigned to " . $empNamesStr . ".",
                    $ticketId,
                    $notificationData
                );
            }
        }

        $this->notificationService->broadcastTicketChange('assigned', $ticketId, [
            'assigned_to' => $validated['employee_ids'][0],
            'employee_ids' => $validated['employee_ids'],
        ]);

        try {
            $empNames = DB::table('employees')
                ->whereIn('emp_id', $validated['employee_ids'])
                ->selectRaw("CONCAT(first_name, ' ', last_name) as name")
                ->pluck('name')
                ->all();
            $empNamesStr = implode(', ', $empNames);

            Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "System: A Service Engineer ({$empNamesStr}) has been assigned to your ticket.",
                'sender_name' => 'System',
                'sender_type' => 'system',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send internal assignment message in assignTicket: " . $e->getMessage());
        }

        $updatedTicket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        $this->cacheService->clearTicketCaches();

        return [
            'status' => 200,
            'data' => [
                'message' => 'Ticket assigned successfully.',
                'ticket' => $updatedTicket,
            ]
        ];
    }

    /**
     * Accept ticket by assigned engineer, or assign by customer service.
     */
    public function acceptTicket(int $ticketId, $user, ?array $validated = null): array
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return ['status' => 404, 'data' => ['message' => 'Ticket not found']];
        }

        if ($ticket->ticket_status_ID == 3) {
            return ['status' => 422, 'data' => ['message' => 'Resolved tickets cannot be reassigned.']];
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        $isCS = in_array($role, ['customer service', 'customer support', 'cs', 'admin', 'superadmin', 'super admin']);

        // Branch 1: Employee accept logic (when engineer self-accepts)
        if (!$isCS || !$validated) {
            $empId = $user->emp_id;

            $assignment = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->where('employee_ID', $empId)
                ->first();

            if (!$assignment) {
                // If the employee is assigned_to on the ticket, create the missing assignment record so they can accept
                $isDirectlyAssigned = DB::table('tickets')
                    ->where('ticket_ID', $ticketId)
                    ->where('assigned_to', $empId)
                    ->exists();

                if ($isDirectlyAssigned) {
                    DB::table('ticket_assignments')->insert([
                        'ticket_ID' => $ticketId,
                        'employee_ID' => $empId,
                        'assigned_by' => $empId,
                        'assignment_status' => 'assigned',
                        'assigned_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } else {
                    return ['status' => 403, 'data' => ['message' => 'You are not assigned to this ticket.']];
                }
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

                try {
                    $this->slaService->recordFirstResponse($ticketId, now());
                } catch (\Exception $e) {
                    Log::warning("Failed to record first response in acceptTicket: " . $e->getMessage());
                }

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

                $this->notificationService->notifyCustomer(
                    $customerId,
                    'Ticket Accepted',
                    "Engineer " . $empName . " has accepted and is now working on your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $title . "\".",
                    $ticketId
                );

                $catNameAcc = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                $prioNameAcc = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                $this->notificationService->sendCustomerEmail(
                    $customerId,
                    'Ticket Accepted',
                    "Engineer " . $empName . " has accepted and is now working on your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $title . "\".",
                    $ticketId,
                    $title,
                    $catNameAcc,
                    $prioNameAcc
                );

                $this->notificationService->notifyCS(
                    'Ticket Accepted',
                    "Engineer " . $empName . " has accepted ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ": \"" . $title . "\".",
                    $ticketId
                );
            }

            $this->notificationService->broadcastTicketChange('accepted', $ticketId, [
                'assigned_to' => $empId,
                'employee_ids' => [$empId],
            ]);

            try {
                $emp = DB::table('employees')->where('emp_id', $empId)->first();
                $empName = $emp ? ($emp->first_name . ' ' . $emp->last_name) : 'Engineer';

                Http::withHeaders([
                    'X-Internal-Token' => env('INTERNAL_TOKEN'),
                ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                    'message' => "System: Service Engineer {$empName} has accepted and is now working on your ticket.",
                    'sender_name' => 'System',
                    'sender_type' => 'system',
                    'sender_id' => null,
                ]);
            } catch (\Exception $e) {
                Log::error("Failed to send internal acceptance message in acceptTicket: " . $e->getMessage());
            }

            $this->cacheService->clearTicketCaches();
            return ['status' => 200, 'data' => ['message' => 'Ticket accepted and updated.']];
        }

        // Branch 2: Customer service assignment
        if (!$user) {
            return ['status' => 401, 'data' => ['message' => 'Unauthorized. Please log in.']];
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

        foreach ($employees as $employeeId) {
            $this->notificationService->notifyRecipient(
                $employeeId,
                'employee',
                'Ticket Assigned',
                "Ticket {$ticketRef}: \"" . $ticket->title . "\" has been assigned to you.",
                $ticketId,
                ['ticket_id' => $ticketId, 'ticket_ref' => $ticketRef, 'title' => $ticket->title, 'type' => 'ticket_assigned']
            );

            $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
            $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
            $this->notificationService->sendTicketEmail(
                $employeeId,
                'Ticket Assigned',
                "Ticket {$ticketRef}: \"{$ticket->title}\" has been assigned to you.",
                $ticketId,
                $ticket->title,
                $catName,
                $prioName
            );
        }

        $this->notificationService->notifyCustomer(
            $ticket->created_by,
            'Ticket Assigned',
            "Your ticket {$ticketRef}: \"" . $ticket->title . "\" has been assigned to a technician and is pending their acceptance.",
            $ticketId
        );

        $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
        $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
        $this->notificationService->sendCustomerEmail(
            $ticket->created_by,
            'Ticket Assigned',
            "Your ticket {$ticketRef}: \"" . $ticket->title . "\" has been assigned to a technician and is pending their acceptance.",
            $ticketId,
            $ticket->title,
            $catName,
            $prioName
        );

        $this->notificationService->broadcastTicketChange('assigned', $ticketId, [
            'assigned_to' => $employees->first(),
            'employee_ids' => $employees->all(),
        ]);

        try {
            $empNames = DB::table('employees')
                ->whereIn('emp_id', $employees->all())
                ->selectRaw("CONCAT(first_name, ' ', last_name) as name")
                ->pluck('name')
                ->all();
            $empNamesStr = implode(', ', $empNames);

            Http::withHeaders([
                'X-Internal-Token' => env('INTERNAL_TOKEN'),
            ])->post("http://messaging-service:8000/api/internal/tickets/{$ticketId}/messages", [
                'message' => "System: A Service Engineer ({$empNamesStr}) has been assigned to your ticket.",
                'sender_name' => 'System',
                'sender_type' => 'system',
                'sender_id' => null,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send internal assignment message in acceptTicket (CS): " . $e->getMessage());
        }

        $this->cacheService->clearTicketCaches();
        return ['status' => 200, 'data' => ['message' => 'Ticket assigned successfully.']];
    }

    /**
     * Handle employee status, remarks, notes, and proof updates.
     */
    public function employeeUpdate(int $ticketId, int $empId, array $validated, bool $isProof): array
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return ['status' => 404, 'data' => ['message' => 'Ticket not found']];
        }

        $assignment = DB::table('ticket_assignments')
            ->where('ticket_ID', $ticketId)
            ->where('employee_ID', $empId)
            ->first();

        if (!$assignment) {
            return ['status' => 403, 'data' => ['message' => 'You are not assigned to this ticket.']];
        }

        $pendingReassign = DB::table('reassignment_requests')
            ->where('ticket_id', $ticketId)
            ->where('status', 'pending')
            ->exists();

        if ($pendingReassign) {
            return ['status' => 422, 'data' => ['message' => 'Cannot update ticket while a reassignment request is pending.']];
        }

        $newStatusName = $validated['status'] ?? null;
        if ($isProof && empty($newStatusName)) {
            $newStatusName = 'Pending Evaluation';
        }
        $rawRemarks = $validated['remarks'] ?? '';
        $remarksText = $rawRemarks !== '' ? mb_strtoupper(mb_substr($rawRemarks, 0, 1)) . mb_substr($rawRemarks, 1) : '';
        $internalNoteText = $validated['internal_note'] ?? null;
        $attachmentIds = $validated['attachments'] ?? [];
        $attachmentNames = [];

        DB::transaction(function () use ($ticketId, $ticket, $empId, $newStatusName, $remarksText, $internalNoteText, $isProof, $assignment, $attachmentIds, &$attachmentNames) {
            if ($isProof) {
                try {
                    $resp = Http::get("http://attachment-service:8000/api/attachments?assignment_id={$assignment->assignment_ID}");
                    if ($resp->successful()) {
                        $oldProofs = $resp->json('attachments') ?? [];
                        foreach ($oldProofs as $oldProof) {
                            Http::delete("http://attachment-service:8000/api/attachments/{$oldProof['id']}?is_proof=true");
                        }
                    }
                } catch (\Exception $e) {
                    Log::error("Failed to delete old proofs in employeeUpdate: " . $e->getMessage());
                }
            }

            if (!empty($attachmentIds)) {
                try {
                    $resp = Http::post('http://attachment-service:8000/api/bind', [
                        'ticket_id' => $isProof ? null : $ticketId,
                        'assignment_id' => $isProof ? $assignment->assignment_ID : null,
                        'attachment_ids' => $attachmentIds,
                        'is_proof' => $isProof
                    ]);
                    if ($resp->successful()) {
                        $attachmentNames = $resp->json('file_names') ?? [];
                    }
                } catch (\Exception $e) {
                    Log::error("Failed to bind attachments in employeeUpdate: " . $e->getMessage());
                }
            }

            $emp = DB::table('employees')->where('emp_id', $empId)->first();
            $empName = $emp ? ($emp->first_name . ' ' . $emp->last_name) : 'Engineer';
            $customerId = $ticket->created_by;

            $statusChanged = false;
            if ($newStatusName) {
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

                    $this->notificationService->notifyCustomer(
                        $customerId,
                        $customerTitle,
                        "Your ticket {$ticketRef} status has been updated to \"" . $statusNameToNotify . "\". Remark: \"" . $remarksText . "\".",
                        $ticketId,
                        $customerNotificationData
                    );

                    $this->notificationService->notifyCS(
                        'Ticket Status Updated',
                        "Ticket {$ticketRef} status updated to \"" . $statusNameToNotify . "\" by " . $empName . ". Remark: \"" . $remarksText . "\".",
                        $ticketId
                    );

                    if ($ticket->requested_by && $ticket->requested_by != $empId) {
                        $this->notificationService->notifyRecipient(
                            $ticket->requested_by,
                            'employee',
                            'Ticket Status Updated',
                            "Your requested ticket {$ticketRef} status has been updated to \"" . $statusNameToNotify . "\".",
                            $ticketId
                        );
                    }

                    $catName = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                    $prioName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                    $this->notificationService->sendCustomerEmail(
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

            if (!empty($remarksText)) {
                DB::table('ticket_remarks')->insert([
                    'ticket_id' => $ticketId,
                    'employee_id' => $empId,
                    'remark' => $remarksText,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if (!$statusChanged && !$isProof) {
                    $this->notificationService->notifyCustomer(
                        $customerId,
                        'New Remark Added',
                        "Engineer " . $empName . " added a remark: \"" . $remarksText . "\" on ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                        $ticketId
                    );

                    $catNameRem = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                    $prioNameRem = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                    $this->notificationService->sendCustomerEmail(
                        $customerId,
                        'New Remark Added',
                        "Engineer " . $empName . " added a remark: \"" . $remarksText . "\" on your ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                        $ticketId,
                        $ticket->title,
                        $catNameRem,
                        $prioNameRem
                    );

                    $this->notificationService->notifyCS(
                        'New Remark Added',
                        "Engineer " . $empName . " added a remark: \"" . $remarksText . "\" on ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                        $ticketId
                    );
                }
            }

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

                $this->notificationService->notifyCS(
                    'New Internal Note',
                    "Engineer " . $empName . " added an internal note: \"" . $internalNoteText . "\" on ticket TKT-" . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT) . ".",
                    $ticketId
                );
            }

            if ($isProof) {
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

                    $ticketRefProof = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
                    $proofUploadData = [
                        'ticket_id' => $ticketId,
                        'ticket_ref' => $ticketRefProof,
                        'employee_name' => $empName,
                        'type' => 'proof_uploaded',
                    ];
                    $this->notificationService->notifyCustomer(
                        $customerId,
                        'Proof of Completion Uploaded',
                        "Proof of completion has been uploaded for ticket {$ticketRefProof} by " . $empName . ". Status is now Pending Evaluation.",
                        $ticketId,
                        $proofUploadData
                    );

                    $catNameProof = DB::table('problem_categories')->where('problem_category_ID', $ticket->problem_category_ID)->value('category_name') ?? '';
                    $prioNameProof = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID ?? 1)->value('priority_name') ?? '';
                    $this->notificationService->sendCustomerEmail(
                        $customerId,
                        'Proof of Completion Uploaded',
                        "Proof of completion has been uploaded for your ticket {$ticketRefProof} by " . $empName . ". Status is now Pending Evaluation.",
                        $ticketId,
                        $ticket->title,
                        $catNameProof,
                        $prioNameProof
                    );

                    $this->notificationService->notifyCS(
                        'Proof of Completion Uploaded',
                        "Proof of completion has been uploaded for ticket {$ticketRefProof} by " . $empName . ". Ticket status set to Pending Evaluation.",
                        $ticketId,
                        $proofUploadData
                    );
                }
            }
        });

        $this->notificationService->broadcastTicketChange('updated', $ticketId);
        $this->cacheService->clearTicketCaches();

        return ['status' => 200, 'data' => ['message' => 'Ticket updated successfully.']];
    }

    /**
     * Get tickets assigned to an employee.
     */
    public function getEmployeeTickets(string $employeeEmail): array
    {
        $employeeId = DB::table('employees')->where('email', $employeeEmail)->value('emp_id');
        if (!$employeeId) {
            return [];
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

        return $rows->map(function ($row) use ($pendingReassigns, $deniedReassigns) {
            $pendingReassign = $pendingReassigns->get($row->ticket_ID);
            $deniedReassign = $deniedReassigns->get($row->ticket_ID);

            $createdAtObj = is_string($row->created_at) ? Carbon::parse($row->created_at) : $row->created_at;
            $updatedAtObj = is_string($row->updated_at) ? Carbon::parse($row->updated_at) : $row->updated_at;

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
                'escalated' => false,
                'reassignmentRequested' => !empty($pendingReassign),
                'reassignmentReason' => $pendingReassign ? $pendingReassign->reason : null,
                'deniedReassignment' => !empty($deniedReassign),
                'proofRejected' => (bool)$row->proof_rejected,
                'rejectionReason' => $row->rejection_reason,
                'type' => $row->ticket_type ?? 'External',
                'ticket_type' => $row->ticket_type ?? 'External',
                'is_internal' => ($row->ticket_type ?? '') === 'Internal',
            ];
        })->values()->all();
    }

    /**
     * Get internal tickets created by an employee.
     */
    public function getInternalTickets(int $empId): array
    {
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
            ->where('t.requested_by', $empId)
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

        return $rows->map(function ($row) {
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
        })->values()->all();
    }
}
