<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('employees')) {
            return;
        }

        Schema::table('employees', function (Blueprint $table) {
            if (!Schema::hasColumn('employees', 'position_level')) {
                $table->string('position_level', 50)->nullable()->default('Junior')->after('role');
            }
            if (!Schema::hasColumn('employees', 'technical_role')) {
                $table->string('technical_role', 100)->nullable()->after('position_level');
            }
        });

        try {
            Schema::table('employees', function (Blueprint $table) {
                $table->index('position_level', 'employees_pos_level_idx');
                $table->index('technical_role', 'employees_tech_role_idx');
            });
        } catch (\Throwable $e) {
            // Indexes may already exist on some environments
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('employees')) {
            return;
        }

        Schema::table('employees', function (Blueprint $table) {
            try {
                $table->dropIndex('employees_pos_level_idx');
                $table->dropIndex('employees_tech_role_idx');
            } catch (\Throwable $e) {}

            if (Schema::hasColumn('employees', 'position_level')) {
                $table->dropColumn('position_level');
            }
            if (Schema::hasColumn('employees', 'technical_role')) {
                $table->dropColumn('technical_role');
            }
        });
    }
};
