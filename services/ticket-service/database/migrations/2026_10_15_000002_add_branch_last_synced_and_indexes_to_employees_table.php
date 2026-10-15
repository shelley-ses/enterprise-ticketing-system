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
            if (!Schema::hasColumn('employees', 'branch')) {
                $table->string('branch')->nullable()->default('Main')->after('department');
            }
            if (!Schema::hasColumn('employees', 'last_synced_at')) {
                $table->timestamp('last_synced_at')->nullable()->after('last_seen_at');
            }
            if (!Schema::hasColumn('employees', 'phone_number')) {
                $table->string('phone_number')->nullable()->after('email');
            }
        });

        // Add indexes for search performance if they don't already exist
        try {
            Schema::table('employees', function (Blueprint $table) {
                $table->index(['first_name', 'last_name'], 'employees_name_idx');
                $table->index('department', 'employees_dept_idx');
                $table->index('role', 'employees_role_idx');
                $table->index('branch', 'employees_branch_idx');
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
                $table->dropIndex('employees_name_idx');
                $table->dropIndex('employees_dept_idx');
                $table->dropIndex('employees_role_idx');
                $table->dropIndex('employees_branch_idx');
            } catch (\Throwable $e) {}

            if (Schema::hasColumn('employees', 'branch')) {
                $table->dropColumn('branch');
            }
            if (Schema::hasColumn('employees', 'last_synced_at')) {
                $table->dropColumn('last_synced_at');
            }
            if (Schema::hasColumn('employees', 'phone_number')) {
                $table->dropColumn('phone_number');
            }
        });
    }
};
