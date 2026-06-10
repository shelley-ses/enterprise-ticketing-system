<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class WorkLogSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        DB::table('work_logs')->upsert([
            [
                'employee_id' => 1,
                'ticket_id' => null,
                'task_description' => 'Reviewed and processed incoming service requests from clients.',
                'hours_spent' => 3.50,
                'log_date' => $now->copy()->subDays(2)->toDateString(),
                'status' => 'approved',
                'created_at' => $now->copy()->subDays(2),
                'updated_at' => $now->copy()->subDays(1),
            ],
            [
                'employee_id' => 1,
                'ticket_id' => null,
                'task_description' => 'Assigned tickets to service engineers based on workload and expertise.',
                'hours_spent' => 2.00,
                'log_date' => $now->copy()->subDays(2)->toDateString(),
                'status' => 'approved',
                'created_at' => $now->copy()->subDays(2),
                'updated_at' => $now->copy()->subDays(1),
            ],
            [
                'employee_id' => 1,
                'ticket_id' => null,
                'task_description' => 'Followed up on pending tickets with clients.',
                'hours_spent' => 1.25,
                'log_date' => $now->copy()->subDays(1)->toDateString(),
                'status' => 'approved',
                'created_at' => $now->copy()->subDays(1),
                'updated_at' => $now->copy()->subDays(1),
            ],
            [
                'employee_id' => 1,
                'ticket_id' => null,
                'task_description' => 'Updated ticket statuses and resolutions in the system.',
                'hours_spent' => 1.75,
                'log_date' => $now->copy()->subDays(1)->toDateString(),
                'status' => 'pending',
                'created_at' => $now->copy()->subDays(1),
                'updated_at' => $now->copy()->subDays(1),
            ],
            [
                'employee_id' => 1,
                'ticket_id' => null,
                'task_description' => 'Prepared end-of-day report for customer service queue.',
                'hours_spent' => 2.00,
                'log_date' => $now->copy()->toDateString(),
                'status' => 'pending',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'employee_id' => 2,
                'ticket_id' => null,
                'task_description' => 'Performed on-site diagnostic check for equipment issue.',
                'hours_spent' => 4.00,
                'log_date' => $now->copy()->subDays(3)->toDateString(),
                'status' => 'approved',
                'created_at' => $now->copy()->subDays(3),
                'updated_at' => $now->copy()->subDays(2),
            ],
            [
                'employee_id' => 2,
                'ticket_id' => null,
                'task_description' => 'Replaced faulty part in patient monitoring system.',
                'hours_spent' => 2.50,
                'log_date' => $now->copy()->subDays(2)->toDateString(),
                'status' => 'approved',
                'created_at' => $now->copy()->subDays(2),
                'updated_at' => $now->copy()->subDays(1),
            ],
            [
                'employee_id' => 2,
                'ticket_id' => null,
                'task_description' => 'Calibrated MRI scanner per maintenance schedule.',
                'hours_spent' => 3.00,
                'log_date' => $now->copy()->subDays(1)->toDateString(),
                'status' => 'pending',
                'created_at' => $now->copy()->subDays(1),
                'updated_at' => $now->copy()->subDays(1),
            ],
        ], ['id'], ['employee_id', 'ticket_id', 'task_description', 'hours_spent', 'log_date', 'status', 'updated_at']);
    }
}
