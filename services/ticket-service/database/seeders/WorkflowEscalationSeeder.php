<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WorkflowEscalationSeeder extends Seeder
{
    public function run(): void
    {
        // Default Workflow Statuses
        $statuses = [
            ['id' => 1, 'name' => 'New', 'description' => 'Ticket has been submitted and is awaiting review', 'bg_color' => '#DBEAFE', 'text_color' => '#1D4ED8', 'order_position' => 1],
            ['id' => 2, 'name' => 'Assigned', 'description' => 'Ticket has been assigned to a technician', 'bg_color' => '#FFEDD5', 'text_color' => '#C2410C', 'order_position' => 2],
            ['id' => 3, 'name' => 'In Progress', 'description' => 'Technician is actively working on the ticket', 'bg_color' => '#FEE2E2', 'text_color' => '#B91C1C', 'order_position' => 3],
            ['id' => 4, 'name' => 'Pending Parts', 'description' => 'Waiting for replacement parts to arrive', 'bg_color' => '#F3E8FF', 'text_color' => '#7E22CE', 'order_position' => 4],
            ['id' => 5, 'name' => 'Resolved', 'description' => 'Issue has been resolved pending confirmation', 'bg_color' => '#DCFCE7', 'text_color' => '#15803D', 'order_position' => 5],
            ['id' => 6, 'name' => 'Closed', 'description' => 'Ticket has been closed and confirmed by the requester', 'bg_color' => '#F3F4F6', 'text_color' => '#4B5563', 'order_position' => 6],
        ];

        foreach ($statuses as $status) {
            DB::table('workflow_statuses')->updateOrInsert(
                ['id' => $status['id']],
                [
                    'name' => $status['name'],
                    'description' => $status['description'],
                    'bg_color' => $status['bg_color'],
                    'text_color' => $status['text_color'],
                    'order_position' => $status['order_position'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        // Default Escalation Rules
        $rules = [
            [
                'id' => 1,
                'name' => 'Response Deadline Escalation',
                'is_active' => true,
                'trigger' => 'Response deadline approaching',
                'condition_text' => 'No response within 30 minutes before deadline',
                'condition_highlight' => '30 minutes',
                'action' => 'Auto-escalate to Senior Engineer',
                'notify' => 'CS + Manager',
            ],
            [
                'id' => 2,
                'name' => 'Critical Priority Escalation',
                'is_active' => true,
                'trigger' => 'Critical ticket unresolved',
                'condition_text' => 'No resolution within 50% of SLA target',
                'condition_highlight' => '50%',
                'action' => 'Auto-escalate to Department Head',
                'notify' => 'CS + Manager + Department Head',
            ],
            [
                'id' => 3,
                'name' => 'SLA Breach Prevention',
                'is_active' => false,
                'trigger' => 'Resolution deadline approaching',
                'condition_text' => 'No resolution within 15 minutes before deadline',
                'condition_highlight' => '15 minutes',
                'action' => 'Auto-escalate to Senior Engineer',
                'notify' => 'CS + Manager',
            ],
            [
                'id' => 4,
                'name' => 'Customer Reopen Escalation',
                'is_active' => true,
                'trigger' => 'Ticket reopened by customer',
                'condition_text' => 'Same issue reopened within 7 days',
                'condition_highlight' => '7 days',
                'action' => 'Auto-assign to previous technician',
                'notify' => 'Previous Technician + Manager',
            ],
        ];

        foreach ($rules as $rule) {
            DB::table('escalation_rules')->updateOrInsert(
                ['id' => $rule['id']],
                [
                    'name' => $rule['name'],
                    'is_active' => $rule['is_active'],
                    'trigger' => $rule['trigger'],
                    'condition_text' => $rule['condition_text'],
                    'condition_highlight' => $rule['condition_highlight'],
                    'action' => $rule['action'],
                    'notify' => $rule['notify'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }
}
