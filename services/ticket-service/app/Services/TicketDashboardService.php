<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TicketDashboardService
{
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
     * Get summary metrics and recent tickets for the customer dashboard.
     */
    public function getCustomerDashboard(int $createdBy, int $limit): array
    {
        $summary = Cache::remember("customer_dashboard_counts_{$createdBy}", 60, function () use ($createdBy) {
            $statusCounts = DB::table('tickets as t')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->select('ts.status_name', DB::raw('COUNT(*) as total'))
                ->where('t.created_by', $createdBy)
                ->where('t.is_internal', false)
                ->where('t.ticket_status_ID', '!=', 9)
                ->where('ts.status_name', '!=', 'Discarded')
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
                ->leftJoin('machine_categories as mc', 'mc.category_ID', '=', 'm.category_ID')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
                ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
                ->select(
                    't.ticket_ID',
                    't.machine_ID',
                    't.title',
                    't.description',
                    'm.machine_name',
                    'm.serial_number',
                    'mc.category_name as equipment_type',
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
                    'machine_ID' => $row->machine_ID,
                    'machine_name' => $row->machine_name,
                    'equipment_type' => $row->equipment_type ?: 'Medical Equipment',
                    'equipmentType' => $row->equipment_type ?: 'Medical Equipment',
                    'title' => $row->title,
                    'description' => $row->description,
                    'category' => $row->category_name,
                    'equipment' => $row->machine_name . ' - ' . $row->serial_number,
                    'status' => $row->status_name,
                    'priority' => $row->priority_name ?? 'Low',
                    'date_created' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
                    'last_updated' => ($row->updated_at ?? $row->created_at) ? Carbon::parse($row->updated_at ?? $row->created_at)->toIso8601String() : null,
                    'created_at' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
                    'updated_at' => $row->updated_at ? Carbon::parse($row->updated_at)->toIso8601String() : null,
                    'assigned_to' => $row->assigned_to,
                ])
                ->values()
                ->toArray();
        });

        return [
            'summary' => $summary,
            'recent_tickets' => $recentTickets,
        ];
    }

    /**
     * Get summary metrics and recent tickets for the customer service dashboard.
     */
    public function getCsDashboard(int $limit): array
    {
        $summary = Cache::remember('cs_dashboard_counts', 60, function () {
            $statusCounts = DB::table('tickets as t')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->where('ts.status_name', '!=', 'Discarded')
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
                ->where('ts.status_name', '!=', 'Discarded')
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
                    'created_at' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
                    'updated_at' => $row->updated_at ? Carbon::parse($row->updated_at)->toIso8601String() : null,
                    'requested_by' => $row->requested_by,
                ])
                ->values()
                ->toArray();
        });

        return [
            'summary' => $summary,
            'recent_tickets' => $recentTickets,
        ];
    }

    /**
     * Get paginated incoming tickets list for CS with filtering.
     */
    public function getCsIncoming(int $perPage, string $typeFilter, int $page): array
    {
        $cacheKey = "cs_incoming_tickets_{$perPage}_{$typeFilter}_{$page}";

        return Cache::remember($cacheKey, 60, function () use ($perPage, $typeFilter) {
            $query = DB::table('tickets as t')
                ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
                ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
                ->leftJoin('machine_categories as mc', 'mc.category_ID', '=', 'm.category_ID')
                ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
                ->leftJoin('employees as e', 'e.emp_id', '=', 't.assigned_to')
                ->leftJoin('ticket_types as tt', 'tt.ticket_type_ID', '=', 't.ticket_type_ID')
                ->where('ts.status_name', '!=', 'Discarded')
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
                    't.updated_at',
                    'c.client_name',
                    'm.machine_name',
                    'm.serial_number',
                    'mc.category_name as equipment_type',
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
                $assignments = DB::table('ticket_assignments as ta')
                    ->leftJoin('employees as e', 'e.emp_id', '=', 'ta.employee_ID')
                    ->whereIn('ta.ticket_ID', $ticketIds)
                    ->select('ta.*', DB::raw("CONCAT(e.first_name, ' ', e.last_name) as employee_name"))
                    ->get()
                    ->groupBy('ticket_ID');

                $pendingReassigns = DB::table('reassignment_requests as rr')
                    ->leftJoin('employees as e', 'e.emp_id', '=', 'rr.employee_id')
                    ->whereIn('rr.ticket_id', $ticketIds)
                    ->where('rr.status', 'pending')
                    ->select(
                        'rr.*',
                        DB::raw("CONCAT(e.first_name, ' ', e.last_name) as requesting_employee_name"),
                        'e.department as requesting_employee_department'
                    )
                    ->get()
                    ->keyBy('ticket_id');
            }

            $incomingTickets = $rows->map(function ($row) use ($assignments, $pendingReassigns) {
                $assignedIds = isset($assignments[$row->ticket_ID])
                    ? $assignments[$row->ticket_ID]->pluck('employee_ID')->map(fn($id) => (int)$id)->all()
                    : [];

                $assignedNames = isset($assignments[$row->ticket_ID])
                    ? $assignments[$row->ticket_ID]->pluck('employee_name')->filter()->implode(', ')
                    : null;

                $accepted = isset($assignments[$row->ticket_ID])
                    ? $assignments[$row->ticket_ID]->contains('assignment_status', 'accepted')
                    : false;

                $pendingReassign = $pendingReassigns->get($row->ticket_ID);

                $createdAt = $row->created_at ?? null;
                $updatedAt = $row->updated_at ?? null;
                $createdAtObj = is_string($createdAt) ? Carbon::parse($createdAt) : $createdAt;
                $updatedAtObj = is_string($updatedAt) ? Carbon::parse($updatedAt) : $updatedAt;

                $equipment = $row->machine_name ? ($row->machine_name . ($row->serial_number ? ' - ' . $row->serial_number : '')) : ($row->serial_number ?: 'Not specified');

                return [
                    'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
                    'ticket_ID' => (int) $row->ticket_ID,
                    'customer' => $row->client_name ?: 'Unknown Customer',
                    'title' => $row->title,
                    'description' => $row->description ?? '',
                    'category' => $row->category_name,
                    'status' => $row->status_name,
                    'priority' => $row->priority_name,
                    'department' => $row->department,
                    'equipment' => $equipment,
                    'equipment_type' => $row->equipment_type ?: 'Medical Equipment',
                    'equipmentType' => $row->equipment_type ?: 'Medical Equipment',
                    'machine_name' => $row->machine_name,
                    'serial_number' => $row->serial_number,
                    'sla' => $this->slaLabel($createdAtObj),
                    'date' => $createdAtObj ? $createdAtObj->toIso8601String() : now()->toIso8601String(),
                    'created_at' => $createdAtObj ? $createdAtObj->toIso8601String() : null,
                    'updated_at' => $updatedAtObj ? $updatedAtObj->toIso8601String() : ($createdAtObj ? $createdAtObj->toIso8601String() : null),
                    'assigned' => $assignedIds,
                    'assigned_employee' => $assignedNames,
                    'assigned_employee_name' => $assignedNames,
                    'accepted' => $accepted,
                    'reassignmentRequested' => !empty($pendingReassign),
                    'reassignmentReason' => $pendingReassign ? $pendingReassign->reason : null,
                    'reassignmentRequestedBy' => $pendingReassign ? ($pendingReassign->requesting_employee_name ?: 'Assigned Employee') : null,
                    'reassignmentDepartment' => $pendingReassign ? ($pendingReassign->requesting_employee_department ?: $row->department) : $row->department,
                    'reassignmentRequestedAt' => $pendingReassign ? ($pendingReassign->requested_at ? Carbon::parse($pendingReassign->requested_at)->toIso8601String() : ($pendingReassign->created_at ? Carbon::parse($pendingReassign->created_at)->toIso8601String() : null)) : null,
                    'reassignmentEmployeeId' => $pendingReassign ? (int)$pendingReassign->employee_id : null,
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
    }
}
