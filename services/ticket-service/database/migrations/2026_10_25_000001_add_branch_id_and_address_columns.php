<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('employees')) {
            Schema::table('employees', function (Blueprint $table) {
                if (!Schema::hasColumn('employees', 'branch_id')) {
                    $table->unsignedBigInteger('branch_id')->nullable()->after('branch')->index();
                }
            });
        }

        if (Schema::hasTable('branches')) {
            Schema::table('branches', function (Blueprint $table) {
                if (!Schema::hasColumn('branches', 'address')) {
                    $table->string('address', 500)->nullable()->after('region');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('employees')) {
            Schema::table('employees', function (Blueprint $table) {
                if (Schema::hasColumn('employees', 'branch_id')) {
                    $table->dropColumn('branch_id');
                }
            });
        }

        if (Schema::hasTable('branches')) {
            Schema::table('branches', function (Blueprint $table) {
                if (Schema::hasColumn('branches', 'address')) {
                    $table->dropColumn('address');
                }
            });
        }
    }
};
