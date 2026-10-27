<?php

namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeDirectoryController extends Controller
{
    /**
     * Resolve category track (Service, IT, Others) for a ticket (TS110).
     */
    /**
     * Resolve category name for a ticket.
     */
    public static function resolveCategoryName($ticket): string
    {
        if (!$ticket) {
            return '';
        }

        if (!empty($ticket->problem_category_ID)) {
            $name = DB::table('problem_categories')
                ->where('problem_category_ID', $ticket->problem_category_ID)
                ->value('category_name');
            if ($name) {
                return (string) $name;
            }
        }

        if (!empty($ticket->category)) {
            return (string) $ticket->category;
        }

        return '';
    }

    /**
     * Resolve category track (Service, IT, Others) for a ticket (TS110).
     */
    public static function resolveCategoryTrack($ticket): string
    {
        if (!$ticket) {
            return 'service';
        }

        $categoryName = self::resolveCategoryName($ticket);

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
     * Fetch category escalation rules dynamically from Configuration Service.
     */
    public static function fetchCategoryEscalationRules(): array
    {
        return \Illuminate\Support\Facades\Cache::remember('config:category_escalation_rules', 60, function () {
            try {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $res = \Illuminate\Support\Facades\Http::timeout(2)->get("{$configUrl}/api/ticket-configurations/category_escalation_rules");
                if ($res->successful()) {
                    $val = $res->json('value') ?? $res->json();
                    if (is_array($val) && !empty($val)) {
                        return $val;
                    }
                }
            } catch (\Throwable $e) {}

            return [
                'biomedical' => [
                    'department' => ['Service', 'Biomedical Engineering', 'Radiology Maintenance', 'Facilities & Equipment'],
                    'min_position_level' => 'Senior',
                    'allowed_roles' => ['Biomedical Engineer', 'Senior Biomedical Engineer', 'Lead Service Engineer', 'Field Service Specialist', 'Hardware Specialist'],
                    'allow_cross_branch' => false,
                ],
                'hardware' => [
                    'department' => ['Service', 'Facilities & Equipment', 'Radiology Maintenance'],
                    'min_position_level' => 'Mid',
                    'allowed_roles' => ['Service Technician', 'Hardware Specialist', 'Biomedical Engineer', 'Field Service Specialist', 'Biomedical Technician'],
                    'allow_cross_branch' => false,
                ],
                'network' => [
                    'department' => ['IT', 'IT Support', 'Network Operations'],
                    'min_position_level' => 'Mid',
                    'allowed_roles' => ['Network Administrator', 'Systems Specialist', 'IT Support Specialist', 'Systems Administrator'],
                    'allow_cross_branch' => false,
                ],
                'software' => [
                    'department' => ['IT', 'IT Support', 'Network Operations'],
                    'min_position_level' => 'Mid',
                    'allowed_roles' => ['Software Specialist', 'Systems Specialist', 'Systems Administrator', 'IT Support Specialist'],
                    'allow_cross_branch' => false,
                ],
                'general' => [
                    'department' => ['Service', 'IT', 'Facilities & Equipment', 'Operations'],
                    'min_position_level' => 'Junior',
                    'allowed_roles' => [],
                    'allow_cross_branch' => false,
                ],
            ];
        });
    }

    /**
     * Match a specific escalation rule for a category and track.
     */
    public static function matchCategoryEscalationRule(string $categoryName, string $track): array
    {
        $rules = self::fetchCategoryEscalationRules();
        $catLower = strtolower(trim($categoryName));

        if ($catLower !== '' && isset($rules[$catLower])) {
            return $rules[$catLower];
        }

        if (preg_match('/\b(biomedical|imaging|mri|x-ray|xray|ultrasound|scanner|clinical|dialysis|ventilator)\b/i', $catLower)) {
            return $rules['biomedical'] ?? $rules['general'] ?? [];
        }

        if (preg_match('/\b(hardware|printer|machine|device|calibration|repair|part|board)\b/i', $catLower)) {
            return $rules['hardware'] ?? $rules['general'] ?? [];
        }

        if (preg_match('/\b(network|wifi|router|switch|lan|vpn|firewall|dns|ip)\b/i', $catLower)) {
            return $rules['network'] ?? $rules['general'] ?? [];
        }

        if (preg_match('/\b(software|app|system|login|password|database|bug|portal|api)\b/i', $catLower)) {
            return $rules['software'] ?? $rules['general'] ?? [];
        }

        if ($track === 'service') {
            return $rules['biomedical'] ?? $rules['hardware'] ?? $rules['general'] ?? [];
        } elseif ($track === 'it') {
            return $rules['network'] ?? $rules['software'] ?? $rules['general'] ?? [];
        }

        return $rules['general'] ?? [
            'department' => ['Service', 'IT'],
            'min_position_level' => 'Junior',
            'allowed_roles' => [],
            'allow_cross_branch' => false,
        ];
    }

    /**
     * Map position levels to numerical ranks for comparison.
     */
    public static function positionLevelRank(?string $level): int
    {
        $l = strtolower(trim((string) $level));
        return match ($l) {
            'manager' => 5,
            'lead' => 4,
            'senior' => 3,
            'mid' => 2,
            'junior' => 1,
            default => 1,
        };
    }

    /**
     * Fetch designated department managers for Service, IT, and Customer Service.
     */
    public static function fetchDepartmentManagers(): array
    {
        return \Illuminate\Support\Facades\Cache::remember('department_managers:cache', 60, function () {
            $managerEmps = DB::table('employees')
                ->where('is_active', true)
                ->where(function ($q) {
                    $q->whereRaw('LOWER(COALESCE(position_level, "")) = ?', ['manager'])
                      ->orWhereRaw('LOWER(COALESCE(position_level, "")) = ?', ['lead'])
                      ->orWhereRaw('LOWER(COALESCE(role, "")) LIKE ?', ['%manager%'])
                      ->orWhereRaw('LOWER(COALESCE(role, "")) LIKE ?', ['%lead%']);
                })
                ->select('emp_id as id', DB::raw("CONCAT(first_name, ' ', last_name) as name"), 'email', 'phone_number', 'role', 'department', 'position_level', 'technical_role', 'branch')
                ->get();

            $serviceMgr = null;
            $itMgr = null;
            $csMgr = null;

            foreach ($managerEmps as $m) {
                $deptLower = strtolower(trim((string) $m->department));
                $roleLower = strtolower(trim((string) $m->role));

                if (!$csMgr && (str_contains($deptLower, 'customer') || str_contains($roleLower, 'customer') || str_contains($roleLower, 'cs'))) {
                    $csMgr = [
                        'id' => (int) $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'phone' => $m->phone_number ?? '+63 917 345 6789',
                        'department' => $m->department ?: 'Customer Support',
                        'position_level' => $m->position_level ?: 'Manager',
                        'role' => $m->role ?: 'Customer Support Lead',
                        'branch' => $m->branch ?? 'Main',
                    ];
                } elseif (!$serviceMgr && (str_contains($deptLower, 'service') || str_contains($deptLower, 'biomedical') || str_contains($deptLower, 'radiology') || str_contains($roleLower, 'service') || str_contains($roleLower, 'biomedical'))) {
                    $serviceMgr = [
                        'id' => (int) $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'phone' => $m->phone_number ?? '+63 917 123 4567',
                        'department' => $m->department ?: 'Service',
                        'position_level' => $m->position_level ?: 'Manager',
                        'role' => $m->role ?: 'Lead Service Engineer',
                        'branch' => $m->branch ?? 'Main',
                    ];
                } elseif (!$itMgr && (str_contains($deptLower, 'it') || str_contains($deptLower, 'network') || str_contains($roleLower, 'it') || str_contains($roleLower, 'system'))) {
                    $itMgr = [
                        'id' => (int) $m->id,
                        'name' => $m->name,
                        'email' => $m->email,
                        'phone' => $m->phone_number ?? '+63 917 234 5678',
                        'department' => $m->department ?: 'IT Support',
                        'position_level' => $m->position_level ?: 'Manager',
                        'role' => $m->role ?: 'IT Systems Specialist',
                        'branch' => $m->branch ?? 'Main',
                    ];
                }
            }

            try {
                $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
                $res = \Illuminate\Support\Facades\Http::timeout(2)->get("{$configUrl}/api/ticket-configurations/department_managers");
                if ($res->successful()) {
                    $configVal = $res->json('value') ?? $res->json();
                    if (is_array($configVal)) {
                        if (!$serviceMgr && !empty($configVal['service'])) {
                            $serviceMgr = $configVal['service'];
                        }
                        if (!$itMgr && !empty($configVal['it'])) {
                            $itMgr = $configVal['it'];
                        }
                        if (!$csMgr && !empty($configVal['cs'])) {
                            $csMgr = $configVal['cs'];
                        }
                    }
                }
            } catch (\Throwable $e) {}

            return [
                'service' => $serviceMgr ?? [
                    'id' => 1028,
                    'name' => 'Carlos Mendoza',
                    'email' => 'carlos.mendoza@sbsi.com.ph',
                    'phone' => '+63 917 123 4567',
                    'department' => 'Service',
                    'position_level' => 'Manager',
                    'role' => 'Lead Service Engineer',
                    'branch' => 'Main',
                ],
                'it' => $itMgr ?? [
                    'id' => 1038,
                    'name' => 'Michael Scott',
                    'email' => 'michael.scott@sbsi.com.ph',
                    'phone' => '+63 917 234 5678',
                    'department' => 'IT Support',
                    'position_level' => 'Manager',
                    'role' => 'IT Systems Specialist',
                    'branch' => 'Main',
                ],
                'cs' => $csMgr ?? [
                    'id' => 1,
                    'name' => 'Ava Santos',
                    'email' => 'ava.santos@sbsi.com.ph',
                    'phone' => '+63 917 345 6789',
                    'department' => 'Customer Support',
                    'position_level' => 'Manager',
                    'role' => 'Customer Support Lead',
                    'branch' => 'Main',
                ],
            ];
        });
    }

    /**
     * Check if an employee qualifies for a category track and branch (TS110).
     */
    public static function checkEligibility($emp, $ticket = null, string $track = 'service', ?array $rule = null): array
    {
        $dept = strtolower(trim((string) ($emp->department ?? '')));
        $role = strtolower(trim((string) ($emp->role ?? '')));

        // Customer service or customer or superadmin cannot be regular assignees
        if (in_array($role, ['customer service', 'customer support', 'cs', 'customer', 'superadmin', 'super admin'], true)) {
            return [
                'eligible' => false,
                'reason' => 'Customer service, customer, and administrative users cannot be assigned to tickets.',
            ];
        }

        if (!$rule) {
            $catName = $ticket ? self::resolveCategoryName($ticket) : '';
            $rule = self::matchCategoryEscalationRule($catName, $track);
        }

        // 1. Department qualification
        $allowedDepts = array_map(fn($d) => strtolower(trim($d)), $rule['department'] ?? []);
        if (!empty($allowedDepts)) {
            $deptMatches = in_array($dept, $allowedDepts, true);
            if (!$deptMatches) {
                foreach ($allowedDepts as $ad) {
                    if ($ad !== '' && (str_contains($dept, $ad) || str_contains($ad, $dept))) {
                        $deptMatches = true;
                        break;
                    }
                }
            }
            if (!$deptMatches) {
                $allowedList = implode(', ', $rule['department']);
                return [
                    'eligible' => false,
                    'reason' => "Department '{$emp->department}' does not qualify for this category. Required: {$allowedList}.",
                ];
            }
        }

        // 2. Position level qualification
        $minLevel = $rule['min_position_level'] ?? 'Junior';
        $minRank = self::positionLevelRank($minLevel);
        $empRank = self::positionLevelRank($emp->position_level ?? 'Junior');
        if ($empRank < $minRank) {
            $empLevel = $emp->position_level ?: 'Junior';
            return [
                'eligible' => false,
                'reason' => "Position level '{$empLevel}' is below the required '{$minLevel}' seniority level.",
            ];
        }

        // 3. Technical role qualification (if allowed_roles specified)
        $allowedRoles = $rule['allowed_roles'] ?? [];
        if (!empty($allowedRoles)) {
            $techRole = strtolower(trim((string) ($emp->technical_role ?? '')));
            $primaryRole = strtolower(trim((string) ($emp->role ?? '')));
            $roleMatches = false;
            foreach ($allowedRoles as $ar) {
                $arLower = strtolower(trim($ar));
                if ($arLower !== '' && (
                    $techRole === $arLower
                    || $primaryRole === $arLower
                    || str_contains($techRole, $arLower)
                    || str_contains($primaryRole, $arLower)
                    || str_contains($arLower, $techRole)
                )) {
                    $roleMatches = true;
                    break;
                }
            }
            if (!$roleMatches) {
                $dispRole = $emp->technical_role ?: $emp->role ?: 'Unspecified';
                $roleList = implode(', ', $allowedRoles);
                return [
                    'eligible' => false,
                    'reason' => "Technical role '{$dispRole}' is not an authorized role ({$roleList}).",
                ];
            }
        }

        // 4. Branch scoping (respecting allow_cross_branch)
        $allowCrossBranch = (bool) ($rule['allow_cross_branch'] ?? false);
        if ($ticket && !$allowCrossBranch) {
            $empBranch = $emp->branch ?? null;
            $ticketBranch = $ticket->branch_id ?? $ticket->branch ?? null;

            if ($ticketBranch && $empBranch && strtolower($ticketBranch) !== 'all' && strtolower($empBranch) !== 'all') {
                if (strtolower($ticketBranch) !== strtolower($empBranch) && strtolower($empBranch) !== 'main') {
                    return [
                        'eligible' => false,
                        'reason' => "Branch mismatch: employee belongs to {$empBranch}, but ticket is designated for {$ticketBranch} (cross-branch assignment disabled).",
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
            ->select('emp_id as id', DB::raw("CONCAT(first_name, ' ', last_name) as name"), 'email', 'role', 'department', 'position_level', 'technical_role', 'is_active')
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
        $categoryName = $ticket ? self::resolveCategoryName($ticket) : '';
        $rule = self::matchCategoryEscalationRule($categoryName, $resolvedTrack ?? 'service');
        $departmentManagers = self::fetchDepartmentManagers();

        $employees = $query
            ->orderByDesc('is_active')
            ->orderBy(DB::raw("CONCAT(first_name, ' ', last_name)"))
            ->get();

        if ($resolvedTrack) {
            $employees = $employees->filter(function ($emp) use ($ticket, $resolvedTrack, $rule) {
                $res = self::checkEligibility($emp, $ticket, $resolvedTrack, $rule);
                return $res['eligible'];
            })->values();
        }

        return response()->json([
            'employees' => $employees,
            'track' => $resolvedTrack,
            'category' => $categoryName,
            'rule' => $rule,
            'department_managers' => $departmentManagers,
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
        $categoryName = self::resolveCategoryName($ticket);
        $rule = self::matchCategoryEscalationRule($categoryName, $track);
        $departmentManagers = self::fetchDepartmentManagers();

        $query = DB::table('employees')
            ->select('emp_id as id', DB::raw("CONCAT(first_name, ' ', last_name) as name"), 'email', 'role', 'department', 'position_level', 'technical_role', 'is_active')
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer service'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['superadmin'])
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['super admin']);

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
            $eligibility = self::checkEligibility($emp, $ticket, $track, $rule);
            $item = [
                'id' => (int) $emp->id,
                'name' => $emp->name,
                'email' => $emp->email,
                'role' => $emp->role,
                'department' => $emp->department,
                'branch' => $emp->branch ?? 'Main',
                'position_level' => $emp->position_level ?? 'Junior',
                'technical_role' => $emp->technical_role ?? $emp->role ?? 'Specialist',
                'availability_status' => (bool) $emp->is_active ? 'available' : 'unavailable',
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

        $emptyGuidance = count($eligible) === 0
            ? 'No eligible employees currently match the required department, position level, and technical role criteria for this category. Please escalate to the designated department manager or contact Customer Service leadership.'
            : null;

        return response()->json([
            'ticket_id' => (int) $ticketId,
            'ticket_number' => $ticket->ticket_number ?? null,
            'track' => $track,
            'category' => $categoryName,
            'branch' => $ticket->branch_id ?? $ticket->branch ?? 'Main',
            'rule' => $rule,
            'department_managers' => $departmentManagers,
            'eligible_count' => count($eligible),
            'ineligible_count' => count($ineligible),
            'eligible_employees' => $eligible,
            'ineligible_employees' => $ineligible,
            'empty_state_guidance' => $emptyGuidance,
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
     * Get the authenticated employee's profile info as synced from the Auth system (TS105).
     * Includes last synced timestamp, read-only field metadata, and graceful fallback to cached record.
     */
    public function employeeProfile(Request $request)
    {
        $user = $request->user();
        if (!$user || $user instanceof \App\Models\Client) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $empId = $user->emp_id ?? $user->id;
        $employee = DB::table('employees')->where('emp_id', $empId)->first();
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Employee profile not found'], 404);
        }

        $authSyncStatus = 'synced';
        $syncNote = null;
        $authServiceUrl = env('CUSTOMER_SERVICE_URL', 'http://customer-service:8000');
        $token = $request->bearerToken();

        // Attempt live sync from central Auth system
        try {
            $client = \Illuminate\Support\Facades\Http::timeout(3);
            if ($token) {
                $client = $client->withToken($token);
            }
            $res = $client->get("{$authServiceUrl}/api/auth/me");
            if ($res->successful()) {
                $authData = $res->json('user') ?? $res->json('data') ?? $res->json();
                if (is_array($authData)) {
                    $updates = [];
                    if (\Illuminate\Support\Facades\Schema::hasColumn('employees', 'last_synced_at')) {
                        $updates['last_synced_at'] = now();
                    }
                    if (!empty($authData['first_name'])) $updates['first_name'] = $authData['first_name'];
                    if (!empty($authData['last_name'])) $updates['last_name'] = $authData['last_name'];
                    if (!empty($authData['email'])) $updates['email'] = $authData['email'];
                    if (!empty($authData['role'])) $updates['role'] = $authData['role'];
                    if (!empty($authData['department'])) $updates['department'] = $authData['department'];
                    if (!empty($authData['branch']) && \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch')) {
                        $updates['branch'] = $authData['branch'];
                    }

                    if (!empty($updates)) {
                        DB::table('employees')->where('emp_id', $empId)->update($updates);
                        $employee = DB::table('employees')->where('emp_id', $empId)->first();
                    }
                }
            } else {
                $authSyncStatus = 'cached';
                $syncNote = 'Central Auth service responded with error; displaying last known synced profile data.';
            }
        } catch (\Throwable $e) {
            // Graceful degradation when Auth service is temporarily unavailable (TS105)
            $authSyncStatus = 'cached';
            $syncNote = 'Central Auth service is temporarily unavailable; displaying last known cached profile data.';
        }

        $hasBranch = \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch');
        $branchValue = $hasBranch ? ($employee->branch ?? 'Main') : 'Main';
        $lastSynced = $employee->last_synced_at ?? $employee->last_seen_at ?? null;

        return response()->json([
            'success' => true,
            'data' => [
                'emp_id' => (int) $employee->emp_id,
                'employee_id' => (string) $employee->emp_id,
                'name' => trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? '')),
                'first_name' => $employee->first_name,
                'last_name' => $employee->last_name,
                'email' => $employee->email,
                'department' => $employee->department,
                'role' => $employee->role,
                'branch' => $branchValue,
                'phone_number' => $employee->phone_number ?? null,
                'is_active' => (bool) $employee->is_active,
                'last_synced_at' => $lastSynced,
                'auth_sync_status' => $authSyncStatus,
                'sync_note' => $syncNote,
                'auth_sourced_fields' => [
                    'emp_id' => ['label' => 'Employee ID', 'read_only' => true],
                    'name' => ['label' => 'Full Name', 'read_only' => true],
                    'first_name' => ['label' => 'First Name', 'read_only' => true],
                    'last_name' => ['label' => 'Last Name', 'read_only' => true],
                    'email' => ['label' => 'Email Address', 'read_only' => true],
                    'department' => ['label' => 'Department', 'read_only' => true],
                    'role' => ['label' => 'Role / Job Title', 'read_only' => true],
                    'branch' => ['label' => 'Branch Assignment', 'read_only' => true],
                ],
                'editable_fields' => [
                    'phone_number' => ['label' => 'Contact / Phone Number', 'read_only' => false],
                ],
            ],
            // Backwards-compatible root keys
            'emp_id' => $employee->emp_id,
            'name' => trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? '')),
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'email' => $employee->email,
            'department' => $employee->department,
            'role' => $employee->role,
            'branch' => $branchValue,
            'last_synced_at' => $lastSynced,
        ]);
    }

    /**
     * Update employee profile (TS105).
     * Rejects any attempt to modify central Auth-sourced fields server-side with 403 Forbidden.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        if (!$user || $user instanceof \App\Models\Client) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $empId = $user->emp_id ?? $user->id;
        $employee = DB::table('employees')->where('emp_id', $empId)->first();
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Employee not found'], 404);
        }

        $authSourcedFields = ['emp_id', 'employee_id', 'first_name', 'last_name', 'name', 'email', 'department', 'role', 'branch'];
        $attemptedAuthFields = [];

        foreach ($authSourcedFields as $field) {
            if ($request->has($field)) {
                $incomingVal = trim((string) $request->input($field));
                $currentVal = trim((string) ($employee->$field ?? ''));
                if ($incomingVal !== '' && $incomingVal !== $currentVal) {
                    $attemptedAuthFields[] = $field;
                }
            }
        }

        if (!empty($attemptedAuthFields)) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden: Central identity and role fields are synced from the central Auth system and are read-only.',
                'error_code' => 'AUTH_SOURCED_FIELD_READ_ONLY',
                'rejected_fields' => $attemptedAuthFields,
            ], 403);
        }

        // Allow update of local non-auth fields (e.g. phone_number)
        $updates = [];
        if ($request->has('phone_number') && \Illuminate\Support\Facades\Schema::hasColumn('employees', 'phone_number')) {
            $updates['phone_number'] = $request->input('phone_number');
        }

        if (!empty($updates)) {
            DB::table('employees')->where('emp_id', $empId)->update($updates);
        }

        return $this->employeeProfile($request);
    }

    /**
     * Search and filter employees by name, department, branch, or role (TS107).
     * Supports combinable filters, pagination, and strictly enforces Admin branch scope.
     */
    public function searchEmployees(Request $request)
    {
        $user = $request->user();
        $queryText = trim((string) ($request->query('q') ?? $request->query('name') ?? $request->query('search') ?? ''));
        $department = trim((string) $request->query('department', ''));
        $branch = trim((string) $request->query('branch', ''));
        $role = trim((string) $request->query('role', ''));
        $status = trim((string) $request->query('status', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));

        $isSqlite = DB::getDriverName() === 'sqlite';
        $concatNameRaw = $isSqlite ? "(first_name || ' ' || last_name)" : "CONCAT(first_name, ' ', last_name)";

        $query = DB::table('employees')
            ->select(
                'emp_id as id',
                'first_name',
                'last_name',
                DB::raw("{$concatNameRaw} as name"),
                'email',
                'role',
                'department',
                'is_active',
                'last_seen_at'
            )
            ->whereRaw('LOWER(COALESCE(role, "")) != ?', ['customer']);

        $hasBranch = \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch');
        $hasBranchId = \Illuminate\Support\Facades\Schema::hasColumn('employees', 'branch_id');
        $branchCol = $hasBranch ? 'branch' : ($hasBranchId ? 'branch_id' : null);

        if ($branchCol) {
            $query->addSelect("{$branchCol} as branch");
        }

        // 1. Partial Name/Email search
        if ($queryText !== '') {
            $query->where(function ($q) use ($queryText, $concatNameRaw) {
                $q->where('first_name', 'like', "%{$queryText}%")
                  ->orWhere('last_name', 'like', "%{$queryText}%")
                  ->orWhere(DB::raw($concatNameRaw), 'like', "%{$queryText}%")
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

        // 5. Branch scoping & filtering (TS107)
        if ($branchCol) {
            $isAdminScoped = $user && isset($user->role) && !in_array(strtolower(trim($user->role)), ['superadmin', 'super admin', 'system administrator'], true);
            $userBranch = $user->branch ?? $user->branch_id ?? null;

            if ($isAdminScoped && !empty($userBranch) && strtolower($userBranch) !== 'all') {
                // Strictly lock to Admin's authorized branch scope regardless of submitted filter
                $query->whereRaw('LOWER(' . $branchCol . ') = ?', [strtolower($userBranch)]);
            } elseif ($branch !== '' && strtolower($branch) !== 'all') {
                $query->whereRaw('LOWER(' . $branchCol . ') = ?', [strtolower($branch)]);
            }
        }

        $total = $query->count();
        $employees = $query
            ->orderByDesc('is_active')
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->forPage($page, $perPage)
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
            'total' => $total,
            'count' => $formatted->count(),
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => (int) ceil($total / max(1, $perPage)),
            'message' => $formatted->isEmpty() ? 'No employees match your search — try adjusting your filters.' : 'Employees retrieved successfully.',
        ]);
    }

    /**
     * Get dynamic filter options (departments, branches, roles) for Admin search (TS107).
     * Scoped to the Admin's permitted branch authority.
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
            $branches = $branchesQuery->select('slug', 'name', 'code')->get()->toArray();
        } else {
            $branches = [
                ['slug' => 'main', 'name' => 'Main Branch', 'code' => 'MAIN'],
                ['slug' => 'luzon', 'name' => 'Luzon Regional Center', 'code' => 'LUZ'],
                ['slug' => 'visayas', 'name' => 'Visayas Medical Hub', 'code' => 'VIS'],
                ['slug' => 'mindanao', 'name' => 'Mindanao Regional Branch', 'code' => 'MIN'],
            ];
        }

        // Scope branches to Admin's branch if non-superadmin
        if ($user && isset($user->role) && !in_array(strtolower(trim($user->role)), ['superadmin', 'super admin', 'system administrator'], true)) {
            $userBranch = $user->branch ?? $user->branch_id ?? null;
            if ($userBranch && strtolower($userBranch) !== 'all') {
                $branches = array_values(array_filter($branches, function ($b) use ($userBranch) {
                    $slug = is_array($b) ? ($b['slug'] ?? '') : ($b->slug ?? '');
                    return strtolower($slug) === strtolower($userBranch);
                }));
            }
        }

        return response()->json([
            'success' => true,
            'departments' => array_values(array_unique($departments)),
            'roles' => array_values(array_unique($roles)),
            'branches' => $branches,
        ]);
    }
}
