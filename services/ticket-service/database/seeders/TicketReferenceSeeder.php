<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;

class TicketReferenceSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        DB::table('users')->insert([
            [
                'id' => 1,
                'name' => 'SBSI Demo Customer',
                'email' => 'customer@example.com',
                'email_verified_at' => $now,
                'password' => Hash::make('password'),
                'remember_token' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 2,
                'name' => 'SBSI Support Lead',
                'email' => 'support@example.com',
                'email_verified_at' => $now,
                'password' => Hash::make('password'),
                'remember_token' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('machine_categories')->insert([
            [
                'category_ID' => 1,
                'category_name' => 'Imaging Equipment',
                'description' => 'MRI, CT, and X-ray equipment used in clinical diagnostics.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'category_ID' => 2,
                'category_name' => 'Patient Monitoring',
                'description' => 'Vital sign and bedside monitoring devices.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('problem_categories')->insert([
            [
                'problem_category_ID' => 1,
                'category_name' => 'Machine Failure',
                'description' => 'The equipment will not power on or is not operating as expected.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'problem_category_ID' => 2,
                'category_name' => 'Calibration Required',
                'description' => 'The device needs calibration or accuracy verification.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('ticket_types')->insert([
            [
                'ticket_type_ID' => 1,
                'type_name' => 'Internal',
                'description' => 'Internal service ticket for staff-facing requests.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'ticket_type_ID' => 2,
                'type_name' => 'External',
                'description' => 'Customer-submitted support ticket.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('ticket_priorities')->insert([
            [
                'priority_ID' => 1,
                'priority_name' => 'Low',
                'color_code' => '#22c55e',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'priority_ID' => 2,
                'priority_name' => 'Medium',
                'color_code' => '#f59e0b',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'priority_ID' => 3,
                'priority_name' => 'High',
                'color_code' => '#ef4444',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'priority_ID' => 4,
                'priority_name' => 'Critical',
                'color_code' => '#7c2d12',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('ticket_statuses')->insert([
            [
                'ticket_status_ID' => 1,
                'status_name' => 'Open',
                'color_code' => '#f59e0b',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'ticket_status_ID' => 2,
                'status_name' => 'In Progress',
                'color_code' => '#2563eb',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('machines')->insert([
            [
                'machine_ID' => 1,
                'category_ID' => 1,
                'client_ID' => 1,
                'machine_name' => 'MRI 3T Scanner',
                'serial_number' => 'MRI-3T-B02',
                'model' => 'Magnetom Vida',
                'brand' => 'Siemens',
                'status' => 'active',
                'purchase_date' => $now->copy()->subYears(2),
                'last_maintenance_date' => $now->copy()->subDays(30),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'machine_ID' => 2,
                'category_ID' => 2,
                'client_ID' => 1,
                'machine_name' => 'Bedside Monitor',
                'serial_number' => 'MON-500-A11',
                'model' => 'VS-900',
                'brand' => 'Philips',
                'status' => 'active',
                'purchase_date' => $now->copy()->subYear(),
                'last_maintenance_date' => $now->copy()->subDays(14),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('slas')->insert([
            [
                'sla_ID' => 1,
                'sla_name' => 'Standard SLA',
                'description' => 'Standard response and resolution window.',
                'response_time_minutes' => 240,
                'resolution_time_minutes' => 1440,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'sla_ID' => 2,
                'sla_name' => 'Critical SLA',
                'description' => 'Fastest response for critical equipment failures.',
                'response_time_minutes' => 30,
                'resolution_time_minutes' => 240,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }
}