<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('employees')) {
            return;
        }

        // 1. Ensure every department has at least one Senior or Manager
        $departmentElevations = [
            // Facilities & Equipment
            ['emp_id' => 1062, 'position_level' => 'Senior', 'technical_role' => 'Facilities Senior Specialist', 'is_active' => 1],
            // Operations
            ['emp_id' => 7,    'position_level' => 'Senior', 'technical_role' => 'Operations Senior Lead',       'is_active' => 1],
            // Finance
            ['emp_id' => 9,    'position_level' => 'Senior', 'technical_role' => 'Finance Senior Administrator', 'is_active' => 1],
        ];

        foreach ($departmentElevations as $e) {
            DB::table('employees')
                ->where('emp_id', $e['emp_id'])
                ->update([
                    'position_level' => $e['position_level'],
                    'technical_role' => $e['technical_role'],
                    'is_active'      => $e['is_active'],
                ]);
        }

        // 2. Activate all Managers, Leads, and Seniors across all departments
        DB::table('employees')
            ->whereIn('position_level', ['Manager', 'Lead', 'Senior'])
            ->update(['is_active' => 1]);

        // 3. Specifically verify Department Managers are active
        // Carlos Mendoza (Service Manager)
        DB::table('employees')->where('emp_id', 1028)->update(['is_active' => 1, 'position_level' => 'Manager']);
        // Michael Scott (IT Support Manager)
        DB::table('employees')->where('emp_id', 1038)->update(['is_active' => 1, 'position_level' => 'Manager']);
        // Ava Santos (Customer Support Manager)
        DB::table('employees')->where('emp_id', 1)->update(['is_active' => 1, 'position_level' => 'Manager']);
    }

    public function down(): void
    {
        // Non-destructive rollback
    }
};
