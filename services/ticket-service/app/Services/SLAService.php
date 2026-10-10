<?php

namespace App\Services;

use App\Repositories\SLARepositoryInterface;
use App\Services\BranchPriorityService;
use App\Services\TicketConfigurationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SLAService
{
    /**
     * Reopen SLA calculation mode flag:
     * - 'reset': Start fresh resolution window from the moment of reopen (now() + rule resolution minutes).
     * - 'remaining': Continue remaining time based on previous deadline.
     */
    public const REOPEN_SLA_MODE_RESET = 'reset';
    public const REOPEN_SLA_MODE_REMAINING = 'remaining';
    public const REOPEN_SLA_MODE = self::REOPEN_SLA_MODE_RESET;

    protected $slaRepository;

    public function __construct(SLARepositoryInterface $slaRepository)
    {
        $this->slaRepository = $slaRepository;
    }

    /**
     * Shared helper to determine the department ID for SLA rule lookup.
     * Mirrors creation logic:
     * - Customer tickets (is_internal == 0) -> department 2 (Service).
     * - Internal tickets (is_internal == 1) -> department of the requester (requested_by), fallback 2.
     */
    public function resolveDepartmentForTicket($ticket): int
    {
        if (is_numeric($ticket)) {
            $ticket = DB::table('tickets')->where('ticket_ID', (int) $ticket)->first();
        }

        if (!$ticket) {
            return 2;
        }

        if (empty($ticket->is_internal)) {
            return 2;
        }

        if (!empty($ticket->requested_by)) {
            $deptName = DB::table('employees')->where('emp_id', $ticket->requested_by)->value('department');
            if (!empty($deptName)) {
                $deptId = DB::table('departments')->whereRaw('LOWER(name) = ?', [strtolower(trim($deptName))])->value('id');
                if (!empty($deptId)) {
                    return (int) $deptId;
                }
            }
        }

        return 2;
    }

    /**
     * Shared rule-resolution logic used by both initial assignment and recalculation:
     * 1. Branch Category SLA Policy (highest precedence for branch when category is matched)
     * 2. Branch Priority Override
     * 3. SLARule (department + category + priority)
     * 4. Default SLA Policy fallback
     */
    public function resolveSlaPolicy(
        int $departmentId,
        ?int $categoryId,
        string $priority,
        ?string $branchId = null,
        ?string $defaultSlaPolicy = null
    ): array {
        // 1. Branch Category SLA Policy & Branch Priority Override
        if ($branchId) {
            $categoryName = $categoryId
                ? DB::table('problem_categories')->where('problem_category_ID', $categoryId)->value('category_name')
                : null;

            if ($categoryId !== null || !empty($categoryName)) {
                $branchCategorySla = DB::table('branch_sla_policies')
                    ->where('branch_id', $branchId)
                    ->where(function ($q) use ($categoryId, $categoryName) {
                        if ($categoryId) {
                            $q->where('category_id', $categoryId);
                        }
                        if ($categoryName) {
                            $q->orWhereRaw('LOWER(category_name) = ?', [strtolower(trim($categoryName))]);
                        }
                    })
                    ->whereRaw('LOWER(priority) = ?', [strtolower(trim($priority))])
                    ->first();

                if ($branchCategorySla) {
                    $responseTimeLimit = (int) ($branchCategorySla->response_time_limit ?: 30);
                    $resolutionTimeLimit = (int) $branchCategorySla->resolution_time_limit;

                    return [
                        'sla_rule_id' => null,
                        'sla_ID' => null,
                        'branch_sla_policy_id' => $branchCategorySla->id,
                        'branch_priority_override_id' => null,
                        'response_time_limit' => $responseTimeLimit,
                        'resolution_time_limit' => $resolutionTimeLimit,
                        'is_fallback' => false,
                        'is_branch_override' => true,
                    ];
                }
            }

            // 2. Branch Priority Override
            $basePriorityId = DB::table('ticket_priorities')
                ->whereRaw('LOWER(priority_name) = ?', [strtolower(trim($priority))])
                ->value('priority_ID');
            $override = $basePriorityId
                ? app(BranchPriorityService::class)->resolveOverride($branchId, (int) $basePriorityId)
                : null;

            if ($override) {
                return [
                    'sla_rule_id' => null,
                    'sla_ID' => null,
                    'branch_sla_policy_id' => null,
                    'branch_priority_override_id' => $override->id,
                    'response_time_limit' => (int) $override->response_time_limit,
                    'resolution_time_limit' => (int) $override->resolution_time_limit,
                    'is_fallback' => false,
                    'is_branch_override' => true,
                ];
            }
        }

        // 3. System-wide SLA Rules (Department + Category + Priority)
        $rule = $this->slaRepository->findMatchingRule($departmentId, $categoryId, $priority);
        if ($rule) {
            return [
                'sla_rule_id' => $rule->id,
                'sla_ID' => null,
                'branch_sla_policy_id' => null,
                'branch_priority_override_id' => null,
                'response_time_limit' => (int) $rule->response_time_limit,
                'resolution_time_limit' => (int) $rule->resolution_time_limit,
                'is_fallback' => false,
                'is_branch_override' => false,
            ];
        }

        // 4. Default SLA Policy fallback
        $policy = $defaultSlaPolicy ?? TicketConfigurationService::getDefaultsConfig()['slaPolicy'] ?? 'dynamic';
        $slaRecord = null;
        if ($policy !== 'dynamic' && !empty($policy)) {
            $slaRecord = DB::table('slas')
                ->where('is_active', true)
                ->where(function ($q) use ($policy) {
                    $q->where('sla_ID', $policy)
                      ->orWhereRaw('LOWER(sla_name) = ?', [strtolower(trim($policy))]);
                })
                ->first();
        }

        if (!$slaRecord) {
            $slaRecord = DB::table('slas')->where('is_active', true)->orderBy('sla_ID')->first();
        }

        $slaId = $slaRecord ? $slaRecord->sla_ID : null;
        $responseTimeLimit = $slaRecord ? ($slaRecord->response_time_minutes ?? 1440) : 1440;
        $resolutionTimeLimit = $slaRecord ? ($slaRecord->resolution_time_minutes ?? 2880) : 2880;

        return [
            'sla_rule_id' => null,
            'sla_ID' => $slaId,
            'branch_sla_policy_id' => null,
            'branch_priority_override_id' => null,
            'response_time_limit' => (int) $responseTimeLimit,
            'resolution_time_limit' => (int) $resolutionTimeLimit,
            'is_fallback' => true,
            'is_branch_override' => false,
        ];
    }

    /**
     * Dynamically determine and assign matching SLA rule and deadlines to a newly created ticket.
     */
    public function assignSlaToTicket(
        int $ticketId,
        int $departmentId,
        ?int $categoryId,
        string $priority,
        $createdAt = null,
        ?string $defaultSlaPolicy = null,
        ?string $branchId = null
    ) {
        $createdAtObj = $createdAt ? (is_string($createdAt) ? Carbon::parse($createdAt) : $createdAt) : now();

        $resolved = $this->resolveSlaPolicy($departmentId, $categoryId, $priority, $branchId, $defaultSlaPolicy);

        $responseDueAt = $createdAtObj->copy()->addMinutes($resolved['response_time_limit']);
        $resolutionDueAt = $createdAtObj->copy()->addMinutes($resolved['resolution_time_limit']);

        $update = [
            'branch_id' => $branchId,
            'branch_priority_override_id' => $resolved['branch_priority_override_id'],
            'sla_rule_id' => $resolved['sla_rule_id'],
            'sla_ID' => $resolved['sla_ID'],
            'sla_started_at' => $createdAtObj,
            'sla_paused_at' => null,
            'sla_paused_total_seconds' => 0,
            'response_due_at' => $responseDueAt,
            'resolution_due_at' => $resolutionDueAt,
            'updated_at' => now(),
        ];

        DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

        $result = [
            'sla_rule_id' => $resolved['sla_rule_id'],
            'sla_ID' => $resolved['sla_ID'],
            'branch_sla_policy_id' => $resolved['branch_sla_policy_id'],
            'branch_priority_override_id' => $resolved['branch_priority_override_id'],
            'response_due_at' => $responseDueAt->toDateTimeString(),
            'resolution_due_at' => $resolutionDueAt->toDateTimeString(),
            'response_time_limit' => $resolved['response_time_limit'],
            'resolution_time_limit' => $resolved['resolution_time_limit'],
            'is_fallback' => $resolved['is_fallback'],
        ];

        if (!empty($resolved['is_branch_override'])) {
            $result['is_branch_override'] = true;
        }

        return $result;
    }

    /**
     * Pause the SLA clock for a ticket entering On Hold.
     * Sets sla_paused_at = now() if null.
     */
    public function pauseClock(int $ticketId): bool
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket || $ticket->sla_paused_at !== null) {
            return false;
        }

        DB::table('tickets')->where('ticket_ID', $ticketId)->update([
            'sla_paused_at' => now(),
            'updated_at' => now(),
        ]);

        return true;
    }

    /**
     * Resume the SLA clock for a ticket leaving On Hold.
     * In a transaction with lockForUpdate:
     * - Adds paused seconds to sla_paused_total_seconds.
     * - Shifts resolution_due_at (only if resolved_at is null) forward by that amount.
     * - Shifts response_due_at (only if first_response_at is null) forward by that amount.
     * - Clears sla_paused_at.
     * No-op if not paused.
     */
    public function resumeClock(int $ticketId): bool
    {
        return DB::transaction(function () use ($ticketId) {
            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->lockForUpdate()->first();
            if (!$ticket || empty($ticket->sla_paused_at)) {
                return false;
            }

            $pausedAt = Carbon::parse($ticket->sla_paused_at);
            $now = now();
            $pausedSeconds = max(0, $now->diffInSeconds($pausedAt));
            $totalPausedSeconds = (int) ($ticket->sla_paused_total_seconds ?? 0) + $pausedSeconds;

            $update = [
                'sla_paused_at' => null,
                'sla_paused_total_seconds' => $totalPausedSeconds,
                'updated_at' => $now,
            ];

            // Shift resolution_due_at forward by paused seconds only if not yet resolved
            if ($ticket->resolution_due_at && empty($ticket->resolved_at)) {
                $update['resolution_due_at'] = Carbon::parse($ticket->resolution_due_at)->addSeconds($pausedSeconds);
            }

            // Shift response_due_at forward by paused seconds only if first response not yet recorded
            if ($ticket->response_due_at && empty($ticket->first_response_at)) {
                $update['response_due_at'] = Carbon::parse($ticket->response_due_at)->addSeconds($pausedSeconds);
            }

            DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

            return true;
        });
    }

    /**
     * Recalculate SLA deadlines when category, priority, or branch changes.
     * Based on COALESCE(sla_started_at, created_at) + rule minutes + sla_paused_total_seconds.
     * Updates sla_ID and sla_rule_id to the newly resolved policy.
     * Returns old and new deadlines.
     */
    public function recalculateForReclassification(
        int $ticketId,
        ?int $newCategoryId = null,
        ?int $newPriorityId = null,
        ?string $branchId = null
    ): array {
        return DB::transaction(function () use ($ticketId, $newCategoryId, $newPriorityId, $branchId) {
            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->lockForUpdate()->first();
            if (!$ticket) {
                throw new \InvalidArgumentException("Ticket {$ticketId} not found");
            }

            $oldResponseDueAt = $ticket->response_due_at;
            $oldResolutionDueAt = $ticket->resolution_due_at;

            $categoryId = $newCategoryId !== null ? $newCategoryId : $ticket->problem_category_ID;
            $priorityId = $newPriorityId !== null ? $newPriorityId : $ticket->priority_ID;
            $branch = $branchId !== null ? $branchId : $ticket->branch_id;

            $priorityName = DB::table('ticket_priorities')->where('priority_ID', $priorityId)->value('priority_name') ?? 'Low';
            $departmentId = $this->resolveDepartmentForTicket($ticket);

            $resolvedPolicy = $this->resolveSlaPolicy($departmentId, $categoryId, $priorityName, $branch);

            $baseTime = $ticket->sla_started_at
                ? Carbon::parse($ticket->sla_started_at)
                : ($ticket->created_at ? Carbon::parse($ticket->created_at) : now());

            $pausedSeconds = (int) ($ticket->sla_paused_total_seconds ?? 0);

            $newResolutionDueAt = $baseTime->copy()
                ->addMinutes($resolvedPolicy['resolution_time_limit'])
                ->addSeconds($pausedSeconds);

            $update = [
                'problem_category_ID' => $categoryId,
                'priority_ID' => $priorityId,
                'branch_id' => $branch,
                'branch_priority_override_id' => $resolvedPolicy['branch_priority_override_id'] ?? null,
                'sla_rule_id' => $resolvedPolicy['sla_rule_id'] ?? null,
                'sla_ID' => $resolvedPolicy['sla_ID'] ?? null,
                'resolution_due_at' => $newResolutionDueAt,
                'updated_at' => now(),
            ];

            // Only update response_due_at if first_response_at is null
            $newResponseDueAt = $oldResponseDueAt;
            if (empty($ticket->first_response_at)) {
                $newResponseDueAt = $baseTime->copy()
                    ->addMinutes($resolvedPolicy['response_time_limit'])
                    ->addSeconds($pausedSeconds);
                $update['response_due_at'] = $newResponseDueAt;
            }

            // Update live resolution SLA status if not resolved
            if (empty($ticket->resolved_at)) {
                $now = now();
                $update['resolution_sla_status'] = $now->gt($newResolutionDueAt) ? 'BREACHED' : 'PENDING';
            }

            DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

            return [
                'ticket_ID' => $ticketId,
                'old_response_due_at' => $oldResponseDueAt,
                'new_response_due_at' => is_string($newResponseDueAt) ? $newResponseDueAt : ($newResponseDueAt ? $newResponseDueAt->toDateTimeString() : null),
                'old_resolution_due_at' => $oldResolutionDueAt,
                'new_resolution_due_at' => $newResolutionDueAt->toDateTimeString(),
                'resolved_policy' => $resolvedPolicy,
            ];
        });
    }

    /**
     * Recalculate SLA for reopened ticket:
     * - Clears resolved_at, closed_at.
     * - Sets resolution_sla_status = 'PENDING'.
     * - Sets sla_started_at = now() and sla_paused_total_seconds = 0 so subsequent reclassifications do not backdate deadlines.
     * - Sets resolution_due_at = now() + rule resolution minutes.
     * - Updates sla_ID and sla_rule_id to the newly resolved policy.
     */
    public function recalculateForReopen(int $ticketId): array
    {
        return DB::transaction(function () use ($ticketId) {
            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->lockForUpdate()->first();
            if (!$ticket) {
                throw new \InvalidArgumentException("Ticket {$ticketId} not found");
            }

            $priorityName = DB::table('ticket_priorities')->where('priority_ID', $ticket->priority_ID)->value('priority_name') ?? 'Low';
            $departmentId = $this->resolveDepartmentForTicket($ticket);

            $resolvedPolicy = $this->resolveSlaPolicy($departmentId, $ticket->problem_category_ID, $priorityName, $ticket->branch_id);

            $now = now();
            $newResolutionDueAt = $now->copy()->addMinutes($resolvedPolicy['resolution_time_limit']);

            $update = [
                'resolved_at' => null,
                'closed_at' => null,
                'resolution_sla_status' => 'PENDING',
                'sla_started_at' => $now,
                'sla_paused_at' => null,
                'sla_paused_total_seconds' => 0,
                'resolution_due_at' => $newResolutionDueAt,
                'sla_rule_id' => $resolvedPolicy['sla_rule_id'] ?? null,
                'sla_ID' => $resolvedPolicy['sla_ID'] ?? null,
                'branch_priority_override_id' => $resolvedPolicy['branch_priority_override_id'] ?? null,
                'updated_at' => $now,
            ];

            DB::table('tickets')->where('ticket_ID', $ticketId)->update($update);

            return [
                'ticket_ID' => $ticketId,
                'resolution_due_at' => $newResolutionDueAt->toDateTimeString(),
                'resolution_sla_status' => 'PENDING',
                'resolved_policy' => $resolvedPolicy,
            ];
        });
    }

    /**
     * Record first employee response timestamp and evaluate Response SLA status.
     */
    public function recordFirstResponse(int $ticketId, $timestamp = null)
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return null;
        }

        // If first response already recorded, retain original response timestamp & status
        if ($ticket->first_response_at) {
            return [
                'first_response_at' => $ticket->first_response_at,
                'response_sla_status' => $ticket->response_sla_status,
            ];
        }

        $respTime = $timestamp ? (is_string($timestamp) ? Carbon::parse($timestamp) : $timestamp) : now();
        $status = null;

        if ($ticket->response_due_at) {
            $dueAt = Carbon::parse($ticket->response_due_at);
            $status = $respTime->lte($dueAt) ? 'MET' : 'BREACHED';
        }

        DB::table('tickets')
            ->where('ticket_ID', $ticketId)
            ->update([
                'first_response_at' => $respTime,
                'response_sla_status' => $status,
                'updated_at' => now(),
            ]);

        return [
            'first_response_at' => $respTime->toDateTimeString(),
            'response_sla_status' => $status,
        ];
    }

    /**
     * Record resolution timestamp and evaluate Resolution SLA status.
     * Fix: Do not overwrite an existing MET/BREACHED result when a ticket goes Resolved -> Closed.
     */
    public function recordResolution(int $ticketId, $timestamp = null)
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return null;
        }

        // Retain existing evaluation if already evaluated
        if ($ticket->resolution_sla_status && in_array($ticket->resolution_sla_status, ['MET', 'BREACHED'], true)) {
            return [
                'resolved_at' => $ticket->resolved_at,
                'resolution_sla_status' => $ticket->resolution_sla_status,
            ];
        }

        $resTime = $timestamp ? (is_string($timestamp) ? Carbon::parse($timestamp) : $timestamp) : now();
        $status = null;

        if ($ticket->resolution_due_at) {
            $dueAt = Carbon::parse($ticket->resolution_due_at);
            $status = $resTime->lte($dueAt) ? 'MET' : 'BREACHED';
        }

        $finalResolvedAt = $ticket->resolved_at ?: $resTime;

        DB::table('tickets')
            ->where('ticket_ID', $ticketId)
            ->update([
                'resolved_at' => $finalResolvedAt,
                'resolution_sla_status' => $status,
                'updated_at' => now(),
            ]);

        return [
            'resolved_at' => is_string($finalResolvedAt) ? $finalResolvedAt : Carbon::parse($finalResolvedAt)->toDateTimeString(),
            'resolution_sla_status' => $status,
        ];
    }

    /**
     * Backward-compatible fallback applicator.
     */
    public function applyDefaultSlaPolicy(int $ticketId, string $defaultSlaPolicy, Carbon $createdAtObj)
    {
        return $this->assignSlaToTicket($ticketId, 2, null, 'Low', $createdAtObj, $defaultSlaPolicy);
    }

    /**
     * Evaluate live SLA status for reporting / display purposes.
     */
    public function evaluateSlaStatusForTicket($ticket)
    {
        if (!$ticket) {
            return null;
        }

        $now = now();

        // Response SLA status
        $responseStatus = $ticket->response_sla_status;
        if (!$responseStatus && $ticket->response_due_at) {
            if ($ticket->first_response_at) {
                $responseStatus = Carbon::parse($ticket->first_response_at)->lte(Carbon::parse($ticket->response_due_at)) ? 'MET' : 'BREACHED';
            } elseif ($now->gt(Carbon::parse($ticket->response_due_at))) {
                $responseStatus = 'BREACHED';
            } else {
                $responseStatus = 'PENDING';
            }
        }

        // Resolution SLA status
        $resolutionStatus = $ticket->resolution_sla_status;
        if (!$resolutionStatus && $ticket->resolution_due_at) {
            if ($ticket->resolved_at) {
                $resolutionStatus = Carbon::parse($ticket->resolved_at)->lte(Carbon::parse($ticket->resolution_due_at)) ? 'MET' : 'BREACHED';
            } elseif ($now->gt(Carbon::parse($ticket->resolution_due_at))) {
                $resolutionStatus = 'BREACHED';
            } else {
                $resolutionStatus = 'PENDING';
            }
        }

        return [
            'response_sla_status' => $responseStatus,
            'resolution_sla_status' => $resolutionStatus,
        ];
    }
}
