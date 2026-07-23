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
    public function assignSlaToTicket(int $ticketId, int $departmentId, ?int $categoryId, string $priority, $createdAt = null)
    {
        $rule = $this->slaRepository->findMatchingRule($departmentId, $categoryId, $priority);

        if (!$rule) {
            return null;
        }

        $createdAtObj = $createdAt ? (is_string($createdAt) ? Carbon::parse($createdAt) : $createdAt) : now();

        $responseDueAt = $createdAtObj->copy()->addMinutes((int)$rule->response_time_limit);
        $resolutionDueAt = $createdAtObj->copy()->addMinutes((int)$rule->resolution_time_limit);

        DB::table('tickets')
            ->where('ticket_ID', $ticketId)
            ->update([
                'sla_rule_id' => $rule->id,
                'response_due_at' => $responseDueAt,
                'resolution_due_at' => $resolutionDueAt,
                'updated_at' => now(),
            ]);

        return [
            'sla_rule_id' => $rule->id,
            'response_due_at' => $responseDueAt->toDateTimeString(),
            'resolution_due_at' => $resolutionDueAt->toDateTimeString(),
            'response_time_limit' => $rule->response_time_limit,
            'resolution_time_limit' => $rule->resolution_time_limit,
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
