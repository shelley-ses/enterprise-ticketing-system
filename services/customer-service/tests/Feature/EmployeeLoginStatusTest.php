<?php

namespace Tests\Feature;

use App\Events\EmployeeStatusChanged;
use App\Models\Employee;
use App\Services\AuthService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EmployeeLoginStatusTest extends TestCase
{
    public function test_employee_login_automatically_sets_status_to_active()
    {
        Event::fake([EmployeeStatusChanged::class]);

        $employee = Employee::updateOrCreate(
            ['email' => 'tech_test_active@example.com'],
            [
                'password_hash' => Hash::make('password123'),
                'first_name' => 'Active',
                'last_name' => 'Tech',
                'role' => 'technician',
                'department' => 'Service',
                'is_active' => false,
                'password_change_at' => now(),
            ]
        );

        $this->assertFalse((bool) $employee->fresh()->is_active);

        $authService = app(AuthService::class);
        $result = $authService->login('tech_test_active@example.com', 'password123', 'employee');

        $this->assertTrue($result['success']);
        $this->assertTrue((bool) $employee->fresh()->is_active);
        Event::assertDispatched(EmployeeStatusChanged::class);
    }
}
