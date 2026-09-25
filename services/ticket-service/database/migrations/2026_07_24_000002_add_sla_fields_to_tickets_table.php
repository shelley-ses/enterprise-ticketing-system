<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tickets')) {
            Schema::table('tickets', function (Blueprint $table) {
                if (!Schema::hasColumn('tickets', 'sla_rule_id')) {
                    $table->unsignedBigInteger('sla_rule_id')->nullable()->after('sla_ID');
                    $table->foreign('sla_rule_id')->references('id')->on('sla_rules')->nullOnDelete();
                }
                if (!Schema::hasColumn('tickets', 'response_due_at')) {
                    $table->dateTime('response_due_at')->nullable()->after('sla_rule_id');
                }
                if (!Schema::hasColumn('tickets', 'resolution_due_at')) {
                    $table->dateTime('resolution_due_at')->nullable()->after('response_due_at');
                }
                if (!Schema::hasColumn('tickets', 'first_response_at')) {
                    $table->dateTime('first_response_at')->nullable()->after('resolution_due_at');
                }
                if (!Schema::hasColumn('tickets', 'response_sla_status')) {
                    $table->string('response_sla_status')->nullable()->after('first_response_at');
                }
                if (!Schema::hasColumn('tickets', 'resolution_sla_status')) {
                    $table->string('resolution_sla_status')->nullable()->after('response_sla_status');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('tickets')) {
            Schema::table('tickets', function (Blueprint $table) {
                $columnsToDrop = [];
                if (Schema::hasColumn('tickets', 'sla_rule_id')) {
                    $table->dropForeign(['sla_rule_id']);
                    $columnsToDrop[] = 'sla_rule_id';
                }
                if (Schema::hasColumn('tickets', 'response_due_at')) {
                    $columnsToDrop[] = 'response_due_at';
                }
                if (Schema::hasColumn('tickets', 'resolution_due_at')) {
                    $columnsToDrop[] = 'resolution_due_at';
                }
                if (Schema::hasColumn('tickets', 'first_response_at')) {
                    $columnsToDrop[] = 'first_response_at';
                }
                if (Schema::hasColumn('tickets', 'response_sla_status')) {
                    $columnsToDrop[] = 'response_sla_status';
                }
                if (Schema::hasColumn('tickets', 'resolution_sla_status')) {
                    $columnsToDrop[] = 'resolution_sla_status';
                }
                if (!empty($columnsToDrop)) {
                    $table->dropColumn($columnsToDrop);
                }
            });
        }
    }
};
