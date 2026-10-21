<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('reassignment_requests') && !Schema::hasColumn('reassignment_requests', 'deny_reason')) {
            Schema::table('reassignment_requests', function (Blueprint $table) {
                $table->text('deny_reason')->nullable()->after('reason');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('reassignment_requests') && Schema::hasColumn('reassignment_requests', 'deny_reason')) {
            Schema::table('reassignment_requests', function (Blueprint $table) {
                $table->dropColumn('deny_reason');
            });
        }
    }
};
