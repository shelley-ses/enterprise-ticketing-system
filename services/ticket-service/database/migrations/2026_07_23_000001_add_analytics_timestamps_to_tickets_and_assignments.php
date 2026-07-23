<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tickets') && !Schema::hasColumn('tickets', 'first_cs_response_at')) {
            Schema::table('tickets', function (Blueprint $table) {
                $table->dateTime('first_cs_response_at')->nullable()->after('assigned_to');
            });
        }

        if (Schema::hasTable('ticket_assignments') && !Schema::hasColumn('ticket_assignments', 'accepted_at')) {
            Schema::table('ticket_assignments', function (Blueprint $table) {
                $table->dateTime('accepted_at')->nullable()->after('assigned_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('tickets') && Schema::hasColumn('tickets', 'first_cs_response_at')) {
            Schema::table('tickets', function (Blueprint $table) {
                $table->dropColumn('first_cs_response_at');
            });
        }

        if (Schema::hasTable('ticket_assignments') && Schema::hasColumn('ticket_assignments', 'accepted_at')) {
            Schema::table('ticket_assignments', function (Blueprint $table) {
                $table->dropColumn('accepted_at');
            });
        }
    }
};
