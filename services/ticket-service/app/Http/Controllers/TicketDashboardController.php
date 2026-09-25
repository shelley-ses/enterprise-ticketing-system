<?php

namespace App\Http\Controllers;

use App\Services\TicketDashboardService;
use Illuminate\Http\Request;

class TicketDashboardController extends Controller
{
    protected TicketDashboardService $dashboardService;

    public function __construct(TicketDashboardService $dashboardService)
    {
        $this->dashboardService = $dashboardService;
    }

    public function customerDashboard(Request $request)
    {
        $createdBy = (int) ($request->query('created_by', 1));
        $limit = max(1, min((int) $request->query('limit', 5), 20));

        $data = $this->dashboardService->getCustomerDashboard($createdBy, $limit);
        return response()->json($data);
    }

    public function csDashboard(Request $request)
    {
        $limit = max(1, min((int) $request->query('limit', 10), 50));

        $data = $this->dashboardService->getCsDashboard($limit);
        return response()->json($data);
    }

    public function csIncoming(Request $request)
    {
        $perPage = max(1, min((int) $request->query('limit', 50), 200));
        $typeFilter = $request->query('type') ?? 'all';
        $page = (int) $request->query('page', 1);

        $data = $this->dashboardService->getCsIncoming($perPage, $typeFilter, $page);
        return response()->json($data);
    }
}
