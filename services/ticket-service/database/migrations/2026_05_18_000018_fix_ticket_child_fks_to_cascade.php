<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ticket_assignments')) {
            try {
                DB::statement('ALTER TABLE ticket_assignments DROP FOREIGN KEY ticket_assignments_ticket_id_foreign');
            } catch (\Throwable $e) {
               
            }

            Schema::table('ticket_assignments', function (Blueprint $table) {
                $table->foreign('ticket_ID')
                    ->references('ticket_ID')
                    ->on('tickets')
                    ->cascadeOnDelete();
            });
        }

        if (Schema::hasTable('ticket_audit_logs')) {
            try {
                DB::statement('ALTER TABLE ticket_audit_logs DROP FOREIGN KEY ticket_audit_logs_ticket_id_foreign');
            } catch (\Throwable $e) {
                // Ignore if the constraint name differs in an existing database.
            }

            Schema::table('ticket_audit_logs', function (Blueprint $table) {
                $table->foreign('ticket_ID')
                    ->references('ticket_ID')
                    ->on('tickets')
                    ->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ticket_assignments')) {
            try {
                DB::statement('ALTER TABLE ticket_assignments DROP FOREIGN KEY ticket_assignments_ticket_id_foreign');
            } catch (\Throwable $e) {
            }

            Schema::table('ticket_assignments', function (Blueprint $table) {
                $table->foreign('ticket_ID')->references('ticket_ID')->on('tickets');
            });
        }

        if (Schema::hasTable('ticket_audit_logs')) {
            try {
                DB::statement('ALTER TABLE ticket_audit_logs DROP FOREIGN KEY ticket_audit_logs_ticket_id_foreign');
            } catch (\Throwable $e) {
            }

            Schema::table('ticket_audit_logs', function (Blueprint $table) {
                $table->foreign('ticket_ID')->references('ticket_ID')->on('tickets');
            });
        }
    }
};
