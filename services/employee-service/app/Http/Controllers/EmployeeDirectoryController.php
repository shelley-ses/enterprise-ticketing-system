<?php

namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeDirectoryController extends Controller
{
    /**
     * Resolve category track (Service, IT, Others) for a ticket (TS110).
     */
    public static function resolveCategoryTrack($ticket): string
    {
        if (!$ticket) {
            return 'service';
        }

        $categoryName = '';
        if (!empty($ticket->problem_category_ID)) {
            $categoryName = DB::table('problem_categories')
                ->where('problem_category_ID', $ticket->problem_category_ID)
                ->value('category_name') ?? '';
        }

        $deptName = '';
        if (!empty($ticket->department_id)) {
            $deptName = DB::table('departments')
                ->where('id', $ticket->department_id)
                ->value('name') ?? '';
        }

        // Pull category-track rules from Configuration Service if available (TS110)
        try {
            $configuredTrack = \Illuminate\Support\Facades\Cache::remember('config:track:' . ($ticket->problem_category_ID ?? 0), 60, function () use ($categoryName) {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $res = \Illuminate\Support\Facades\Http::timeout(2)->get("{$configUrl}/api/ticket-configurations/category_track_rules");
                if ($res->successful()) {
                    $rules = $res->json('value') ?? $res->json();
                    if (is_array($rules)) {
                        $key = strtolower(trim($categoryName));
                        return $rules[$key] ?? null;
                    }
                }
                return null;
            });
            if ($configuredTrack && in_array(strtolower($configuredTrack), ['service', 'it', 'others'], true)) {
                return strtolower($configuredTrack);
            }
        } catch (\Throwable $e) {}

        $combined = strtolower($categoryName . ' ' . $deptName . ' ' . ($ticket->title ?? '') . ' ' . ($ticket->description ?? ''));

        if (preg_match('/\b(it|information technology|software|network|system|server|database|computer|login|password|wifi|bug|api)\b/i', $combined)) {
            return 'it';
        }

        if (preg_match('/\b(service|biomedical|machine|hardware|device|calibration|repair|equipment|imaging|clinical|maintenance|failure)\b/i', $combined)) {
            return 'service';
        }

        return 'others';
    }

    /**
     * Check if an employee qualifies for a category track and branch (TS110).
     */
    public static function checkEligibility($emp, $ticket = null, string $track = 'service'): array
    {
        $dept = strtolower(trim((string) ($emp->department ?? '')));
        $role = strtolower(trim((string) ($emp->role ?? '')));

        // Customer service or customer or superadmin cannot be regular assignees
        if (in_array($role, ['customer service', 'customer support', 'cs', 'customer'], true)) {
            return [
                'eligible' => false,
                'reason' => 'Customer service and customer users cannot be assigned to tickets.',
            ];
        }

        // Check track qualification
        $trackEligible = false;
        if ($track === 'service') {
            $trackEligible = in_array($dept, ['service', 'biomedical', 'clinical engineering', 'maintenance', 'operations'], true)
                || str_contains($role, 'service')
                || str_contains($role, 'biomedical')
                || str_contains($role, 'technician')
                || (str_contains($role, 'engineer') && !str_contains($role, 'software') && !str_contains($role, 'systems'));
        } elseif ($track === 'it') {
            $trackEligible = in_array($dept, ['it', 'information technology', 'systems', 'network', 'technical support', 'engineering'], true)
                || str_contains($role, 'it')
                || str_contains($role, 'system')
                || str_contains($role, 'network')
                || str_contains($role, 'software')
                || str_contains($role, 'support');
        } else { // 'others'
            $trackEligible = true;
        }

        if (!$trackEligible) {
            $trackLabel = strtoupper($track);
            return [
                'eligible' => false,
                'reason' => "Employee role ({$emp->role}) or department ({$emp->department}) does not qualify for {$trackLabel} category track.",
            ];
        }

        // Branch check if branch is specified on both ticket and employee
        if ($ticket) {
            $hasBranchCol = \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch');
            $hasBranchIdCol = \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch_id');
            $empBranch = null;
            if ($hasBranchCol && isset($emp->branch)) {
                $empBranch = $emp->branch;
            } elseif ($hasBranchIdCol && isset($emp->branch_id)) {
                $empBranch = $emp->branch_id;
            }

            $ticketBranch = $ticket->branch_id ?? $ticket->branch ?? null;

            if ($ticketBranch && $empBranch && strtolower($ticketBranch) !== 'all' && strtolower($empBranch) !== 'all') {
                if (strtolower($ticketBranch) !== strtolower($empBranch) && strtolower($empBranch) !== 'main') {
                    return [
                        'eligible' => false,
                        'reason' => "Branch mismatch: employee belongs to {$empBranch}, but ticket is designated for {$ticketBranch}.",
                    ];
                }
            }
        }

        return [
            'eligible' => true,
            'reason' => null,
        ];
    }

    /**
     * Get list of assignable employees filtered by department, track, and exclude requested_by (TS110).
     */
    public function assignableEmployees(Request $request)
    {
        $department = $request->query('department');
        $ticketId = $request->query('ticket_id');
        $track = $request->query('track');

        $query = DB::table('employees')
            ->select('emp_id as id', DB::raw("CONCAT(first_name, ' ', last_name) as name"), 'email', 'role', 'department', 'is_active')
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer service'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['superadmin'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['super admin']);

        if (\Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch')) {
            $query->addSelect('branch');
        } elseif (\Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch_id')) {
            $query->addSelect('branch_id as branch');
        }

        if ($department) {
            $query->where('department', $department);
        }

        $ticket = null;
        if ($ticketId) {
            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
            if ($ticket && !empty($ticket->requested_by)) {
                $query->where('emp_id', '!=', $ticket->requested_by);
            }
        }

        $resolvedTrack = $track ? strtolower($track) : ($ticket ? self::resolveCategoryTrack($ticket) : null);

        $employees = $query
            ->orderByDesc('is_active')
            ->orderBy(DB::raw("CONCAT(first_name, ' ', last_name)"))
            ->get();

        if ($resolvedTrack) {
            $employees = $employees->filter(function ($emp) use ($ticket, $resolvedTrack) {
                $res = self::checkEligibility($emp, $ticket, $resolvedTrack);
                return $res['eligible'];
            })->values();
        }

        return response()->json([
            'employees' => $employees,
            'track' => $resolvedTrack,
        ]);
    }

    /**
     * Filter employee eligibility based on ticket category tracks (TS110).
     * Returns categorized lists of eligible vs ineligible employees with detailed reasons.
     */
    public function eligibleEmployees(Request $request, int $ticketId)
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found.'], 404);
        }

        $trackOverride = $request->query('track');
        $track = $trackOverride ? strtolower(trim($trackOverride)) : self::resolveCategoryTrack($ticket);

        $query = DB::table('employees')
            ->select('emp_id as id', DB::raw("CONCAT(first_name, ' ', last_name) as name"), 'email', 'role', 'department', 'is_active')
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer service'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer']);

        if (\Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch')) {
            $query->addSelect('branch');
        } elseif (\Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch_id')) {
            $query->addSelect('branch_id as branch');
        }

        $requestedBy = $ticket->requested_by ?? null;
        if ($requestedBy) {
            $query->where('emp_id', '!=', $requestedBy);
        }

        $employees = $query->orderByDesc('is_active')->orderBy('first_name')->get();

        $eligible = [];
        $ineligible = [];

        foreach ($employees as $emp) {
            $eligibility = self::checkEligibility($emp, $ticket, $track);
            $item = [
                'id' => (int) $emp->id,
                'name' => $emp->name,
                'email' => $emp->email,
                'role' => $emp->role,
                'department' => $emp->department,
                'branch' => $emp->branch ?? 'Main',
                'is_active' => (bool) $emp->is_active,
                'eligible' => $eligibility['eligible'],
                'ineligibility_reason' => $eligibility['reason'],
            ];

            if ($eligibility['eligible']) {
                $eligible[] = $item;
            } else {
                $ineligible[] = $item;
            }
        }

        return response()->json([
            'ticket_id' => (int) $ticketId,
            'ticket_number' => $ticket->ticket_number ?? null,
            'track' => $track,
            'branch' => $ticket->branch_id ?? $ticket->branch ?? 'Main',
            'eligible_count' => count($eligible),
            'ineligible_count' => count($ineligible),
            'eligible_employees' => $eligible,
            'ineligible_employees' => $ineligible,
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
