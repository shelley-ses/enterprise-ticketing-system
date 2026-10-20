<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EmployeeEligibilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
    }

    /**
     * Test: GET /api/tickets/{ticketId}/eligible-employees proxies to employee-service and returns categorized tracks (TS110).
     */
    public function test_eligible_employees_returns_categorized_tracks_and_reasons(): void
    {
        Http::fake([
            'http://employee-service:8000/api/tickets/101/eligible-employees*' => Http::response([
                'ticket_id' => 101,
                'ticket_number' => 'TCK-2026-000101',
                'track' => 'service',
                'branch' => 'Main',
                'eligible_count' => 1,
                'ineligible_count' => 1,
                'eligible_employees' => [
                    [
                        'id' => 2,
                        'name' => 'Mark Reyes',
                        'email' => 'employee@gmail.com',
                        'role' => 'service',
                        'department' => 'Service',
                        'branch' => 'Main',
                        'is_active' => true,
                        'eligible' => true,
                        'ineligibility_reason' => null,
                    ],
                ],
                'ineligible_employees' => [
                    [
                        'id' => 3,
                        'name' => 'John Dela Cruz',
                        'email' => 'tech1@example.com',
                        'role' => 'systems engineer',
                        'department' => 'IT',
                        'branch' => 'Main',
                        'is_active' => true,
                        'eligible' => false,
                        'ineligibility_reason' => 'Employee role (systems engineer) or department (IT) does not qualify for SERVICE category track.',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->getJson('/api/tickets/101/eligible-employees');

        $response->assertOk();
        $response->assertJson([
            'ticket_id' => 101,
            'track' => 'service',
            'eligible_count' => 1,
            'ineligible_count' => 1,
        ]);
        $this->assertTrue($response->json('eligible_employees.0.eligible'));
        $this->assertFalse($response->json('ineligible_employees.0.eligible'));
        $this->assertStringContainsString('SERVICE', $response->json('ineligible_employees.0.ineligibility_reason'));
    }

    /**
     * Test: Assigning an ineligible employee is rejected with 422 (TS110).
     */
    public function test_assigning_ineligible_employee_is_rejected(): void
    {
        Http::fake([
            'http://employee-service:8000/api/tickets/101/assign' => Http::response([
                'message' => 'Selected employee is not eligible for this ticket category track.',
                'code' => 'INELIGIBLE_EMPLOYEE',
                'track' => 'service',
                'reason' => 'Employee role (systems engineer) or department (IT) does not qualify for SERVICE category track.',
            ], 422),
        ]);

        $response = $this->postJson('/api/tickets/101/assign', [
            'employee_ids' => [3],
            'assigned_by_email' => 'cs@gmail.com',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'code' => 'INELIGIBLE_EMPLOYEE',
            'message' => 'Selected employee is not eligible for this ticket category track.',
        ]);
    }

    /**
     * Test: Admin override allows assignment of employee outside track with reason (TS110).
     */
    public function test_admin_can_override_track_eligibility_with_reason(): void
    {
        Http::fake([
            'http://employee-service:8000/api/tickets/101/assign' => Http::response([
                'success' => true,
                'message' => 'Ticket assigned successfully (track override applied).',
                'ticket_id' => 101,
            ], 200),
        ]);

        $response = $this->postJson('/api/tickets/101/assign', [
            'employee_ids' => [3],
            'assigned_by_email' => 'admin@gmail.com',
            'override_track' => true,
            'override_reason' => 'Emergency assignment: on-duty biomedical engineer is unavailable.',
        ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
        ]);
    }
}
