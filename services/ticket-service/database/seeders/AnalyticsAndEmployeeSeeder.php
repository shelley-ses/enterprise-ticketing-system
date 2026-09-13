<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;

class AnalyticsAndEmployeeSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();
        $dateStr = '2026-07-24';

        // 1. Seed 52 Employees in employees table
        $employeesData = [
            ['emp_id' => 1, 'first_name' => 'Ava', 'last_name' => 'Santos', 'email' => 'cs@gmail.com', 'role' => 'customer service', 'department' => 'Customer Support'],
            ['emp_id' => 2, 'first_name' => 'Mark', 'last_name' => 'Reyes', 'email' => 'employee@gmail.com', 'role' => 'service engineer', 'department' => 'Service'],
            ['emp_id' => 3, 'first_name' => 'John', 'last_name' => 'Dela Cruz', 'email' => 'tech1@example.com', 'role' => 'service engineer', 'department' => 'IT Support'],
            ['emp_id' => 4, 'first_name' => 'Bernadette', 'last_name' => 'Gonzaga', 'email' => 'slosinada@gmail.com', 'role' => 'service engineer', 'department' => 'Service'],
            ['emp_id' => 1004, 'first_name' => 'Sarah', 'last_name' => 'Jenkins', 'email' => 's.jenkins@hospital.com', 'role' => 'Technician', 'department' => 'Biomedical Engineering'],
            ['emp_id' => 1012, 'first_name' => 'Marcus', 'last_name' => 'Vance', 'email' => 'm.vance@hospital.com', 'role' => 'Specialist', 'department' => 'IT Support'],
            ['emp_id' => 1008, 'first_name' => 'Elena', 'last_name' => 'Rostova', 'email' => 'e.rostova@hospital.com', 'role' => 'Engineer', 'department' => 'Radiology Maintenance'],
            ['emp_id' => 1019, 'first_name' => 'David', 'last_name' => 'Chen', 'email' => 'd.chen@hospital.com', 'role' => 'Analyst', 'department' => 'Network Operations'],
            ['emp_id' => 1025, 'first_name' => 'Amira', 'last_name' => 'Hassan', 'email' => 'a.hassan@hospital.com', 'role' => 'Technician', 'department' => 'Facilities & Equipment'],
        ];

        // Generate additional 43 employees to reach 52 total employee records
        $names = [
            ['Alexander', 'Wright', 'IT Support', 'Specialist'],
            ['Beatrice', 'Kim', 'Biomedical Engineering', 'Technician'],
            ['Carlos', 'Mendoza', 'Service', 'Senior Engineer'],
            ['Diana', 'Prince', 'Radiology Maintenance', 'Engineer'],
            ['Ethan', 'Hunt', 'Network Operations', 'Analyst'],
            ['Fiona', 'Gallagher', 'Customer Support', 'Support Specialist'],
            ['Gabriel', 'Silva', 'Facilities & Equipment', 'Technician'],
            ['Hannah', 'Abbott', 'IT Support', 'Specialist'],
            ['Ian', 'Malcolm', 'Biomedical Engineering', 'Engineer'],
            ['Julia', 'Roberts', 'Service', 'Engineer'],
            ['Kevin', 'Bacon', 'Customer Support', 'Specialist'],
            ['Laura', 'Croft', 'Network Operations', 'Analyst'],
            ['Michael', 'Scott', 'IT Support', 'Lead Specialist'],
            ['Nina', 'Dobrev', 'Radiology Maintenance', 'Technician'],
            ['Oliver', 'Queen', 'Service', 'Senior Engineer'],
            ['Penelope', 'Cruz', 'Biomedical Engineering', 'Analyst'],
            ['Quentin', 'Tarantino', 'Facilities & Equipment', 'Technician'],
            ['Rachel', 'Green', 'Customer Support', 'Support Specialist'],
            ['Steven', 'Strange', 'Radiology Maintenance', 'Lead Engineer'],
            ['Tina', 'Fey', 'IT Support', 'Specialist'],
            ['Ulysses', 'Grant', 'Network Operations', 'Engineer'],
            ['Victor', 'Stone', 'Biomedical Engineering', 'Technician'],
            ['Wanda', 'Maximoff', 'Service', 'Senior Engineer'],
            ['Xavier', 'Charles', 'IT Support', 'Lead Analyst'],
            ['Yara', 'Shahidi', 'Customer Support', 'Support Representative'],
            ['Zachary', 'Levi', 'Facilities & Equipment', 'Technician'],
            ['Arthur', 'Pendelton', 'Service', 'Engineer'],
            ['Bianca', 'Belair', 'Biomedical Engineering', 'Technician'],
            ['Christopher', 'Nolan', 'Network Operations', 'Analyst'],
            ['Daphne', 'Bridgerton', 'Customer Support', 'Support Specialist'],
            ['Edward', 'Elric', 'IT Support', 'Technician'],
            ['Freya', 'Allan', 'Radiology Maintenance', 'Engineer'],
            ['George', 'Russell', 'Service', 'Engineer'],
            ['Heidi', 'Klum', 'Biomedical Engineering', 'Technician'],
            ['Isaaq', 'Newton', 'Network Operations', 'Analyst'],
            ['Jasmine', 'Tookes', 'Customer Support', 'Support Specialist'],
            ['Karl', 'Urban', 'Facilities & Equipment', 'Engineer'],
            ['Lily', 'Collins', 'IT Support', 'Specialist'],
            ['Mason', 'Mount', 'Service', 'Senior Engineer'],
            ['Nora', 'Jones', 'Radiology Maintenance', 'Technician'],
            ['Oscar', 'Isaac', 'Biomedical Engineering', 'Engineer'],
            ['Paige', 'VanZant', 'Customer Support', 'Specialist'],
            ['Quinn', 'Fabray', 'Network Operations', 'Analyst'],
        ];

        $startId = 1026;
        foreach ($names as $idx => $n) {
            $empId = $startId + $idx;
            $employeesData[] = [
                'emp_id' => $empId,
                'first_name' => $n[0],
                'last_name' => $n[1],
                'email' => strtolower($n[0] . '.' . $n[1] . '@hospital.com'),
                'role' => $n[3],
                'department' => $n[2],
            ];
        }

        $passwordHash = Hash::make('12345678');
        foreach ($employeesData as $emp) {
            DB::table('employees')->upsert([
                [
                    'emp_id' => $emp['emp_id'],
                    'first_name' => $emp['first_name'],
                    'last_name' => $emp['last_name'],
                    'email' => $emp['email'],
                    'role' => strtolower($emp['role']),
                    'department' => $emp['department'],
                    'is_active' => true,
                    'password_hash' => $passwordHash,
                ]
            ], ['emp_id'], ['first_name', 'last_name', 'email', 'role', 'department', 'is_active', 'password_hash']);
        }

        // 2. Seed analytics_sla_metrics
        DB::table('analytics_sla_metrics')->truncate();
        DB::table('analytics_sla_metrics')->insert([
            ['department_name' => 'Service', 'total_tickets' => 185, 'total_resolved' => 172, 'sla_met_count' => 161, 'sla_breached_count' => 11, 'compliance_percentage' => 93.60, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['department_name' => 'IT Support', 'total_tickets' => 240, 'total_resolved' => 225, 'sla_met_count' => 208, 'sla_breached_count' => 17, 'compliance_percentage' => 92.44, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['department_name' => 'Biomedical Engineering', 'total_tickets' => 165, 'total_resolved' => 150, 'sla_met_count' => 138, 'sla_breached_count' => 12, 'compliance_percentage' => 92.00, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['department_name' => 'Network Operations', 'total_tickets' => 130, 'total_resolved' => 118, 'sla_met_count' => 106, 'sla_breached_count' => 12, 'compliance_percentage' => 89.83, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['department_name' => 'Facilities & Equipment', 'total_tickets' => 110, 'total_resolved' => 98, 'sla_met_count' => 87, 'sla_breached_count' => 11, 'compliance_percentage' => 88.78, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['department_name' => 'Customer Support', 'total_tickets' => 142, 'total_resolved' => 130, 'sla_met_count' => 115, 'sla_breached_count' => 15, 'compliance_percentage' => 88.46, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['department_name' => 'Radiology Maintenance', 'total_tickets' => 115, 'total_resolved' => 102, 'sla_met_count' => 88, 'sla_breached_count' => 14, 'compliance_percentage' => 86.27, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['department_name' => 'Engineer', 'total_tickets' => 198, 'total_resolved' => 180, 'sla_met_count' => 155, 'sla_breached_count' => 25, 'compliance_percentage' => 86.11, 'metric_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // 3. Seed analytics_employee_performances for all 52 employees
        DB::table('analytics_employee_performances')->truncate();
        
        $perfData = [];

        // Featured top employees from query prompt
        $featured = [
            ['emp_id' => 1004, 'name' => 'Sarah Jenkins', 'dept' => 'Biomedical Engineering', 'role' => 'Technician', 'active' => 3, 'resolved' => 48, 'resp' => 4.12, 'res' => 28.45],
            ['emp_id' => 1012, 'name' => 'Marcus Vance', 'dept' => 'IT Support', 'role' => 'Specialist', 'active' => 5, 'resolved' => 54, 'resp' => 5.30, 'res' => 31.20],
            ['emp_id' => 1008, 'name' => 'Elena Rostova', 'dept' => 'Radiology Maintenance', 'role' => 'Engineer', 'active' => 2, 'resolved' => 36, 'resp' => 6.15, 'res' => 35.80],
            ['emp_id' => 1019, 'name' => 'David Chen', 'dept' => 'Network Operations', 'role' => 'Analyst', 'active' => 4, 'resolved' => 42, 'resp' => 7.80, 'res' => 41.15],
            ['emp_id' => 1025, 'name' => 'Amira Hassan', 'dept' => 'Facilities & Equipment', 'role' => 'Technician', 'active' => 3, 'resolved' => 39, 'resp' => 8.10, 'res' => 43.50],
        ];

        foreach ($featured as $f) {
            $perfData[] = [
                'emp_id' => $f['emp_id'],
                'employee_name' => $f['name'],
                'department' => $f['dept'],
                'role' => $f['role'],
                'active_tickets_count' => $f['active'],
                'resolved_tickets_count' => $f['resolved'],
                'avg_response_time_minutes' => $f['resp'],
                'avg_resolution_time_minutes' => $f['res'],
                'snapshot_date' => $dateStr,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Add remaining employees
        foreach ($employeesData as $emp) {
            if (in_array($emp['emp_id'], [1004, 1012, 1008, 1019, 1025])) continue;
            
            $activeCount = rand(1, 6);
            $resolvedCount = rand(15, 60);
            $respTime = round(rand(400, 1500) / 100, 2);
            $resTime = round(rand(2500, 8000) / 100, 2);

            $perfData[] = [
                'emp_id' => $emp['emp_id'],
                'employee_name' => $emp['first_name'] . ' ' . $emp['last_name'],
                'department' => $emp['department'],
                'role' => $emp['role'],
                'active_tickets_count' => $activeCount,
                'resolved_tickets_count' => $resolvedCount,
                'avg_response_time_minutes' => $respTime,
                'avg_resolution_time_minutes' => $resTime,
                'snapshot_date' => $dateStr,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('analytics_employee_performances')->insert($perfData);

        // 4. Seed analytics_equipment_reports
        DB::table('analytics_equipment_reports')->truncate();
        DB::table('analytics_equipment_reports')->insert([
            ['category_name' => 'Biomedical Equipment', 'machine_id' => 1, 'total_machines' => 145, 'total_tickets_count' => 452, 'active_tickets_count' => 68, 'active_ticket_percentage' => 15.04, 'snapshot_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['category_name' => 'ICU Equipment', 'machine_id' => 2, 'total_machines' => 98, 'total_tickets_count' => 310, 'active_tickets_count' => 52, 'active_ticket_percentage' => 16.77, 'snapshot_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['category_name' => 'Respiratory Equipment', 'machine_id' => 3, 'total_machines' => 76, 'total_tickets_count' => 245, 'active_tickets_count' => 38, 'active_ticket_percentage' => 15.51, 'snapshot_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['category_name' => 'Diagnostic Imaging', 'machine_id' => 4, 'total_machines' => 54, 'total_tickets_count' => 189, 'active_tickets_count' => 29, 'active_ticket_percentage' => 15.34, 'snapshot_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
            ['category_name' => 'Network Infrastructure', 'machine_id' => 5, 'total_machines' => 112, 'total_tickets_count' => 215, 'active_tickets_count' => 18, 'active_ticket_percentage' => 8.37, 'snapshot_date' => $dateStr, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }
}
