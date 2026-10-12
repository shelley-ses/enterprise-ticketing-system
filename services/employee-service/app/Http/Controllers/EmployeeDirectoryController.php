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

    /**
     * Search and filter employees by name, department, branch, or role (TS107).
     * Scoped to the Admin's permitted visibility.
     */
    public function searchEmployees(Request $request)
    {
        $user = $request->user();
        $queryText = trim((string) ($request->query('q') ?? $request->query('name') ?? $request->query('search') ?? ''));
        $department = trim((string) $request->query('department', ''));
        $branch = trim((string) $request->query('branch', ''));
        $role = trim((string) $request->query('role', ''));
        $status = trim((string) $request->query('status', ''));

        $query = DB::table('employees')
            ->select(
                'emp_id as id',
                'first_name',
                'last_name',
                DB::raw("CONCAT(first_name, ' ', last_name) as name"),
                'email',
                'role',
                'department',
                'is_active',
                'last_seen_at'
            )
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer']);

        $hasBranch = \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch');
        $hasBranchId = \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch_id');
        if ($hasBranch) {
            $query->addSelect('branch');
        } elseif ($hasBranchId) {
            $query->addSelect('branch_id as branch');
        }

        // 1. Partial Name search (first_name, last_name, full name, or email)
        if ($queryText !== '') {
            $query->where(function ($q) use ($queryText) {
                $q->where('first_name', 'like', "%{$queryText}%")
                  ->orWhere('last_name', 'like', "%{$queryText}%")
                  ->orWhere(DB::raw("CONCAT(first_name, ' ', last_name)"), 'like', "%{$queryText}%")
                  ->orWhere('email', 'like', "%{$queryText}%");
            });
        }

        // 2. Department filter
        if ($department !== '' && strtolower($department) !== 'all') {
            $query->whereRaw('LOWER(department) = ?', [strtolower($department)]);
        }

        // 3. Role filter
        if ($role !== '' && strtolower($role) !== 'all') {
            $query->whereRaw('LOWER(role) = ?', [strtolower($role)]);
        }

        // 4. Status filter
        if ($status !== '' && strtolower($status) !== 'all') {
            if (in_array(strtolower($status), ['active', '1', 'true'], true)) {
                $query->where('is_active', true);
            } elseif (in_array(strtolower($status), ['inactive', '0', 'false'], true)) {
                $query->where('is_active', false);
            }
        }

        // 5. Branch scoping & filtering
        if ($hasBranch || $hasBranchId) {
            $branchCol = $hasBranch ? 'branch' : 'branch_id';
            // Admin branch scope restriction
            if ($user && isset($user->role) && !in_array(strtolower(trim($user->role)), ['superadmin', 'super admin'], true)) {
                $userBranch = $user->branch ?? $user->branch_id ?? null;
                if ($userBranch) {
                    $query->where($branchCol, $userBranch);
                }
            }
            if ($branch !== '' && strtolower($branch) !== 'all') {
                $query->where($branchCol, $branch);
            }
        }

        $employees = $query
            ->orderByDesc('is_active')
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get();

        $formatted = $employees->map(function ($emp) {
            return [
                'id' => (int) $emp->id,
                'name' => $emp->name,
                'first_name' => $emp->first_name,
                'last_name' => $emp->last_name,
                'email' => $emp->email,
                'role' => $emp->role,
                'department' => $emp->department,
                'branch' => $emp->branch ?? 'Main',
                'is_active' => (bool) $emp->is_active,
                'status' => $emp->is_active ? 'Active' : 'Inactive',
                'last_seen_at' => $emp->last_seen_at ?? null,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $formatted,
            'total' => $formatted->count(),
            'message' => $formatted->isEmpty() ? 'No employees match your search — try adjusting your filters.' : 'Employees retrieved successfully.',
        ]);
    }

    /**
     * Get dynamic filter options (departments, branches, roles) for Admin search (TS107).
     */
    public function filterOptions(Request $request)
    {
        $user = $request->user();

        // Departments from departments table or distinct from employees
        $departments = [];
        if (\Illuminate\Support\Facades\Schema::hasTable('departments')) {
            $departments = DB::table('departments')
                ->where('is_active', true)
                ->orderBy('name')
                ->pluck('name')
                ->toArray();
        }
        if (empty($departments)) {
            $departments = DB::table('employees')
                ->whereNotNull('department')
                ->where('department', '!=', '')
                ->distinct()
                ->orderBy('department')
                ->pluck('department')
                ->toArray();
        }

        // Distinct roles from employees
        $roles = DB::table('employees')
            ->whereNotNull('role')
            ->where('role', '!=', '')
            ->whereRaw('LOWER(role) != ?', ['customer'])
            ->distinct()
            ->orderBy('role')
            ->pluck('role')
            ->toArray();

        // Branches from branches table or default options
        $branches = [];
        if (\Illuminate\Support\Facades\Schema::hasTable('branches')) {
            $branchesQuery = DB::table('branches')->where('is_active', true)->orderBy('name');
            if ($user && isset($user->role) && !in_array(strtolower(trim($user->role)), ['superadmin', 'super admin'], true)) {
                $userBranch = $user->branch ?? $user->branch_id ?? null;
                if ($userBranch) {
                    $branchesQuery->where('slug', $userBranch);
                }
            }
            $branches = $branchesQuery->select('slug', 'name', 'code')->get();
        } else {
            $branches = [
                ['slug' => 'main', 'name' => 'Main Branch', 'code' => 'MAIN'],
                ['slug' => 'luzon', 'name' => 'Luzon Regional Center', 'code' => 'LUZ'],
                ['slug' => 'visayas', 'name' => 'Visayas Medical Hub', 'code' => 'VIS'],
                ['slug' => 'mindanao', 'name' => 'Mindanao Regional Branch', 'code' => 'MIN'],
            ];
        }

        return response()->json([
            'departments' => array_values(array_unique($departments)),
            'roles' => array_values(array_unique($roles)),
            'branches' => $branches,
        ]);
    }
}
