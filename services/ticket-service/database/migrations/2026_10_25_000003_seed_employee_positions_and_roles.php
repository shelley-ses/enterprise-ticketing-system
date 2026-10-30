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

        // Update key operational staff with realistic position levels and technical roles
        $updates = [
            // Service Department
            ['emp_id' => 1028, 'position_level' => 'Manager', 'technical_role' => 'Lead Service Engineer'],
            ['emp_id' => 2,    'position_level' => 'Lead',    'technical_role' => 'Biomedical Engineer'],
            ['emp_id' => 1004, 'position_level' => 'Senior',  'technical_role' => 'Biomedical Engineer'],
            ['emp_id' => 1008, 'position_level' => 'Senior',  'technical_role' => 'Hardware Specialist'],
            ['emp_id' => 1040, 'position_level' => 'Senior',  'technical_role' => 'Field Service Specialist'],
            ['emp_id' => 1048, 'position_level' => 'Senior',  'technical_role' => 'Biomedical Engineer'],
            ['emp_id' => 1064, 'position_level' => 'Senior',  'technical_role' => 'Hardware Specialist'],
            ['emp_id' => 1093, 'position_level' => 'Senior',  'technical_role' => 'Field Service Specialist'],
            ['emp_id' => 1095, 'position_level' => 'Mid',     'technical_role' => 'Service Technician'],
            ['emp_id' => 1097, 'position_level' => 'Mid',     'technical_role' => 'Biomedical Technician'],
            ['emp_id' => 4,    'position_level' => 'Mid',     'technical_role' => 'Service Technician'],
            ['emp_id' => 6,    'position_level' => 'Junior',  'technical_role' => 'Service Technician'],

            // IT Department
            ['emp_id' => 1038, 'position_level' => 'Manager', 'technical_role' => 'IT Systems Specialist'],
            ['emp_id' => 1049, 'position_level' => 'Lead',    'technical_role' => 'Systems Administrator'],
            ['emp_id' => 1012, 'position_level' => 'Senior',  'technical_role' => 'IT Support Specialist'],
            ['emp_id' => 1019, 'position_level' => 'Senior',  'technical_role' => 'Network Administrator'],
            ['emp_id' => 1026, 'position_level' => 'Senior',  'technical_role' => 'Systems Specialist'],
            ['emp_id' => 1030, 'position_level' => 'Senior',  'technical_role' => 'Network Administrator'],
            ['emp_id' => 1100, 'position_level' => 'Senior',  'technical_role' => 'Systems Specialist'],
            ['emp_id' => 3,    'position_level' => 'Mid',     'technical_role' => 'IT Support Specialist'],
            ['emp_id' => 1033, 'position_level' => 'Mid',     'technical_role' => 'IT Support Specialist'],
            ['emp_id' => 1045, 'position_level' => 'Mid',     'technical_role' => 'Software Specialist'],

            // Customer Service Department
            ['emp_id' => 1,    'position_level' => 'Manager', 'technical_role' => 'Customer Support Lead'],
            ['emp_id' => 1096, 'position_level' => 'Senior',  'technical_role' => 'Senior CS Specialist'],
            ['emp_id' => 1098, 'position_level' => 'Mid',     'technical_role' => 'CS Specialist'],
            ['emp_id' => 1099, 'position_level' => 'Junior',  'technical_role' => 'CS Associate'],
            ['emp_id' => 5,    'position_level' => 'Mid',     'technical_role' => 'CS Specialist'],
        ];

        foreach ($updates as $u) {
            DB::table('employees')
                ->where('emp_id', $u['emp_id'])
                ->update([
                    'position_level' => $u['position_level'],
                    'technical_role' => $u['technical_role'],
                ]);
        }
    }

    public function down(): void
    {
        // No-op rollback
    }
};
