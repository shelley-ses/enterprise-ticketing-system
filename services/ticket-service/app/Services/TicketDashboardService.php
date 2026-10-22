<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TicketDashboardService
{
    protected ?SLAService $slaService;

    public function __construct(?SLAService $slaService = null)
    {
        $this->slaService = $slaService ?? app(SLAService::class);
    }

    public function slaLabel($createdAt, $ticket = null): string
    {
        if ($ticket) {
            return $this->slaService->computeTicketSlaMetrics($ticket)['status'];
        }

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
     * Get summary metrics and recent tickets for the customer dashboard with optional combinable filters (TS021).
     */
    public function getCustomerDashboard(int $createdBy, int $limit, array $filters = []): array
    {
        $hasFilters = !empty(array_filter($filters, fn($v) => $v !== null && $v !== ''));
        $filterKey = $hasFilters ? md5(json_encode($filters)) : 'none';

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

        $fetchQuery = function () use ($createdBy, $limit, $filters) {
            $query = DB::table('tickets as t')
                ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
                ->leftJoin('machine_categories as mc', 'mc.category_ID', '=', 'm.category_ID')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
                ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
                ->leftJoin('employees as e', 'e.emp_id', '=', 't.assigned_to')
                ->leftJoin('ticket_assignments as ta', function ($join) {
                    $join->on('ta.ticket_ID', '=', 't.ticket_ID')
                         ->whereNull('ta.completed_at');
                })
                ->leftJoin('employees as e_ta', 'e_ta.emp_id', '=', 'ta.employee_ID')
                ->select(
                    't.ticket_ID',
                    't.ticket_number',
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
                    'tp.priority_name',
                    DB::raw("COALESCE(CONCAT(e.first_name, ' ', e.last_name), CONCAT(e_ta.first_name, ' ', e_ta.last_name)) as assigned_employee_name")
                )
                ->where('t.created_by', $createdBy)
                ->where('t.is_internal', false);

            // TS021: Combinable AND filters
            if (!empty($filters['search'])) {
                $term = '%' . trim($filters['search']) . '%';
                $query->where(function ($q) use ($term) {
                    $q->where('t.ticket_number', 'LIKE', $term)
                      ->orWhere('t.ticket_ID', 'LIKE', $term)
                      ->orWhere('t.title', 'LIKE', $term)
                      ->orWhere('t.description', 'LIKE', $term)
                      ->orWhere('m.machine_name', 'LIKE', $term)
                      ->orWhere('m.serial_number', 'LIKE', $term);
                });
            }

            if (!empty($filters['status'])) {
                $statusVal = trim($filters['status']);
                $query->where(function ($q) use ($statusVal) {
                    $q->where('ts.status_name', $statusVal)
                      ->orWhere('t.ticket_status_ID', $statusVal);
                });
            }

            if (!empty($filters['category_id'])) {
                $query->where('t.problem_category_ID', (int) $filters['category_id']);
            } elseif (!empty($filters['category'])) {
                $catVal = trim($filters['category']);
                $query->where('pc.category_name', $catVal);
            }

            if (!empty($filters['machine_id'])) {
                $query->where('t.machine_ID', (int) $filters['machine_id']);
            }

            if (!empty($filters['priority_id'])) {
                $query->where('t.priority_ID', (int) $filters['priority_id']);
            }

            if (!empty($filters['date_from'])) {
                $query->where('t.created_at', '>=', Carbon::parse($filters['date_from'])->startOfDay());
            }

            if (!empty($filters['date_to'])) {
                $query->where('t.created_at', '<=', Carbon::parse($filters['date_to'])->endOfDay());
            }

            return $query->orderByDesc('t.created_at')
                ->limit($limit * 2)
                ->get()
                ->unique('ticket_ID')
                ->take($limit)
                ->map(fn ($row) => [
                    'id' => TicketNumberGeneratorService::refFor($row->ticket_ID, $row->ticket_number ?? null),
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
                    'assigned_employee' => $row->assigned_employee_name,
                    'assigned_employee_name' => $row->assigned_employee_name,
                    'assigned_to_name' => $row->assigned_employee_name,
                ])
                ->values()
                ->toArray();
        };

        $recentTickets = $hasFilters
            ? $fetchQuery()
            : Cache::remember("customer_dashboard_recent_{$createdBy}_{$limit}", 60, $fetchQuery);

        return [
            'summary' => $summary,
            'recent_tickets' => $recentTickets,
        ];
    }

    /**
     * Get dynamic filter options for customer tickets (TS021).
     */
    public function getCustomerFilterOptions(int $createdBy): array
    {
        $machines = DB::table('tickets as t')
            ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->where('t.created_by', $createdBy)
            ->where('t.is_internal', false)
            ->select('m.machine_ID', 'm.machine_name', 'm.serial_number')
            ->distinct()
            ->get()
            ->map(fn($m) => [
                'machine_ID' => $m->machine_ID,
                'label' => "{$m->machine_name} - {$m->serial_number}",
            ]);

        $categories = DB::table('tickets as t')
            ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
            ->where('t.created_by', $createdBy)
            ->where('t.is_internal', false)
            ->select('pc.problem_category_ID', 'pc.category_name')
            ->distinct()
            ->get();

        $statuses = DB::table('ticket_statuses')
            ->where('status_name', '!=', 'Discarded')
            ->select('ticket_status_ID', 'status_name')
            ->get();

        $priorities = DB::table('ticket_priorities')
            ->select('priority_ID', 'priority_name')
            ->get();

        $employees = DB::table('employees')
            ->whereRaw('LOWER(COALESCE(role, "")) NOT IN (?, ?)', ['customer service', 'superadmin'])
            ->select('emp_id as id', DB::raw("CONCAT(first_name, ' ', last_name) as name"))
            ->orderBy('first_name')
            ->get();

        return [
            'machines' => $machines,
            'categories' => $categories,
            'statuses' => $statuses,
            'priorities' => $priorities,
            'employees' => $employees,
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
                ->leftJoin('employees as req', 'req.emp_id', '=', 't.requested_by')
                ->where('ts.status_name', '!=', 'Discarded')
                ->select(
                    't.ticket_ID',
                    't.ticket_number',
                    't.title',
                    't.is_internal',
                    'm.machine_name',
                    'm.serial_number',
                    'ts.status_name',
                    'tp.priority_name',
                    't.created_at',
                    't.updated_at',
                    't.requested_by',
                    'c.client_name',
                    DB::raw("TRIM(CONCAT(COALESCE(req.first_name, ''), ' ', COALESCE(req.last_name, ''))) as requester_employee_name")
                )
                ->orderByDesc('t.created_at')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => [
                    'id' => TicketNumberGeneratorService::refFor($row->ticket_ID, $row->ticket_number ?? null),
                    'title' => $row->title,
                    'customer' => (bool) $row->is_internal
                        ? (($row->requester_employee_name !== '' && $row->requester_employee_name !== null) ? $row->requester_employee_name : ($row->requested_by ? 'Employee #' . $row->requested_by : 'Internal Requester'))
                        : ($row->client_name ?: 'Unknown Customer'),
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
     * Get paginated incoming tickets list for CS with filtering (TS023).
     */
    public function getCsIncoming(int $perPage, string $typeFilter, int $page, array $filters = [], bool $forceRefresh = false): array
    {
        $hasFilters = !empty(array_filter($filters, fn($v) => $v !== null && $v !== ''));
        $filterKey = $hasFilters ? md5(json_encode($filters)) : 'none';
        $cacheKey = "cs_incoming_tickets_{$perPage}_{$typeFilter}_{$page}_{$filterKey}";

        $fetchQuery = function () use ($perPage, $typeFilter, $page, $filters) {
            $query = DB::table('tickets as t')
                ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
                ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
                ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
                ->leftJoin('employees as req', 'req.emp_id', '=', 't.requested_by')
                ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
                ->leftJoin('machine_categories as mc', 'mc.category_ID', '=', 'm.category_ID')
                ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
                ->leftJoin('employees as e', 'e.emp_id', '=', 't.assigned_to')
                ->leftJoin('ticket_types as tt', 'tt.ticket_type_ID', '=', 't.ticket_type_ID')
                ->where('ts.status_name', '!=', 'Discarded')
                ->select(
                    't.ticket_ID',
                    't.ticket_number',
                    't.title',
                    't.description',
                    't.is_internal',
                    't.requested_by',
                    't.ticket_status_ID',
                    't.resolution_due_at',
                    't.response_due_at',
                    't.resolved_at',
                    't.closed_at',
                    't.first_response_at',
                    't.resolution_sla_status',
                    't.response_sla_status',
                    'pc.category_name',
                    'ts.status_name',
                    'tp.priority_name',
                    'e.department',
                    't.created_at',
                    't.updated_at',
                    'c.client_name',
                    DB::raw("TRIM(CONCAT(COALESCE(req.first_name, ''), ' ', COALESCE(req.last_name, ''))) as requester_employee_name"),
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

            // TS023: Search and combinable filters
            if (!empty($filters['search'])) {
                $term = '%' . trim($filters['search']) . '%';
                $query->where(function ($q) use ($term) {
                    $q->where('t.ticket_number', 'LIKE', $term)
                      ->orWhere('t.ticket_ID', 'LIKE', $term)
                      ->orWhere('t.title', 'LIKE', $term)
                      ->orWhere('t.description', 'LIKE', $term)
                      ->orWhere('c.client_name', 'LIKE', $term)
                      ->orWhere('m.machine_name', 'LIKE', $term)
                      ->orWhere('m.serial_number', 'LIKE', $term);
                });
            }

            if (!empty($filters['status'])) {
                $stVal = trim($filters['status']);
                $query->where(function ($q) use ($stVal) {
                    $q->where('ts.status_name', $stVal)
                      ->orWhere('t.ticket_status_ID', $stVal);
                });
            }

            if (!empty($filters['department'])) {
                $query->where('e.department', trim($filters['department']));
            }

            if (!empty($filters['customer_id'])) {
                $query->where('t.created_by', (int) $filters['customer_id']);
            } elseif (!empty($filters['customer'])) {
                $query->where('c.client_name', 'LIKE', '%' . trim($filters['customer']) . '%');
            }

            if (!empty($filters['machine_id'])) {
                $query->where('t.machine_ID', (int) $filters['machine_id']);
            } elseif (!empty($filters['machine'])) {
                $query->where(function ($q) use ($filters) {
                    $mVal = '%' . trim($filters['machine']) . '%';
                    $q->where('m.machine_name', 'LIKE', $mVal)
                      ->orWhere('m.serial_number', 'LIKE', $mVal);
                });
            }

            // Calculate SLA summary counts across this filtered scope before SLA filter
            $summaryScope = (clone $query)->select(
                't.ticket_ID',
                't.ticket_status_ID',
                'ts.status_name',
                't.resolution_due_at',
                't.resolved_at',
                't.closed_at',
                't.created_at'
            )->get();

            $slaSummary = [
                'total' => $summaryScope->count(),
                'breached' => 0,
                'at_risk' => 0,
                'on_track' => 0,
                'paused' => 0,
                'compliant' => 0,
            ];

            foreach ($summaryScope as $st) {
                $m = $this->slaService->computeTicketSlaMetrics($st);
                $stKey = strtolower(str_replace(' ', '_', $m['status']));
                if (isset($slaSummary[$stKey])) {
                    $slaSummary[$stKey]++;
                }
            }

            // Filter by SLA status if requested
            if (!empty($filters['sla_status'])) {
                $slaFilterVal = strtolower(trim($filters['sla_status']));
                if (!in_array($slaFilterVal, ['all', 'all sla', 'all sla statuses'])) {
                    if ($slaFilterVal === 'breached') {
                        $query->where(function ($q) {
                            $q->where(function ($sq) {
                                $sq->whereNotNull('t.resolution_due_at')
                                   ->where('t.resolution_due_at', '<', now());
                            })->orWhere(function ($sq) {
                                $sq->whereNull('t.resolution_due_at')
                                   ->where('t.created_at', '<=', now()->subHours(48));
                            });
                        })->whereNotIn('ts.status_name', ['Closed', 'Resolved', 'On Hold']);
                    } elseif ($slaFilterVal === 'at_risk' || $slaFilterVal === 'at risk') {
                        $query->whereNotIn('ts.status_name', ['Closed', 'Resolved', 'On Hold'])
                            ->where(function ($q) {
                                $q->where(function ($sq) {
                                    $sq->whereNotNull('t.resolution_due_at')
                                       ->where('t.resolution_due_at', '>=', now())
                                       ->where('t.resolution_due_at', '<=', now()->addHours(4));
                                })->orWhere(function ($sq) {
                                    $sq->whereNull('t.resolution_due_at')
                                       ->where('t.created_at', '<=', now()->subHours(24))
                                       ->where('t.created_at', '>', now()->subHours(48));
                                });
                            });
                    } elseif ($slaFilterVal === 'paused') {
                        $query->where(function ($q) {
                            $q->where('ts.status_name', 'On Hold')
                               ->orWhere('t.ticket_status_ID', 11);
                        });
                    } elseif ($slaFilterVal === 'on_track' || $slaFilterVal === 'on track') {
                        $query->whereNotIn('ts.status_name', ['Closed', 'Resolved', 'On Hold'])
                            ->where(function ($q) {
                                $q->where(function ($sq) {
                                    $sq->whereNotNull('t.resolution_due_at')
                                       ->where('t.resolution_due_at', '>', now()->addHours(4));
                                })->orWhere(function ($sq) {
                                    $sq->whereNull('t.resolution_due_at')
                                       ->where('t.created_at', '>', now()->subHours(24));
                                });
                            });
                    } elseif ($slaFilterVal === 'compliant') {
                        $query->whereIn('ts.status_name', ['Closed', 'Resolved'])
                            ->where(function ($q) {
                                $q->whereNull('t.resolution_due_at')
                                   ->orWhereRaw('COALESCE(t.resolved_at, t.closed_at, NOW()) <= t.resolution_due_at');
                            });
                    }
                }
            }

            // Sorting
            $sortBy = $filters['sort_by'] ?? null;
            $sortDir = strtolower($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

            if ($sortBy === 'sla_due_date' || $sortBy === 'resolution_due_at' || $sortBy === 'due_date') {
                $query->orderBy(DB::raw('COALESCE(t.resolution_due_at, DATE_ADD(t.created_at, INTERVAL 48 HOUR))'), $sortDir);
            } elseif ($sortBy === 'sla_status') {
                $query->orderByRaw("CASE WHEN ts.status_name = 'On Hold' THEN 4 WHEN COALESCE(t.resolution_due_at, DATE_ADD(t.created_at, INTERVAL 48 HOUR)) < NOW() THEN 1 WHEN COALESCE(t.resolution_due_at, DATE_ADD(t.created_at, INTERVAL 48 HOUR)) <= DATE_ADD(NOW(), INTERVAL 4 HOUR) THEN 2 ELSE 3 END " . ($sortDir === 'asc' ? 'ASC' : 'DESC'));
            } else {
                $query->orderByDesc(DB::raw('COALESCE(t.updated_at, t.created_at)'));
            }

            $paginated = $query->paginate($perPage, ['*'], 'page', $page);

            $rows = collect($paginated->items());
            $ticketIds = $rows->pluck('ticket_ID')->toArray();

            $assignments = collect();
            $pendingReassigns = collect();

            if (!empty($ticketIds)) {
                $assignments = DB::table('ticket_assignments as ta')
                    ->leftJoin('employees as e', 'e.emp_id', '=', 'ta.employee_ID')
                    ->whereIn('ta.ticket_ID', $ticketIds)
                    ->select(
                        'ta.*',
                        DB::raw("CONCAT(e.first_name, ' ', e.last_name) as employee_name"),
                        'e.department as employee_department'
                    )
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
                    ->groupBy('ticket_id')
                    ->map(fn($group) => $group->sortByDesc('request_id')->first());
            }

            $incomingTickets = $rows->map(function ($row) use ($assignments, $pendingReassigns) {
                $assignedList = isset($assignments[$row->ticket_ID]) ? $assignments[$row->ticket_ID] : collect();

                $assignedIds = $assignedList->pluck('employee_ID')->map(fn($id) => (int)$id)->all();

                $assignedNames = $assignedList->pluck('employee_name')->filter()->implode(', ') ?: null;

                $accepted = $assignedList->contains('assignment_status', 'accepted');

                $assignedEmployees = $assignedList->map(function ($a) {
                    return [
                        'id' => (int) $a->employee_ID,
                        'name' => $a->employee_name ?: ('Engineer #' . $a->employee_ID),
                        'department' => $a->employee_department ?? null,
                        'assignment_status' => $a->assignment_status ?: 'assigned',
                        'assigned_at' => $a->assigned_at ? Carbon::parse($a->assigned_at)->toIso8601String() : null,
                        'accepted_at' => $a->accepted_at ? Carbon::parse($a->accepted_at)->toIso8601String() : null,
                    ];
                })->values()->all();

                $pendingReassign = $pendingReassigns->get($row->ticket_ID);

                $createdAt = $row->created_at ?? null;
                $updatedAt = $row->updated_at ?? null;
                $createdAtObj = is_string($createdAt) ? Carbon::parse($createdAt) : $createdAt;
                $updatedAtObj = is_string($updatedAt) ? Carbon::parse($updatedAt) : $updatedAt;

                $equipment = $row->machine_name ? ($row->machine_name . ($row->serial_number ? ' - ' . $row->serial_number : '')) : ($row->serial_number ?: 'Not specified');

                $slaMetrics = $this->slaService->computeTicketSlaMetrics($row);

                return [
                    'id' => TicketNumberGeneratorService::refFor($row->ticket_ID, $row->ticket_number ?? null),
                    'ticket_ID' => (int) $row->ticket_ID,
                    'customer' => (bool) $row->is_internal
                        ? (($row->requester_employee_name !== '' && $row->requester_employee_name !== null) ? $row->requester_employee_name : ($row->requested_by ? 'Employee #' . $row->requested_by : 'Internal Requester'))
                        : ($row->client_name ?: 'Unknown Customer'),
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
                    'sla' => $slaMetrics['status'],
                    'sla_status' => $slaMetrics['status'],
                    'slaStatus' => $slaMetrics['status'],
                    'resolution_due_at' => $slaMetrics['due_at'],
                    'due_at' => $slaMetrics['due_at'],
                    'time_remaining_minutes' => $slaMetrics['time_remaining_minutes'],
                    'is_breached' => $slaMetrics['is_breached'],
                    'is_at_risk' => $slaMetrics['is_at_risk'],
                    'is_paused' => $slaMetrics['is_paused'],
                    'date' => $createdAtObj ? $createdAtObj->toIso8601String() : now()->toIso8601String(),
                    'created_at' => $createdAtObj ? $createdAtObj->toIso8601String() : null,
                    'updated_at' => $updatedAtObj ? $updatedAtObj->toIso8601String() : ($createdAtObj ? $createdAtObj->toIso8601String() : null),
                    'assigned' => $assignedIds,
                    'assigned_employee' => $assignedNames,
                    'assigned_employee_name' => $assignedNames,
                    'assigned_employees' => $assignedEmployees,
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
                'sla_summary' => $slaSummary,
                'pagination' => [
                    'total' => $paginated->total(),
                    'per_page' => $paginated->perPage(),
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                ]
            ];
        };

        if ($forceRefresh) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return $fetchQuery();
        }

        return $hasFilters
            ? $fetchQuery()
            : Cache::remember($cacheKey, 60, $fetchQuery);
    }

    /**
     * Get dynamic filter options for CS queue (TS023).
     */
    public function getCsFilterOptions(): array
    {
        $departments = DB::table('departments')
            ->where('is_active', true)
            ->select('id', 'name')
            ->get();

        $statuses = DB::table('ticket_statuses')
            ->where('status_name', '!=', 'Discarded')
            ->select('ticket_status_ID', 'status_name')
            ->get();

        $machines = DB::table('machines')
            ->select('machine_ID', 'machine_name', 'serial_number')
            ->limit(100)
            ->get()
            ->map(fn($m) => [
                'machine_ID' => $m->machine_ID,
                'label' => "{$m->machine_name} - {$m->serial_number}",
            ]);

        return [
            'departments' => $departments,
            'statuses' => $statuses,
            'machines' => $machines,
        ];
    }
}
