<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Update tickets table foreign keys
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropForeign('tickets_created_by_foreign');
            $table->dropForeign('tickets_assigned_to_foreign');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->foreign('created_by')->references('id')->on('clients');
            $table->foreign('assigned_to')->references('emp_id')->on('employees')->nullOnDelete();
        });

        // 2. Update ticket_assignments table foreign keys
        Schema::table('ticket_assignments', function (Blueprint $table) {
            $table->dropForeign('ticket_assignments_employee_id_foreign');
            $table->dropForeign('ticket_assignments_assigned_by_foreign');
        });

        Schema::table('ticket_assignments', function (Blueprint $table) {
            $table->foreign('employee_ID')->references('emp_id')->on('employees')->cascadeOnDelete();
            $table->foreign('assigned_by')->references('emp_id')->on('employees')->cascadeOnDelete();
        });

        // 3. Update ticket_audit_logs table foreign keys
        Schema::table('ticket_audit_logs', function (Blueprint $table) {
            $table->dropForeign('ticket_audit_logs_action_by_id_foreign');
        });

        Schema::table('ticket_audit_logs', function (Blueprint $table) {
            $table->foreign('action_by_ID')->references('emp_id')->on('employees')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        // Rollback ticket_audit_logs table foreign keys
        Schema::table('ticket_audit_logs', function (Blueprint $table) {
            $table->dropForeign('ticket_audit_logs_action_by_id_foreign');
        });

        Schema::table('ticket_audit_logs', function (Blueprint $table) {
            $table->foreign('action_by_ID')->references('id')->on('users');
        });

        // Rollback ticket_assignments table foreign keys
        Schema::table('ticket_assignments', function (Blueprint $table) {
            $table->dropForeign('ticket_assignments_employee_id_foreign');
            $table->dropForeign('ticket_assignments_assigned_by_foreign');
        });

        Schema::table('ticket_assignments', function (Blueprint $table) {
            $table->foreign('employee_ID')->references('id')->on('users');
            $table->foreign('assigned_by')->references('id')->on('users');
        });

        // Rollback tickets table foreign keys
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropForeign('tickets_created_by_foreign');
            $table->dropForeign('tickets_assigned_to_foreign');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->foreign('created_by')->references('id')->on('users');
            $table->foreign('assigned_to')->references('id')->on('users')->nullOnDelete();
        });
    }
};
