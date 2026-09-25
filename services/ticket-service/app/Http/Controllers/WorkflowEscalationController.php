<?php

namespace App\Http\Controllers;

use App\Models\WorkflowStatus;
use App\Models\EscalationRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkflowEscalationController extends Controller
{
    private function checkSuperAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        if (strtolower(str_replace(' ', '', $user->role ?? '')) !== 'superadmin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return null;
    }

    // ─── Workflow Statuses ───────────────────────────────────────────────────

    public function getWorkflowStatuses(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $statuses = WorkflowStatus::orderBy('order_position', 'asc')->get();
        return response()->json(['workflow_statuses' => $statuses]);
    }

    public function storeWorkflowStatus(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'bg_color' => 'nullable|string|max:50',
            'text_color' => 'nullable|string|max:50',
            'order_position' => 'nullable|integer|min:1',
        ]);

        if (empty($validated['order_position'])) {
            $maxOrder = WorkflowStatus::max('order_position') ?? 0;
            $validated['order_position'] = $maxOrder + 1;
        }

        $status = WorkflowStatus::create($validated);

        event(new \App\Events\TicketChanged(['type' => 'config']));

        return response()->json(['message' => 'Workflow status created successfully.', 'workflow_status' => $status], 201);
    }

    public function updateWorkflowStatus(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $status = WorkflowStatus::find($id);
        if (!$status) {
            return response()->json(['message' => 'Workflow status not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'bg_color' => 'nullable|string|max:50',
            'text_color' => 'nullable|string|max:50',
            'order_position' => 'nullable|integer|min:1',
        ]);

        $status->update($validated);

        event(new \App\Events\TicketChanged(['type' => 'config']));

        return response()->json(['message' => 'Workflow status updated successfully.', 'workflow_status' => $status]);
    }

    public function destroyWorkflowStatus(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $status = WorkflowStatus::find($id);
        if (!$status) {
            return response()->json(['message' => 'Workflow status not found'], 404);
        }

        $status->delete();

        event(new \App\Events\TicketChanged(['type' => 'config']));

        return response()->json(['message' => 'Workflow status deleted successfully.']);
    }

    // ─── Escalation Rules ───────────────────────────────────────────────────

    public function getEscalationRules(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $rules = EscalationRule::orderBy('id', 'asc')->get();
        return response()->json(['escalation_rules' => $rules]);
    }

    public function storeEscalationRule(Request $request)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_active' => 'nullable|boolean',
            'trigger' => 'required|string|max:255',
            'condition_text' => 'required|string|max:255',
            'condition_highlight' => 'nullable|string|max:255',
            'action' => 'required|string|max:255',
            'notify' => 'required|string|max:255',
        ]);

        $rule = EscalationRule::create($validated);

        event(new \App\Events\TicketChanged(['type' => 'config']));

        return response()->json(['message' => 'Escalation rule created successfully.', 'escalation_rule' => $rule], 201);
    }

    public function updateEscalationRule(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $rule = EscalationRule::find($id);
        if (!$rule) {
            return response()->json(['message' => 'Escalation rule not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_active' => 'nullable|boolean',
            'trigger' => 'required|string|max:255',
            'condition_text' => 'required|string|max:255',
            'condition_highlight' => 'nullable|string|max:255',
            'action' => 'required|string|max:255',
            'notify' => 'required|string|max:255',
        ]);

        $rule->update($validated);

        event(new \App\Events\TicketChanged(['type' => 'config']));

        return response()->json(['message' => 'Escalation rule updated successfully.', 'escalation_rule' => $rule]);
    }

    public function toggleEscalationRule(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $rule = EscalationRule::find($id);
        if (!$rule) {
            return response()->json(['message' => 'Escalation rule not found'], 404);
        }

        $rule->is_active = !$rule->is_active;
        $rule->save();

        event(new \App\Events\TicketChanged(['type' => 'config']));

        return response()->json(['message' => 'Escalation rule status updated successfully.', 'escalation_rule' => $rule]);
    }

    public function destroyEscalationRule(Request $request, int $id)
    {
        if ($err = $this->checkSuperAdmin($request)) {
            return $err;
        }

        $rule = EscalationRule::find($id);
        if (!$rule) {
            return response()->json(['message' => 'Escalation rule not found'], 404);
        }

        $rule->delete();

        event(new \App\Events\TicketChanged(['type' => 'config']));

        return response()->json(['message' => 'Escalation rule deleted successfully.']);
    }
}
