<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TicketVolumeSnapshot;
use App\Models\EmployeePerformanceAnalytic;
use App\Models\EquipmentRiskAnalytic;
use App\Models\EscalationRiskSnapshot;
use App\Models\RootCauseAnalytic;
use App\Models\RecurringIssueAnalytic;

class PredictiveAnalyticsSeeder extends Seeder
{
    public function run(): void
    {
        // ── Ticket Volume Snapshots ───────────────────────────────────────────
        $volumeData = [
            [
                'period'          => 'Next 7 Days',
                'historical'      => [12, 15, 10, 18, 14, 20, 16],
                'predicted'       => [14, 17, 12, 21, 16, 23, 19],
                'upper_bound'     => [17, 21, 15, 25, 20, 27, 23],
                'lower_bound'     => [11, 13,  9, 17, 12, 19, 15],
                'predicted_total' => 122,
                'peak_label'      => 'Saturday',
            ],
            [
                'period'          => 'Next 30 Days',
                'historical'      => [45, 52, 48, 60],
                'predicted'       => [50, 58, 53, 66],
                'upper_bound'     => [58, 67, 62, 75],
                'lower_bound'     => [42, 49, 44, 57],
                'predicted_total' => 227,
                'peak_label'      => 'Week 4',
            ],
            [
                'period'          => 'Next Quarter',
                'historical'      => [180, 195, 210],
                'predicted'       => [198, 215, 232],
                'upper_bound'     => [218, 237, 255],
                'lower_bound'     => [178, 193, 209],
                'predicted_total' => 645,
                'peak_label'      => 'Month 3',
            ],
        ];

        foreach ($volumeData as $row) {
            TicketVolumeSnapshot::updateOrCreate(['period' => $row['period']], $row);
        }

        // ── Employee Performance ──────────────────────────────────────────────
        $employees = [
            ['Mark Reyes',       [28, 112, 340], [94, 92, 91], [12, 13, 12], 'up'],
            ['Ava Santos',       [35, 140, 420], [90, 88, 87], [10, 11, 10], 'up'],
            ['Jose Cruz',        [22,  95, 290], [96, 94, 93], [18, 19, 18], 'down'],
            ['Anna Lim',         [18,  78, 235], [88, 85, 84], [ 8,  9,  8], 'up'],
            ['Carlo Tan',        [31, 125, 380], [92, 90, 89], [14, 15, 14], 'down'],
            ['Maria Dela Cruz',  [14,  62, 190], [85, 82, 81], [22, 23, 22], 'up'],
        ];

        $periods = ['Next 7 Days', 'Next 30 Days', 'Next Quarter'];

        EmployeePerformanceAnalytic::truncate();
        foreach ($employees as [$name, $tickets, $sla, $resp, $trend]) {
            foreach ($periods as $i => $period) {
                EmployeePerformanceAnalytic::create([
                    'employee_name'     => $name,
                    'period'            => $period,
                    'ticket_count'      => $tickets[$i],
                    'sla_compliance'    => $sla[$i],
                    'avg_response_hours'=> $resp[$i],
                    'trend'             => $trend,
                ]);
            }
        }

        // ── Equipment Risk ────────────────────────────────────────────────────
        $equipment = [
            ['Printer HP LaserJet',    [18, 22, 28], [12, 18, 25], 'Critical'],
            ['Server Rack Dell',       [ 8, 12, 16], [ 6, 10, 14], 'Moderate'],
            ['Workstation Lenovo',     [12, 16, 20], [ 9, 14, 18], 'High'],
            ['Network Switch Cisco',   [ 5,  8, 11], [ 4,  7, 10], 'Low'],
            ['UPS APC',                [ 3,  5,  7], [ 2,  4,  6], 'Low'],
            ['Scanner Fujitsu',        [ 9, 13, 17], [ 7, 11, 15], 'Moderate'],
        ];

        EquipmentRiskAnalytic::truncate();
        foreach ($equipment as [$name, $fail, $tickets, $risk]) {
            foreach ($periods as $i => $period) {
                EquipmentRiskAnalytic::create([
                    'equipment_name'  => $name,
                    'period'          => $period,
                    'failure_rate_pct'=> $fail[$i],
                    'ticket_count'    => $tickets[$i],
                    'risk_level'      => $risk,
                ]);
            }
        }

        // ── Escalation Risk ───────────────────────────────────────────────────
        $escalation = [
            ['Next 7 Days',   45, 28, 15,  7, 22, '4.2 hrs'],
            ['Next 30 Days',  65, 38, 22, 12, 34, '5.8 hrs'],
            ['Next Quarter',  82, 52, 30, 18, 48, '6.1 hrs'],
        ];

        foreach ($escalation as [$period, $low, $med, $high, $crit, $total, $avg]) {
            EscalationRiskSnapshot::updateOrCreate(
                ['period' => $period],
                [
                    'low_count'           => $low,
                    'medium_count'        => $med,
                    'high_count'          => $high,
                    'critical_count'      => $crit,
                    'total_escalations'   => $total,
                    'avg_resolution_time' => $avg,
                ]
            );
        }

        // ── Root Cause Analytics ──────────────────────────────────────────────
        $rootCauses = [
            ['Next 7 Days',   'Network Config',   24,  38, 'up'],
            ['Next 7 Days',   'Hardware Failure',  18,  29, 'up'],
            ['Next 7 Days',   'Software Bug',      16,  25, 'down'],
            ['Next 7 Days',   'User Error',        14,  22, 'down'],
            ['Next 7 Days',   'Printer Issues',    12,  19, 'up'],
            ['Next 30 Days',  'Network Config',   26, 155, 'up'],
            ['Next 30 Days',  'Hardware Failure',  20, 120, 'up'],
            ['Next 30 Days',  'Software Bug',      17, 102, 'down'],
            ['Next 30 Days',  'User Error',        13,  78, 'down'],
            ['Next 30 Days',  'Printer Issues',    11,  66, 'up'],
            ['Next Quarter',  'Network Config',   27, 470, 'up'],
            ['Next Quarter',  'Hardware Failure',  21, 365, 'up'],
            ['Next Quarter',  'Software Bug',      16, 278, 'down'],
            ['Next Quarter',  'User Error',        12, 208, 'down'],
            ['Next Quarter',  'Printer Issues',    11, 191, 'up'],
        ];

        RootCauseAnalytic::truncate();
        foreach ($rootCauses as [$period, $cause, $pct, $count, $trend]) {
            RootCauseAnalytic::create([
                'cause_name'   => $cause,
                'period'       => $period,
                'percentage'   => $pct,
                'ticket_count' => $count,
                'trend'        => $trend,
            ]);
        }

        // ── Recurring Issue Analytics ─────────────────────────────────────────
        $recurring = [
            ['Next 7 Days',   'Network',   22,  12, 'High'],
            ['Next 7 Days',   'Hardware',  18,   8, 'Medium'],
            ['Next 7 Days',   'Software',  15,  -3, 'High'],
            ['Next 7 Days',   'Printer',   12,  15, 'Low'],
            ['Next 7 Days',   'Security',   8,   5, 'Critical'],
            ['Next 7 Days',   'Database',   6,  -2, 'Medium'],
            ['Next 30 Days',  'Network',   85,  12, 'High'],
            ['Next 30 Days',  'Hardware',  72,   8, 'Medium'],
            ['Next 30 Days',  'Software',  60,  -3, 'High'],
            ['Next 30 Days',  'Printer',   48,  15, 'Low'],
            ['Next 30 Days',  'Security',  32,   5, 'Critical'],
            ['Next 30 Days',  'Database',  24,  -2, 'Medium'],
            ['Next Quarter',  'Network',  260,  12, 'High'],
            ['Next Quarter',  'Hardware', 218,   8, 'Medium'],
            ['Next Quarter',  'Software', 185,  -3, 'High'],
            ['Next Quarter',  'Printer',  148,  15, 'Low'],
            ['Next Quarter',  'Security',  98,   5, 'Critical'],
            ['Next Quarter',  'Database',  72,  -2, 'Medium'],
        ];

        RecurringIssueAnalytic::truncate();
        foreach ($recurring as [$period, $category, $freq, $growth, $severity]) {
            RecurringIssueAnalytic::create([
                'category'   => $category,
                'period'     => $period,
                'frequency'  => $freq,
                'growth_pct' => $growth,
                'severity'   => $severity,
            ]);
        }
    }
}
