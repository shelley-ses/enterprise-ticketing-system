<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TicketController extends Controller
{
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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_ID' => ['required', 'integer', 'exists:machines,machine_ID'],
            'problem_category_ID' => ['required', 'integer', 'exists:problem_categories,problem_category_ID'],
            'created_by' => ['nullable', 'integer', 'exists:users,id'],
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
        $defaultPriorityId = DB::table('ticket_priorities')->where('priority_name', 'Low')->value('priority_ID') ?? 1;

        $ticketId = DB::table('tickets')->insertGetId([
            'machine_ID' => $validated['machine_ID'],
            'problem_category_ID' => $validated['problem_category_ID'],
            'created_by' => $validated['created_by'] ?? 1,
            'assigned_to' => $validated['assigned_to'] ?? null,
            'ticket_type_ID' => $validated['ticket_type_ID'] ?? $defaultTicketTypeId,
            'priority_ID' => $validated['priority_ID'] ?? $defaultPriorityId,
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
}