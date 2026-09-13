<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class TotalTicketsSeeder extends Seeder
{
    public function run(): void
    {
        $currentCount = DB::table('tickets')->count();
        $targetTotal = 275;
        $needed = $targetTotal - $currentCount;

        $clients = DB::table('clients')->where('id', '!=', 3)->pluck('id')->toArray();
        if (empty($clients)) {
            $clients = [1];
        }

        $employees = DB::table('employees')
            ->whereNotIn('role', ['cs', 'Customer Service'])
            ->whereNotIn('department', ['Customer Service'])
            ->pluck('emp_id')
            ->toArray();
        $machines = DB::table('machines')->pluck('machine_ID')->toArray();
        $problemCategories = DB::table('problem_categories')->pluck('problem_category_ID')->toArray();
        $ticketTypes = DB::table('ticket_types')->pluck('ticket_type_ID')->toArray();
        $ticketPriorities = DB::table('ticket_priorities')->pluck('priority_ID')->toArray();
        $ticketStatuses = [1, 2, 3, 4, 5, 6, 7, 8]; // Open, In Progress, Resolved, Closed, Escalated, Pending Eval, Pending, Reopened

        $titles = [
            'System Diagnostic Self-Test Failure',
            'Network Connectivity Module Offline',
            'Power Supply Voltage Fluctuation Warning',
            'Routine PM Service & Safety Inspection',
            'Firmware Update & Security Patch Application',
            'Display Screen Touch Control Unresponsive',
            'Sensor Calibration Drift Exceeds Tolerance',
            'Cooling Fan Noise & Temperature Elevation',
            'Battery Backup Degradation Alert',
            'Data Sync Delay to Analytics Portal',
            'Emergency Stop Button Inspection Required',
            'Cable Connector Harness Wear & Tear',
            'Hydraulic Pressure Seal Replacement',
            'Optical Sensor Debris & Cleaning Required',
            'Configuration Reset After Power Outage',
        ];

        $now = Carbon::now();

        if ($needed > 0) {
            for ($i = 0; $i < $needed; $i++) {
                $clientId = $clients[array_rand($clients)];
                $machineId = $machines[array_rand($machines)];
                $probCatId = $problemCategories[array_rand($problemCategories)];
                $typeId = $ticketTypes[array_rand($ticketTypes)];
                $priorityId = $ticketPriorities[array_rand($ticketPriorities)];
                $statusId = $ticketStatuses[array_rand($ticketStatuses)];
                $empId = (rand(0, 10) > 2 && !empty($employees)) ? $employees[array_rand($employees)] : null;
                $title = $titles[array_rand($titles)] . " #" . ($i + 1);

                $daysAgo = rand(1, 120);
                $createdAt = $now->copy()->subDays($daysAgo)->subMinutes(rand(0, 1440));
                $updatedAt = $createdAt->copy()->addHours(rand(1, 48));

                $resolvedAt = in_array($statusId, [3, 4]) ? $updatedAt : null;
                $closedAt = ($statusId == 4) ? $updatedAt : null;

                $ticketId = DB::table('tickets')->insertGetId([
                    'machine_ID' => $machineId,
                    'problem_category_ID' => $probCatId,
                    'created_by' => $clientId,
                    'assigned_to' => $empId,
                    'ticket_type_ID' => $typeId,
                    'is_internal' => ($typeId == 1) ? 1 : 0,
                    'priority_ID' => $priorityId,
                    'ticket_status_ID' => $statusId,
                    'sla_ID' => ($priorityId == 4) ? 2 : 1,
                    'title' => $title,
                    'description' => "Automated system issue reported for equipment maintenance. Inspection and resolution logged.",
                    'resolved_at' => $resolvedAt,
                    'closed_at' => $closedAt,
                    'created_at' => $createdAt,
                    'updated_at' => $updatedAt,
                ]);

                if ($empId) {
                    $assignmentStatus = in_array($statusId, [2, 3, 4]) ? 'accepted' : 'pending';
                    DB::table('ticket_assignments')->insert([
                        'ticket_ID' => $ticketId,
                        'employee_ID' => $empId,
                        'assigned_by' => $empId,
                        'assignment_status' => $assignmentStatus,
                        'assigned_at' => $createdAt,
                        'completed_at' => in_array($statusId, [3, 4]) ? $resolvedAt : null,
                        'created_at' => $createdAt,
                        'updated_at' => $updatedAt,
                    ]);
                }
            }
        }

        // Sync missing ticket_assignments for any existing tickets with assigned_to set
        $unassignedInTable = DB::table('tickets as t')
            ->whereNotNull('t.assigned_to')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('ticket_assignments as ta')
                    ->whereColumn('ta.ticket_ID', 't.ticket_ID');
            })
            ->get();

        foreach ($unassignedInTable as $t) {
            $assignmentStatus = in_array($t->ticket_status_ID, [2, 3, 4]) ? 'accepted' : 'pending';
            DB::table('ticket_assignments')->insert([
                'ticket_ID' => $t->ticket_ID,
                'employee_ID' => $t->assigned_to,
                'assigned_by' => $t->assigned_to,
                'assignment_status' => $assignmentStatus,
                'assigned_at' => $t->created_at,
                'completed_at' => in_array($t->ticket_status_ID, [3, 4]) ? $t->resolved_at : null,
                'created_at' => $t->created_at,
                'updated_at' => $t->updated_at,
            ]);
        }
    }
}
