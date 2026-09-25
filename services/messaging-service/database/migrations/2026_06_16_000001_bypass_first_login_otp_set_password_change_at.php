<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Bypass the first-login OTP flow for ALL existing users.
 *
 * The OTP-on-first-login feature has been disabled. This migration stamps
 * `password_change_at` with the current timestamp on every client credential
 * and every employee record that still has it as NULL so that those accounts
 * are no longer treated as "first login" by the application.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        // Clients — clients_credentials table
        DB::table('clients_credentials')
            ->whereNull('password_change_at')
            ->update(['password_change_at' => $now]);

        // Employees — employees table
        if (DB::getSchemaBuilder()->hasColumn('employees', 'password_change_at')) {
            DB::table('employees')
                ->whereNull('password_change_at')
                ->update(['password_change_at' => $now]);
        }
    }

    public function down(): void
    {
        // Cannot safely revert — we don't know which rows were originally NULL.
        // To re-enable first-login OTP, manually set password_change_at = NULL
        // on the desired rows.
    }
};
