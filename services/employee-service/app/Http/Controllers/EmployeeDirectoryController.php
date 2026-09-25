<?php

namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeDirectoryController extends Controller
{
    /**
     * Get list of assignable employees filtered by department and exclude requested_by.
     */
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

    /**
     * Get all active departments.
     */
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

    /**
     * Get the authenticated employee's profile info.
     */
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
}
