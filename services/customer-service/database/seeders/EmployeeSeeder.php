<?php

namespace Database\Seeders;

use App\Models\Employee;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class EmployeeSeeder extends Seeder
{
    public function run(): void
    {
        $employees = [
            [
                'email' => 'cs@gmail.com',
                'password_hash' => Hash::make('12345678'),
                'first_name' => 'Ava',
                'last_name' => 'Santos',
                'role' => 'customer service',
                'department' => 'Customer Service',
            ],
            [
                'email' => 'employee@gmail.com',
                'password_hash' => Hash::make('12345678'),
                'first_name' => 'Mark',
                'last_name' => 'Reyes',
                'role' => 'service',
                'department' => 'Service',
            ],
            [
                'email' => 'superadmin@gmail.com',
                'password_hash' => Hash::make('12345678'),
                'first_name' => 'Super',
                'last_name' => 'Admin',
                'role' => 'superadmin',
                'department' => 'Super Admin',
            ],
        ];

        foreach ($employees as $employee) {
            Employee::updateOrCreate(
                ['email' => $employee['email']],
                $employee
            );
        }
    }
}
