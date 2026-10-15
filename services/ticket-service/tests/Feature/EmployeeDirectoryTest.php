<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EmployeeDirectoryTest extends TestCase
{
    /**
     * Test: GET /api/employees/filter-options proxies to employee-service and returns valid choices.
     */
    public function test_employee_filter_options_returns_departments_roles_and_branches(): void
    {
        Http::fake([
            'http://employee-service:8000/api/employees/filter-options*' => Http::response([
                'departments' => ['Biomedical', 'IT', 'Service'],
                'roles' => ['technician', 'engineer', 'admin'],
                'branches' => [
                    ['slug' => 'main', 'name' => 'Main Branch', 'code' => 'MAIN'],
                    ['slug' => 'luzon', 'name' => 'Luzon Regional Center', 'code' => 'LUZ'],
                ],
            ], 200),
        ]);

        $response = $this->getJson('/api/employees/filter-options');

        $response->assertOk();
        $response->assertJsonStructure([
            'departments',
            'roles',
            'branches',
        ]);
        $this->assertEquals(['Biomedical', 'IT', 'Service'], $response->json('departments'));
    }

    /**
     * Test: GET /api/employees/search proxies search queries and returns structured results.
     */
    public function test_employee_search_returns_filtered_results(): void
    {
        Http::fake([
            'http://employee-service:8000/api/employees/search*' => Http::response([
                'success' => true,
                'data' => [
                    [
                        'id' => 10,
                        'name' => 'John Doe',
                        'first_name' => 'John',
                        'last_name' => 'Doe',
                        'email' => 'john.doe@example.com',
                        'role' => 'technician',
                        'department' => 'Service',
                        'branch' => 'Main',
                        'is_active' => true,
                        'status' => 'Active',
                    ],
                ],
                'total' => 1,
                'message' => 'Employees retrieved successfully.',
            ], 200),
        ]);

        $response = $this->getJson('/api/employees/search?name=John&department=Service&role=technician&status=active');

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'total' => 1,
        ]);
        $this->assertEquals('John Doe', $response->json('data.0.name'));
        $this->assertEquals('Active', $response->json('data.0.status'));
    }

    /**
     * Test: Empty search returns clear message.
     */
    public function test_employee_search_empty_state_returns_helpful_message(): void
    {
        Http::fake([
            'http://employee-service:8000/api/employees/search*' => Http::response([
                'success' => true,
                'data' => [],
                'total' => 0,
                'message' => 'No employees match your search — try adjusting your filters.',
            ], 200),
        ]);

        $response = $this->getJson('/api/employees/search?name=NonExistent');

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'total' => 0,
            'message' => 'No employees match your search — try adjusting your filters.',
        ]);
    }

    /**
     * Test: Service failure returns structured 503 error.
     */
    public function test_employee_search_handles_service_failure(): void
    {
        Http::fake([
            'http://employee-service:8000/api/employees/search*' => function () {
                throw new \Exception('Connection refused');
            },
        ]);

        $response = $this->getJson('/api/employees/search?name=Test');

        $response->assertStatus(503);
        $response->assertJson([
            'success' => false,
            'total' => 0,
        ]);
        $this->assertStringContainsString('Employee service unavailable', $response->json('message'));
    }
}
