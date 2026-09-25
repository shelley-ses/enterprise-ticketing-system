<?php

namespace App\Http\Controllers;

use App\Services\EmployeeAssignmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeAssignmentController extends Controller
{
    protected EmployeeAssignmentService $assignmentService;

    public function __construct(EmployeeAssignmentService $assignmentService)
    {
        $this->assignmentService = $assignmentService;
    }

    public function assignTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized. Please log in.'], 401);
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
            $r = strtolower(trim((string) $row->role));
            return in_array($r, ['customer service', 'customer support', 'cs']);
        });

        if ($invalid) {
            return response()->json([
                'message' => 'Customer-service users cannot be assignees.',
            ], 422);
        }

        $assignedBy = DB::table('employees')
            ->where('email', $validated['assigned_by_email'] ?? '')
            ->value('emp_id') ?? ($user ? $user->emp_id : 2);

        $result = $this->assignmentService->assignTicket($ticketId, $validated, $assignedBy);
        return response()->json($result['data'], $result['status']);
    }

    public function acceptTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized. Please log in.'], 401);
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        $isCS = in_array($role, ['customer service', 'customer support', 'cs', 'admin', 'superadmin', 'super admin']);

        // Only CS / Admin performing ticket assignment/reassignment uses the validated employee_ids branch
        if ($isCS && $request->has('employee_ids')) {
            $validated = $request->validate([
                'employee_ids' => ['required', 'array', 'min:1'],
                'employee_ids.*' => ['integer', 'exists:employees,emp_id'],
                'assigned_by_email' => ['nullable', 'email'],
                'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            ]);

            $result = $this->assignmentService->acceptTicket($ticketId, $user, $validated);
            return response()->json($result['data'], $result['status']);
        }

        // Engineer self-accepting their assigned ticket
        $result = $this->assignmentService->acceptTicket($ticketId, $user);
        return response()->json($result['data'], $result['status']);
    }

    public function employeeUpdate(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:In Progress,Pending,Resolved,Pending Assignment,On Hold,Pending Evaluation,Closed,Open'],
            'remarks' => ['nullable', 'string', 'max:250'],
            'internal_note' => ['nullable', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['integer'],
            'is_proof' => ['nullable'],
        ]);

        $isProof = filter_var($request->input('is_proof', false), FILTER_VALIDATE_BOOLEAN);

        $result = $this->assignmentService->employeeUpdate($ticketId, $user->emp_id, $validated, $isProof);
        return response()->json($result['data'], $result['status']);
    }

    public function employeeTickets(Request $request)
    {
        $employeeEmail = (string) $request->query('employee_email', '');
        if ($employeeEmail === '') {
            return response()->json(['message' => 'employee_email is required'], 422);
        }

        $tickets = $this->assignmentService->getEmployeeTickets($employeeEmail);
        return response()->json(['tickets' => $tickets]);
    }

    public function internalTickets(Request $request)
    {
        $user = $request->user();
        if (!$user || $user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $tickets = $this->assignmentService->getInternalTickets($user->emp_id);
        return response()->json(['tickets' => $tickets]);
    }
}
