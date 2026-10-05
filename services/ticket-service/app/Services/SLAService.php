<?php

namespace App\Services;

use App\Repositories\SLARepositoryInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SLAService
{
    protected $slaRepository;

    public function __construct(SLARepositoryInterface $slaRepository)
    {
        $this->slaRepository = $slaRepository;
    }

    /**
     * Dynamically determine and assign matching SLA rule and deadlines to a newly created ticket.
     */
    public function assignSlaToTicket(int $ticketId, int $departmentId, ?int $categoryId, string $priority, $createdAt = null, ?string $defaultSlaPolicy = null, ?string $branchId = null)
    {
        $createdAtObj = $createdAt ? (is_string($createdAt) ? Carbon::parse($createdAt) : $createdAt) : now();

        // Branch-specific override takes precedence over every system-wide rule for that branch.
        // With no override the flow below falls back to the system-wide default.
        if ($branchId) {
            // 1. Branch Category SLA Policy (highest precedence for branch when category is present)
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
                    $responseDueAt = $createdAtObj->copy()->addMinutes($responseTimeLimit);
                    $resolutionDueAt = $createdAtObj->copy()->addMinutes($resolutionTimeLimit);

                    DB::table('tickets')
                        ->where('ticket_ID', $ticketId)
                        ->update([
                            'branch_id' => $branchId,
                            'branch_priority_override_id' => null,
                            'sla_rule_id' => null,
                            'sla_ID' => null,
                            'response_due_at' => $responseDueAt,
                            'resolution_due_at' => $resolutionDueAt,
                            'updated_at' => now(),
                        ]);

                    return [
                        'sla_rule_id' => null,
                        'sla_ID' => null,
                        'branch_sla_policy_id' => $branchCategorySla->id,
                        'response_due_at' => $responseDueAt->toDateTimeString(),
                        'resolution_due_at' => $resolutionDueAt->toDateTimeString(),
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
                $responseDueAt = $createdAtObj->copy()->addMinutes((int) $override->response_time_limit);
                $resolutionDueAt = $createdAtObj->copy()->addMinutes((int) $override->resolution_time_limit);

                DB::table('tickets')
                    ->where('ticket_ID', $ticketId)
                    ->update([
                        'branch_id' => $branchId,
                        'branch_priority_override_id' => $override->id,
                        'sla_rule_id' => null,
                        'sla_ID' => null,
                        'response_due_at' => $responseDueAt,
                        'resolution_due_at' => $resolutionDueAt,
                        'updated_at' => now(),
                    ]);

                return [
                    'sla_rule_id' => null,
                    'sla_ID' => null,
                    'branch_priority_override_id' => $override->id,
                    'response_due_at' => $responseDueAt->toDateTimeString(),
                    'resolution_due_at' => $resolutionDueAt->toDateTimeString(),
                    'response_time_limit' => (int) $override->response_time_limit,
                    'resolution_time_limit' => (int) $override->resolution_time_limit,
                    'is_fallback' => false,
                    'is_branch_override' => true,
                ];
            }
        }

        $rule = $this->slaRepository->findMatchingRule($departmentId, $categoryId, $priority);

        if ($rule) {
            // Category/priority/branch-specific rule matches: apply the matched rule directly
            $responseDueAt = $createdAtObj->copy()->addMinutes((int)$rule->response_time_limit);
            $resolutionDueAt = $createdAtObj->copy()->addMinutes((int)$rule->resolution_time_limit);

            DB::table('tickets')
                ->where('ticket_ID', $ticketId)
                ->update([
                    'sla_rule_id' => $rule->id,
                    'sla_ID' => null,
                    'response_due_at' => $responseDueAt,
                    'resolution_due_at' => $resolutionDueAt,
                    'updated_at' => now(),
                ]);

            return [
                'sla_rule_id' => $rule->id,
                'sla_ID' => null,
                'response_due_at' => $responseDueAt->toDateTimeString(),
                'resolution_due_at' => $resolutionDueAt->toDateTimeString(),
                'response_time_limit' => $rule->response_time_limit,
                'resolution_time_limit' => $rule->resolution_time_limit,
                'is_fallback' => false,
            ];
        }

        // Fallback logic: Default SLA policy is ONLY applied when NO category/priority/branch-specific SLA rule matches
        $policy = $defaultSlaPolicy ?? TicketConfigurationService::getDefaultsConfig()['slaPolicy'] ?? 'dynamic';
        return $this->applyDefaultSlaPolicy($ticketId, $policy, $createdAtObj);
    }

    /**
     * Apply default SLA policy fallback when no specific category/priority/branch rule matches.
     */
    public function applyDefaultSlaPolicy(int $ticketId, string $defaultSlaPolicy, Carbon $createdAtObj)
    {
        $slaRecord = null;
        $responseTimeLimit = null;
        $resolutionTimeLimit = null;
        $slaId = null;

        if ($defaultSlaPolicy !== 'dynamic' && !empty($defaultSlaPolicy)) {
            $slaRecord = DB::table('slas')
                ->where('is_active', true)
                ->where(function ($q) use ($defaultSlaPolicy) {
                    $q->where('sla_ID', $defaultSlaPolicy)
                      ->orWhereRaw('LOWER(sla_name) = ?', [strtolower(trim($defaultSlaPolicy))]);
                })
                ->first();
        }

        // If dynamic or specific SLA was not found, pick first active SLA in slas table
        if (!$slaRecord) {
            $slaRecord = DB::table('slas')->where('is_active', true)->orderBy('sla_ID')->first();
        }

        if ($slaRecord) {
            $slaId = $slaRecord->sla_ID;
            $responseTimeLimit = $slaRecord->response_time_minutes ?? 1440;
            $resolutionTimeLimit = $slaRecord->resolution_time_minutes ?? 2880;
        } else {
            // Absolute baseline fallback: 24h response, 48h resolution
            $responseTimeLimit = 1440;
            $resolutionTimeLimit = 2880;
        }

        $responseDueAt = $createdAtObj->copy()->addMinutes((int)$responseTimeLimit);
        $resolutionDueAt = $createdAtObj->copy()->addMinutes((int)$resolutionTimeLimit);

        DB::table('tickets')
            ->where('ticket_ID', $ticketId)
            ->update([
                'sla_ID' => $slaId,
                'sla_rule_id' => null,
                'response_due_at' => $responseDueAt,
                'resolution_due_at' => $resolutionDueAt,
                'updated_at' => now(),
            ]);

        return [
            'sla_ID' => $slaId,
            'sla_rule_id' => null,
            'response_due_at' => $responseDueAt->toDateTimeString(),
            'resolution_due_at' => $resolutionDueAt->toDateTimeString(),
            'response_time_limit' => $responseTimeLimit,
            'resolution_time_limit' => $resolutionTimeLimit,
            'is_fallback' => true,
        ];
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
     */
    public function recordResolution(int $ticketId, $timestamp = null)
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();
        if (!$ticket) {
            return null;
        }

        $resTime = $timestamp ? (is_string($timestamp) ? Carbon::parse($timestamp) : $timestamp) : now();
        $status = null;

        if ($ticket->resolution_due_at) {
            $dueAt = Carbon::parse($ticket->resolution_due_at);
            $status = $resTime->lte($dueAt) ? 'MET' : 'BREACHED';
        }

        DB::table('tickets')
            ->where('ticket_ID', $ticketId)
            ->update([
                'resolved_at' => $resTime,
                'resolution_sla_status' => $status,
                'updated_at' => now(),
            ]);

        return [
            'resolved_at' => $resTime->toDateTimeString(),
            'resolution_sla_status' => $status,
        ];
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
