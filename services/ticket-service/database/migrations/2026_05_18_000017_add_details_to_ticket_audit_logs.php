<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ticket_audit_logs') && !Schema::hasColumn('ticket_audit_logs', 'details')) {
            Schema::table('ticket_audit_logs', function (Blueprint $table) {
                $table->text('details')->nullable()->after('actor_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('ticket_audit_logs', 'details')) {
            Schema::table('ticket_audit_logs', function (Blueprint $table) {
                $table->dropColumn('details');
            });
        }
    }
};
