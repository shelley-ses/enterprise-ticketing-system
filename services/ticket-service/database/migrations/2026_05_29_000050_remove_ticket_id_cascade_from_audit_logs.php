<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_audit_logs', function (Blueprint $table) {
            $table->dropForeign('ticket_audit_logs_ticket_id_foreign');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_audit_logs', function (Blueprint $table) {
            $table->foreign('ticket_ID')->references('ticket_ID')->on('tickets')->cascadeOnDelete();
        });
    }
};
