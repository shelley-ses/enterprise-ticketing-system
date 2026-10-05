<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Employee;
use App\Services\TicketConfigurationService;
use App\Services\TicketStateMachine;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TicketStateMachineTest extends TestCase
{
    use DatabaseTransactions;

    protected Employee $superAdmin;
    protected Employee $employee;
    protected Client $customer;
    protected TicketStateMachine $stateMachine;

    protected function setUp(): void
    {
        parent::setUp();

        $this->stateMachine = app(TicketStateMachine::class);

        // Ensure baseline statuses exist
        $statuses = [
            ['ticket_status_ID' => 1, 'status_name' => 'Open', 'color_code' => '#f59e0b'],
            ['ticket_status_ID' => 2, 'status_name' => 'In Progress', 'color_code' => '#2563eb'],
            ['ticket_status_ID' => 3, 'status_name' => 'Resolved', 'color_code' => '#16a34a'],
            ['ticket_status_ID' => 4, 'status_name' => 'Closed', 'color_code' => '#64748b'],
            ['ticket_status_ID' => 5, 'status_name' => 'Cancelled', 'color_code' => '#ef4444'],
            ['ticket_status_ID' => 7, 'status_name' => 'Pending', 'color_code' => '#8b5cf6'],
            ['ticket_status_ID' => 9, 'status_name' => 'Reopened', 'color_code' => '#ec4899'],
            ['ticket_status_ID' => 10, 'status_name' => 'Pending Assignment', 'color_code' => '#06b6d4'],
            ['ticket_status_ID' => 11, 'status_name' => 'On Hold', 'color_code' => '#f97316'],
            ['ticket_status_ID' => 12, 'status_name' => 'Pending Evaluation', 'color_code' => '#a855f7'],
        ];

        foreach ($statuses as $st) {
            DB::table('ticket_statuses')->updateOrInsert(
                ['ticket_status_ID' => $st['ticket_status_ID']],
                array_merge($st, ['created_at' => now(), 'updated_at' => now()])
            );
        }

        DB::table('ticket_priorities')->updateOrInsert(
            ['priority_ID' => 1],
            ['priority_name' => 'Low', 'color_code' => '#22c55e', 'created_at' => now(), 'updated_at' => now()]
        );

        DB::table('slas')->updateOrInsert(
            ['sla_ID' => 1],
            ['sla_name' => 'Standard SLA', 'response_time_minutes' => 240, 'resolution_time_minutes' => 1440, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]
        );

        DB::table('problem_categories')->updateOrInsert(
            ['problem_category_ID' => 1],
            ['category_name' => 'Hardware Issue', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]
        );

        DB::table('machines')->updateOrInsert(
            ['machine_ID' => 1],
            ['machine_name' => 'Test Machine', 'serial_number' => 'SN-TSM-001', 'created_at' => now(), 'updated_at' => now()]
        );

        $this->superAdmin = Employee::where('role', 'superadmin')->first()
            ?? Employee::create([
                'emp_id' => 88881,
                'first_name' => 'Super',
                'last_name' => 'Admin',
                'email' => 'superadmin_tsm@example.com',
                'role' => 'superadmin',
                'department' => 'Executive',
                'is_active' => true,
                'password_hash' => 'secret',
            ]);

        $this->employee = Employee::where('role', 'service')->first()
            ?? Employee::create([
                'emp_id' => 88882,
                'first_name' => 'Service',
                'last_name' => 'Engineer',
                'email' => 'engineer_tsm@example.com',
                'role' => 'service',
                'department' => 'Engineering',
                'is_active' => true,
                'password_hash' => 'secret',
            ]);

        $this->customer = Client::create([
            'client_name' => 'State Machine Client',
            'email' => 'client_tsm_' . uniqid() . '@example.com',
            'contact_number' => '1234567890',
            'address' => '123 State Machine Ave',
            'status' => true,
        ]);

        DB::table('employees')->updateOrInsert(
            ['emp_id' => $this->customer->id],
            [
                'first_name' => 'Client',
                'last_name' => 'User',
                'email' => $this->customer->email,
                'role' => 'client',
                'department' => 'Customer',
                'is_active' => 1,
                'password_hash' => 'secret',
            ]
        );
    }

    protected function createTestTicket(array $overrides = []): object
    {
        $id = DB::table('tickets')->insertGetId(array_merge([
            'title' => 'State Machine Unit Ticket',
            'description' => 'Testing state machine transitions and invariants.',
            'created_by' => $this->customer->id,
            'ticket_type_ID' => 2,
            'ticket_status_ID' => 1, // Open
            'priority_ID' => 1,
            'sla_ID' => 1,
            'problem_category_ID' => 1,
            'machine_ID' => 1,
            'in_progress_owner' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));

        return DB::table('tickets')->where('ticket_ID', $id)->first();
    }

    /**
     * Test 1: Canonical state derivation accurately maps database fields.
     */
    public function test_canonical_state_derivation()
    {
        $ticketOpen = $this->createTestTicket(['ticket_status_ID' => 1]);
        $this->assertEquals(TicketStateMachine::STATE_OPEN, $this->stateMachine->resolveState($ticketOpen));

        $ticketCS = $this->createTestTicket(['ticket_status_ID' => 2, 'in_progress_owner' => 'cs']);
        $this->assertEquals(TicketStateMachine::STATE_IN_PROGRESS_CS, $this->stateMachine->resolveState($ticketCS));

        $ticketEmp = $this->createTestTicket(['ticket_status_ID' => 2, 'in_progress_owner' => 'employee']);
        $this->assertEquals(TicketStateMachine::STATE_IN_PROGRESS_EMPLOYEE, $this->stateMachine->resolveState($ticketEmp));

        $ticketAssigned = $this->createTestTicket(['ticket_status_ID' => 10]);
        $this->assertEquals(TicketStateMachine::STATE_ASSIGNED, $this->stateMachine->resolveState($ticketAssigned));

        $ticketResolved = $this->createTestTicket(['ticket_status_ID' => 3]);
        $this->assertEquals(TicketStateMachine::STATE_RESOLVED, $this->stateMachine->resolveState($ticketResolved));

        $ticketClosed = $this->createTestTicket(['ticket_status_ID' => 4]);
        $this->assertEquals(TicketStateMachine::STATE_CLOSED, $this->stateMachine->resolveState($ticketClosed));

        $ticketCancelled = $this->createTestTicket(['ticket_status_ID' => 5]);
        $this->assertEquals(TicketStateMachine::STATE_CANCELLED, $this->stateMachine->resolveState($ticketCancelled));
    }

    /**
     * Test 2: Valid transition from Open to In Progress (CS-owned) succeeds.
     */
    public function test_valid_transition_open_to_in_progress_cs()
    {
        $ticket = $this->createTestTicket(['ticket_status_ID' => 1]);

        $res = $this->stateMachine->applyTransition(
            $ticket,
            TicketStateMachine::STATE_IN_PROGRESS_CS,
            [],
            ['id' => $this->superAdmin->emp_id, 'type' => 'employee']
        );

        $transitioned = $res['data']['ticket'];
        $this->assertEquals(2, $transitioned->ticket_status_ID);
        $this->assertEquals('cs', $transitioned->in_progress_owner);

        // Verify audit log
        $this->assertDatabaseHas('ticket_audit_logs', [
            'ticket_ID' => $ticket->ticket_ID,
            'action_type' => 'in_progress',
            'action_by_ID' => $this->superAdmin->emp_id,
        ]);
    }

    /**
     * Test 3: Rejection of invalid transitions with HTTP 422 and structured error.
     */
    public function test_rejection_of_invalid_transition()
    {
        $ticket = $this->createTestTicket(['ticket_status_ID' => 1]); // Open

        // Attempting Open -> Closed should be rejected (Open can only go to In Progress (CS) or Cancelled)
        $response = $this->actingAs($this->superAdmin, 'api')
            ->putJson("/api/tickets/{$ticket->ticket_ID}", [
                'ticket_status_ID' => 4, // Closed
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'code' => 'INVALID_TICKET_TRANSITION',
            'from_status' => TicketStateMachine::STATE_OPEN,
            'to_status' => TicketStateMachine::STATE_CLOSED,
        ]);
        $this->assertIsArray($response->json('allowed_statuses'));
    }

    /**
     * Test 4: Terminal status Cancelled rejects any further transition.
     */
    public function test_terminal_cancelled_status_rejects_further_transition()
    {
        $ticket = $this->createTestTicket(['ticket_status_ID' => 5]); // Cancelled

        $response = $this->actingAs($this->superAdmin, 'api')
            ->putJson("/api/tickets/{$ticket->ticket_ID}", [
                'ticket_status_ID' => 2,
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'code' => 'INVALID_TICKET_TRANSITION',
            'from_status' => TicketStateMachine::STATE_CANCELLED,
        ]);
    }

    /**
     * Test 5: Reopen within configured window succeeds and automatically transitions to In Progress (CS-owned).
     */
    public function test_reopen_within_window_transitions_to_in_progress_cs_owned()
    {
        TicketConfigurationService::clearWindowsCache();

        Http::fake([
            '*/api/ticket-configurations/windows' => Http::response([
                'reopenEnabled' => true,
                'reopenWindowDays' => 2,
            ], 200),
        ]);

        $ticket = $this->createTestTicket([
            'ticket_status_ID' => 4, // Closed
            'resolved_at' => now()->subHours(12),
            'closed_at' => now()->subHours(10),
            'assigned_to' => $this->employee->emp_id,
        ]);

        $response = $this->actingAs($this->superAdmin, 'api')
            ->postJson("/api/tickets/{$ticket->ticket_ID}/reopen", [
                'reason' => 'Customer still experiences the issue.',
            ]);

        $response->assertStatus(200);

        $ticket = DB::table('tickets')->where('ticket_ID', $ticket->ticket_ID)->first();
        // Crucial invariant: Reopened tickets MUST transition to In Progress (CS-owned)
        $this->assertEquals(2, $ticket->ticket_status_ID);
        $this->assertEquals('cs', $ticket->in_progress_owner);
        $this->assertNull($ticket->assigned_to);

        // Verify audit log recorded reopen
        $this->assertDatabaseHas('ticket_audit_logs', [
            'ticket_ID' => $ticket->ticket_ID,
            'action_type' => 'reopen',
        ]);
    }

    /**
     * Test 6: Reopen outside configured window is rejected with 422.
     */
    public function test_reopen_outside_window_is_rejected()
    {
        TicketConfigurationService::clearWindowsCache();

        Http::fake([
            '*/api/ticket-configurations/windows' => Http::response([
                'reopenEnabled' => true,
                'reopenWindowDays' => 2, // 48 hours
            ], 200),
        ]);

        $ticket = $this->createTestTicket([
            'ticket_status_ID' => 4, // Closed
            'resolved_at' => now()->subDays(5),
            'closed_at' => now()->subDays(4),
        ]);

        $response = $this->actingAs($this->superAdmin, 'api')
            ->postJson("/api/tickets/{$ticket->ticket_ID}/reopen", [
                'reason' => 'Too late reopen attempt',
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'code' => 'INVALID_TICKET_TRANSITION',
        ]);
        $this->assertStringContainsString('48 hours', $response->json('message'));
    }

    /**
     * Test 7: Reopen when reopen is disabled in configuration is rejected.
     */
    public function test_reopen_disabled_in_config_is_rejected()
    {
        TicketConfigurationService::clearWindowsCache();

        Http::fake([
            '*/api/ticket-configurations/windows' => Http::response([
                'reopenEnabled' => false,
                'reopenWindowDays' => 2,
            ], 200),
        ]);

        $ticket = $this->createTestTicket([
            'ticket_status_ID' => 4,
            'resolved_at' => now()->subHours(2),
            'closed_at' => now()->subHours(1),
        ]);

        $response = $this->actingAs($this->superAdmin, 'api')
            ->postJson("/api/tickets/{$ticket->ticket_ID}/reopen", [
                'reason' => 'Disabled reopen attempt',
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Reopening tickets is disabled by administrative operational policy', $response->json('message'));
    }

    /**
     * Test 8: Contextual Hold and Resume correctly preserves and restores ownership.
     */
    public function test_contextual_hold_and_resume_preserves_owner()
    {
        // 1. Employee-owned ticket placed on hold
        $ticketEmp = $this->createTestTicket([
            'ticket_status_ID' => 2,
            'in_progress_owner' => 'employee',
            'assigned_to' => $this->employee->emp_id,
        ]);

        $response = $this->actingAs($this->superAdmin, 'api')
            ->postJson("/api/tickets/{$ticketEmp->ticket_ID}/hold", [
                'reason' => 'Waiting for spare part',
            ]);
        $response->assertStatus(200);

        $ticketEmp = DB::table('tickets')->where('ticket_ID', $ticketEmp->ticket_ID)->first();
        $this->assertEquals(11, $ticketEmp->ticket_status_ID);
        $this->assertEquals('employee', $ticketEmp->previous_in_progress_owner);
        $this->assertNull($ticketEmp->in_progress_owner);

        // Resume ticket
        $resumeResponse = $this->actingAs($this->superAdmin, 'api')
            ->postJson("/api/tickets/{$ticketEmp->ticket_ID}/resume");
        $resumeResponse->assertStatus(200);

        $ticketEmp = DB::table('tickets')->where('ticket_ID', $ticketEmp->ticket_ID)->first();
        $this->assertEquals(2, $ticketEmp->ticket_status_ID);
        $this->assertEquals('employee', $ticketEmp->in_progress_owner);

        // 2. CS-owned ticket placed on hold
        $ticketCS = $this->createTestTicket([
            'ticket_status_ID' => 2,
            'in_progress_owner' => 'cs',
        ]);

        $this->actingAs($this->superAdmin, 'api')
            ->postJson("/api/tickets/{$ticketCS->ticket_ID}/hold");
        $ticketCS = DB::table('tickets')->where('ticket_ID', $ticketCS->ticket_ID)->first();
        $this->assertEquals(11, $ticketCS->ticket_status_ID);
        $this->assertEquals('cs', $ticketCS->previous_in_progress_owner);

        $this->actingAs($this->superAdmin, 'api')
            ->postJson("/api/tickets/{$ticketCS->ticket_ID}/resume");
        $ticketCS = DB::table('tickets')->where('ticket_ID', $ticketCS->ticket_ID)->first();
        $this->assertEquals(2, $ticketCS->ticket_status_ID);
        $this->assertEquals('cs', $ticketCS->in_progress_owner);
    }

    /**
     * Test 9: Single "In Progress" bucket invariant is preserved.
     */
    public function test_single_in_progress_bucket_invariant()
    {
        $ticketCS = $this->createTestTicket(['ticket_status_ID' => 2, 'in_progress_owner' => 'cs']);
        $ticketEmp = $this->createTestTicket(['ticket_status_ID' => 2, 'in_progress_owner' => 'employee']);

        // Database status ID MUST be exactly 2 for both
        $this->assertEquals(2, $ticketCS->ticket_status_ID);
        $this->assertEquals(2, $ticketEmp->ticket_status_ID);

        // Standard reporting queries grouping by ticket_status_ID will see them in the same bucket
        $count = DB::table('tickets')
            ->whereIn('ticket_ID', [$ticketCS->ticket_ID, $ticketEmp->ticket_ID])
            ->where('ticket_status_ID', 2)
            ->count();

        $this->assertEquals(2, $count);
    }
}
