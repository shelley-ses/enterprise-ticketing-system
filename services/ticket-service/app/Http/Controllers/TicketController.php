<?php

namespace App\Http\Controllers;

use App\Exceptions\TicketLimitConfigurationUnavailableException;
use App\Exceptions\TicketLimitExceededException;
use App\Services\TicketCacheService;
use App\Services\TicketDashboardService;
use App\Services\TicketNotificationService;
use App\Services\TicketService;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    protected TicketService $ticketService;
    protected TicketDashboardService $dashboardService;
    protected TicketNotificationService $notificationService;
    protected TicketCacheService $cacheService;

    public function __construct(
        TicketService $ticketService,
        TicketDashboardService $dashboardService,
        TicketNotificationService $notificationService,
        TicketCacheService $cacheService
    ) {
        $this->ticketService = $ticketService;
        $this->dashboardService = $dashboardService;
        $this->notificationService = $notificationService;
        $this->cacheService = $cacheService;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE TICKET LIFECYCLE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get cached form options for ticket creation.
     */
    public function formOptions()
    {
        return response()->json($this->ticketService->getFormOptions());
    }

    /**
     * Store an external ticket created by a customer.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Only authenticated customers can create external tickets.'], 403);
        }

        $validated = $request->validate([
            'machine_ID' => ['required', 'integer', 'exists:machines,machine_ID'],
            'problem_category_ID' => ['required', 'integer', 'exists:problem_categories,problem_category_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'branch_id' => ['nullable', 'string', 'max:64', 'exists:branches,slug'],
            'title' => ['required', 'string', 'max:255', $this->ticketService->validateProperCasing()],
            'description' => ['required', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['integer'],
        ]);

        $deptId = (int) $request->input('department_id', 2);

        try {
            $result = $this->ticketService->createTicket($validated, $user, $deptId);
        } catch (TicketLimitExceededException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'MAX_OPEN_TICKETS_REACHED',
                'limit' => $e->limit,
                'open_ticket_count' => $e->openTicketCount,
            ], 422);
        } catch (TicketLimitConfigurationUnavailableException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'TICKET_LIMIT_CONFIGURATION_UNAVAILABLE',
            ], 503);
        }

        return response()->json($result, 201);
    }

    /**
     * Store an internal ticket created by an employee.
     */
    public function storeInternalTicket(Request $request)
    {
        $user = $request->user();
        if (!$user || $user instanceof \App\Models\Client) {
            return response()->json(['message' => 'Only employees can create internal tickets.'], 403);
        }

        $validated = $request->validate([
            'machine_ID' => ['required', 'integer', 'exists:machines,machine_ID'],
            'problem_category_ID' => ['required', 'integer', 'exists:problem_categories,problem_category_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'branch_id' => ['nullable', 'string', 'max:64', 'exists:branches,slug'],
            'title' => ['required', 'string', 'max:255', $this->ticketService->validateProperCasing()],
            'description' => ['required', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['integer'],
        ]);

        $deptId = $request->input('department_id') ? (int) $request->input('department_id') : null;

        try {
            $result = $this->ticketService->createInternalTicket($validated, $user, $deptId);
        } catch (TicketLimitExceededException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'MAX_OPEN_TICKETS_REACHED',
                'limit' => $e->limit,
                'open_ticket_count' => $e->openTicketCount,
            ], 422);
        } catch (TicketLimitConfigurationUnavailableException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'TICKET_LIMIT_CONFIGURATION_UNAVAILABLE',
            ], 503);
        }

        return response()->json($result, 201);
    }

    /**
     * View detailed ticket info.
     */
    public function show(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $isCustomer = ($user instanceof \App\Models\Client) || ($request->header('X-User-Role') === 'customer');

        $data = $this->ticketService->showTicket($ticketId, $user, $isCustomer);
        if (!$data) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        return response()->json($data);
    }

    /**
     * Update ticket details, status, or priority.
     */
    public function updateTicket(Request $request, int $ticketId)
    {
        $validated = $request->validate([
            'ticket_status_ID' => ['nullable', 'integer', 'exists:ticket_statuses,ticket_status_ID'],
            'priority_ID' => ['nullable', 'integer', 'exists:ticket_priorities,priority_ID'],
            'assigned_by_email' => ['nullable', 'email'],
            'proof_rejected' => ['nullable', 'boolean'],
            'rejection_reason' => ['nullable', 'string'],
            'title' => ['nullable', 'string', 'max:255', $this->ticketService->validateProperCasing()],
            'description' => ['nullable', 'string'],
            'problem_category_ID' => ['nullable', 'integer', 'exists:problem_categories,problem_category_ID'],
            'machine_ID' => ['nullable', 'integer', 'exists:machines,machine_ID'],
        ]);

        $user = $request->user();
        $result = $this->ticketService->updateTicket($ticketId, $validated, $user);

        return response()->json($result['data'], $result['status']);
    }

    /**
     * Discard an open, unassigned ticket.
     */
    public function destroy(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $result = $this->ticketService->destroyTicket($ticketId, $user);
        return response()->json($result['data'], $result['status']);
    }

    /**
     * Put ticket on hold.
     */
    public function holdTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $reason = $request->input('reason');
        $result = $this->ticketService->holdTicket($ticketId, $user, $reason);
        return response()->json($result['data'], $result['status']);
    }

    /**
     * Resume ticket from on hold.
     */
    public function resumeTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $result = $this->ticketService->resumeTicket($ticketId, $user);
        return response()->json($result['data'], $result['status']);
    }

    /**
     * Resolve ticket.
     */
    public function resolveTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $result = $this->ticketService->resolveTicket($ticketId, $user);
        return response()->json($result['data'], $result['status']);
    }

    /**
     * Close ticket.
     */
    public function closeTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $result = $this->ticketService->closeTicket($ticketId, $user);
        return response()->json($result['data'], $result['status']);
    }

    /**
     * Reopen ticket (routes automatically to In Progress CS-owned).
     */
    public function reopenTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $result = $this->ticketService->reopenTicket($ticketId, $user);
        return response()->json($result['data'], $result['status']);
    }

    /**
     * Cancel / Discard ticket.
     */
    public function cancelTicket(Request $request, int $ticketId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        $result = $this->ticketService->cancelTicket($ticketId, $user);
        return response()->json($result['data'], $result['status']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BACKWARD COMPATIBILITY BRIDGES
    // ─────────────────────────────────────────────────────────────────────────

    public function customerDashboard(Request $request)
    {
        return app(TicketDashboardController::class)->customerDashboard($request);
    }

    public function csDashboard(Request $request)
    {
        return app(TicketDashboardController::class)->csDashboard($request);
    }

    public function csIncoming(Request $request)
    {
        return app(TicketDashboardController::class)->csIncoming($request);
    }

    public function getNotifications(Request $request)
    {
        return app(TicketNotificationController::class)->getNotifications($request);
    }

    public function markNotificationsRead(Request $request)
    {
        return app(TicketNotificationController::class)->markNotificationsRead($request);
    }

    public function markNotificationRead(Request $request, int $id)
    {
        return app(TicketNotificationController::class)->markNotificationRead($request, $id);
    }

    public function getSuperAdminConfig(Request $request)
    {
        return app(SuperAdminConfigController::class)->getSuperAdminConfig($request);
    }

    public function createSuperAdminEquipment(Request $request)
    {
        return app(SuperAdminConfigController::class)->createSuperAdminEquipment($request);
    }

    public function updateSuperAdminEquipment(Request $request, int $id)
    {
        return app(SuperAdminConfigController::class)->updateSuperAdminEquipment($request, $id);
    }

    public function deleteSuperAdminEquipment(Request $request, int $id)
    {
        return app(SuperAdminConfigController::class)->deleteSuperAdminEquipment($request, $id);
    }

    public function createSuperAdminPriority(Request $request)
    {
        return app(SuperAdminConfigController::class)->createSuperAdminPriority($request);
    }

    public function updateSuperAdminPriority(Request $request, int $id)
    {
        return app(SuperAdminConfigController::class)->updateSuperAdminPriority($request, $id);
    }

    public function deleteSuperAdminPriority(Request $request, int $id)
    {
        return app(SuperAdminConfigController::class)->deleteSuperAdminPriority($request, $id);
    }

    public function getSuperAdminAuditLogs(Request $request)
    {
        return app(SuperAdminConfigController::class)->getSuperAdminAuditLogs($request);
    }

    public function getSuperAdminHistory(Request $request)
    {
        return app(SuperAdminConfigController::class)->getSuperAdminHistory($request);
    }
}