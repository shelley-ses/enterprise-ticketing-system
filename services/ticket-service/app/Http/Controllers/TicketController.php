<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TicketController extends Controller
{
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

        $statusCounts = DB::table('tickets as t')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->select('ts.status_name', DB::raw('COUNT(*) as total'))
            ->where('t.created_by', $createdBy)
            ->groupBy('ts.status_name')
            ->get();

        $summary = [
            'open' => 0,
            'in_progress' => 0,
            'resolved' => 0,
            'closed' => 0,
        ];

        foreach ($statusCounts as $row) {
            $key = str_replace(' ', '_', strtolower($row->status_name));
            if (array_key_exists($key, $summary)) {
                $summary[$key] = (int) $row->total;
            }
        }

        $recentTickets = DB::table('tickets as t')
            ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->select(
                't.ticket_ID',
                't.title',
                'm.machine_name',
                'm.serial_number',
                'ts.status_name',
                't.created_at'
            )
            ->where('t.created_by', $createdBy)
            ->orderByDesc('t.created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 3, '0', STR_PAD_LEFT),
                'title' => $row->title,
                'equipment' => $row->machine_name . ' - ' . $row->serial_number,
                'status' => $row->status_name,
            ])
            ->values();

        return response()->json([
            'summary' => $summary,
            'recent_tickets' => $recentTickets,
        ]);
    }

    public function formOptions()
    {
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

        return response()->json([
            
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
            ])->values(),
            'category_options' => $problemCategories->map(fn ($row) => [
                'value' => $row->problem_category_ID,
                'label' => $row->category_name,
            ])->values(),
            'priority_options' => $priorities->map(fn ($row) => [
                'value' => $row->priority_ID,
                'label' => $row->priority_name,
            ])->values(),
            'ticket_type_options' => $ticketTypes->map(fn ($row) => [
                'value' => $row->ticket_type_ID,
                'label' => $row->type_name,
            ])->values(),
        ]);
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

        $statusCounts = DB::table('tickets as t')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->select('ts.status_name', DB::raw('COUNT(*) as total'))
            ->groupBy('ts.status_name')
            ->get();

        $summary = [
            'open' => 0,
            'in_progress' => 0,
            'resolved' => 0,
            'closed' => 0,
        ];

        foreach ($statusCounts as $row) {
            $key = str_replace(' ', '_', strtolower($row->status_name));
            if (array_key_exists($key, $summary)) {
                $summary[$key] = (int) $row->total;
            }
        }

        $recentTickets = DB::table('tickets as t')
            ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->leftJoin('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->select(
                't.ticket_ID',
                't.title',
                'm.machine_name',
                'm.serial_number',
                'ts.status_name',
                'tp.priority_name',
                't.created_at',
                't.updated_at',
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
            ])
            ->values();

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
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'ticket_type_ID' => ['nullable', 'integer', 'exists:ticket_types,ticket_type_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'ticket_status_ID' => ['nullable', 'integer', 'exists:ticket_statuses,ticket_status_ID'],
            'sla_ID' => ['nullable', 'integer', 'exists:slas,sla_ID'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,docx'],
        ], [
            'attachments.*.max' => 'Each attachment must be 5MB or smaller.',
            'attachments.*.mimes' => 'Attachments must be PDF, JPG, PNG, or DOCX files.',
        ]);

        $defaultTicketTypeId = DB::table('ticket_types')->where('type_name', 'Internal')->value('ticket_type_ID') ?? 1;

        $ticketId = DB::table('tickets')->insertGetId([
            'machine_ID' => $validated['machine_ID'],
            'problem_category_ID' => $validated['problem_category_ID'],
            'created_by' => $validated['created_by'] ?? 1,
            'assigned_to' => $validated['assigned_to'] ?? null,
            'ticket_type_ID' => $validated['ticket_type_ID'] ?? $defaultTicketTypeId,
            'priority_ID' => $validated['priority_ID'] ?? null,
            'ticket_status_ID' => $validated['ticket_status_ID'] ?? 1,
            'sla_ID' => $validated['sla_ID'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'],
            'resolved_at' => null,
            'closed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $storedAttachments = [];
        foreach ($request->file('attachments', []) as $attachment) {
            $storedPath = $attachment->store("ticket-attachments/{$ticketId}", 'public');

            $attachmentId = DB::table('ticket_attachments')->insertGetId([
                'ticket_id' => $ticketId,
                'file_name' => $attachment->getClientOriginalName(),
                'file_path' => $storedPath,
                'file_type' => $attachment->getClientMimeType(),
                'uploaded_at' => now(),
            ]);

            $storedAttachments[] = [
                'attachment_id' => $attachmentId,
                'ticket_id' => $ticketId,
                'file_name' => $attachment->getClientOriginalName(),
                'file_path' => '/storage/' . $storedPath,
                'file_type' => $attachment->getClientMimeType(),
                'uploaded_at' => now()->toDateTimeString(),
            ];
        }

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();

        $dashboardTicket = DB::table('tickets as t')
            ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->select('t.ticket_ID', 't.title', 'm.machine_name', 'm.serial_number', 'ts.status_name')
            ->where('t.ticket_ID', $ticketId)
            ->first();

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

    public function csIncoming(Request $request)
    {
        $limit = max(1, min((int) $request->query('limit', 50), 200));

        $rows = DB::table('tickets as t')
            ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->select(
                't.ticket_ID',
                't.title',
                'pc.category_name',
                'ts.status_name',
                't.created_at',
                'c.client_name',
                'm.machine_name',
                'm.serial_number'
            )
            ->orderByDesc('t.created_at')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                return [
                    'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
                    'ticket_ID' => (int) $row->ticket_ID,
                    'customer' => $row->client_name ?: 'Unknown Customer',
                    'title' => $row->title,
                    'category' => $row->category_name,
                    'status' => $row->status_name,
                    'equipment' => $row->machine_name . ' - ' . $row->serial_number,
                    'sla' => $this->slaLabel($row->created_at),
                    'date' => optional($row->created_at)->format('m/d/Y') ?? now()->format('m/d/Y'),
                ];
            })
            ->values();

        return response()->json([
            'incoming_tickets' => $rows,
        ]);
    }

    public function assignableEmployees(Request $request)
    {
        $department = $request->query('department');

        $query = DB::table('users')
            ->select('id', 'name', 'email', 'role', 'department', 'is_active')
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer service'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer']);

        if ($department) {
            $query->where('department', $department);
        }

        $employees = $query
            ->orderByDesc('is_active')
            ->orderBy('name')
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
        $validated = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['integer', 'exists:users,id'],
            'assigned_by_email' => ['nullable', 'email'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
        ]);

        $employees = DB::table('users')
            ->whereIn('id', $validated['employee_ids'])
            ->select('id', 'role')
            ->get();

        $invalid = $employees->contains(function ($row) {
            return strtolower((string) $row->role) === 'customer service';
        });

        if ($invalid) {
            return response()->json([
                'message' => 'Customer-service users cannot be assignees.',
            ], 422);
        }

        $assignedBy = DB::table('users')
            ->where('email', $validated['assigned_by_email'] ?? '')
            ->value('id');
        if (!$assignedBy) {
            $assignedBy = 2;
        }

        DB::transaction(function () use ($ticketId, $validated, $assignedBy) {
            $inProgressId = DB::table('ticket_statuses')
                ->whereRaw('LOWER(status_name) = ?', ['in progress'])
                ->value('ticket_status_ID') ?? 2;

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
                    'ticket_status_ID' => $inProgressId,
                    'priority_ID' => $validated['priority_ID'] ?? DB::raw('priority_ID'),
                    'updated_at' => now(),
                ]);

            DB::table('ticket_assignments')->where('ticket_ID', $ticketId)->delete();

            foreach ($validated['employee_ids'] as $employeeId) {
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

        return response()->json([
            'message' => 'Ticket assigned successfully.',
        ]);
    }

    public function acceptTicket(Request $request, int $ticketId)
    {
        $validated = $request->validate([
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['integer', 'exists:users,id'],
            'assigned_by_email' => ['nullable', 'email'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
        ]);

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $assignedBy = DB::table('users')
            ->where('email', $validated['assigned_by_email'] ?? '')
            ->value('id') ?? 2;

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
            $inProgressId = DB::table('ticket_statuses')
                ->whereRaw('LOWER(status_name) = ?', ['in progress'])
                ->value('ticket_status_ID') ?? 2;

            $update = ['updated_at' => now(), 'ticket_status_ID' => $inProgressId];
            if ($employees->count() > 0) {
                $update['assigned_to'] = $employees->first();
            }
            if (array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null) {
                $update['priority_ID'] = $validated['priority_ID'];
            }

            DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

            if ($employees->count() > 0) {
                DB::table('ticket_assignments')->where('ticket_ID', $ticketId)->delete();
                foreach ($employees as $employeeId) {
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
            }

            // insert audit log entries for each change
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

        return response()->json(['message' => 'Ticket accepted and updated.']);
    }

    public function updateTicket(Request $request, int $ticketId)
    {
        $validated = $request->validate([
            'ticket_status_ID' => ['nullable', 'integer', 'exists:ticket_statuses,ticket_status_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'assigned_by_email' => ['nullable', 'email'],
        ]);

        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $assignedBy = DB::table('users')
            ->where('email', $validated['assigned_by_email'] ?? '')
            ->value('id') ?? 2;

        $changes = [];

        if (array_key_exists('ticket_status_ID', $validated) && $validated['ticket_status_ID'] !== null) {
            if ($ticket->ticket_status_ID != $validated['ticket_status_ID']) {
                $changes[] = ['field' => 'ticket_status_ID', 'old' => $ticket->ticket_status_ID, 'new' => $validated['ticket_status_ID']];
            }
        }

        if (array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null) {
            if ($ticket->priority_ID != $validated['priority_ID']) {
                $changes[] = ['field' => 'priority_ID', 'old' => $ticket->priority_ID, 'new' => $validated['priority_ID']];
            }
        }

        if (empty($changes)) {
            return response()->json(['message' => 'No changes to update.']);
        }

        DB::transaction(function () use ($ticketId, $validated, $assignedBy, $changes) {
            $update = ['updated_at' => now()];
            if (array_key_exists('ticket_status_ID', $validated) && $validated['ticket_status_ID'] !== null) {
                $update['ticket_status_ID'] = $validated['ticket_status_ID'];
            }
            if (array_key_exists('priority_ID', $validated) && $validated['priority_ID'] !== null) {
                $update['priority_ID'] = $validated['priority_ID'];
            }

            DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

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

        return response()->json(['message' => 'Ticket updated successfully.']);
    }

    public function employeeTickets(Request $request)
    {
        $employeeEmail = (string) $request->query('employee_email', '');
        if ($employeeEmail === '') {
            return response()->json(['message' => 'employee_email is required'], 422);
        }

        $employeeId = DB::table('users')->where('email', $employeeEmail)->value('id');
        if (!$employeeId) {
            return response()->json(['tickets' => []]);
        }

        $tickets = DB::table('ticket_assignments as ta')
            ->join('tickets as t', 't.ticket_ID', '=', 'ta.ticket_ID')
            ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
            ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
            ->join('ticket_priorities as tp', 'tp.priority_ID', '=', 't.priority_ID')
            ->join('machines as m', 'm.machine_ID', '=', 't.machine_ID')
            ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
            ->leftJoin('users as cu', 'cu.id', '=', 't.created_by')
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
                'cu.name as created_by_name'
            )
            ->get()
            ->map(function ($row) {
                return [
                    'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
                    'title' => $row->title,
                    'customer' => $row->client_name ?: 'Unknown Customer',
                    'facility' => null,
                    'equipment' => $row->machine_name . ' - ' . $row->serial_number,
                    'status' => $row->status_name,
                    'priority' => $row->priority_name,
                    'category' => $row->category_name,
                    'date' => optional($row->created_at)->format('Y-m-d') ?? now()->format('Y-m-d'),
                    'slaStatus' => $this->slaLabel($row->created_at),
                    'lastUpdate' => optional($row->updated_at)->format('M d, Y') ?? now()->format('M d, Y'),
                    'accepted' => true,
                    'escalated' => strtolower((string) $row->priority_name) === 'critical',
                ];
            })
            ->values();

        return response()->json([
            'tickets' => $tickets,
        ]);
    }
}