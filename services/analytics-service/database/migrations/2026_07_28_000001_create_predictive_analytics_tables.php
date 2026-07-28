<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create predictive analytics snapshot tables.
     */
    public function up(): void
    {
        // Ticket volume snapshots (historical + predicted per period)
        Schema::create('ticket_volume_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('period'); // 'Next 7 Days', 'Next 30 Days', 'Next Quarter'
            $table->json('historical');  // array of daily/weekly/monthly counts
            $table->json('predicted');
            $table->json('upper_bound');
            $table->json('lower_bound');
            $table->integer('predicted_total')->default(0);
            $table->string('peak_label')->nullable(); // e.g. 'Saturday', 'Week 4'
            $table->timestamps();
        });

        // Employee performance metrics
        Schema::create('employee_performance_analytics', function (Blueprint $table) {
            $table->id();
            $table->string('employee_name');
            $table->string('period');
            $table->integer('ticket_count')->default(0);
            $table->decimal('sla_compliance', 5, 2)->default(0); // percentage
            $table->decimal('avg_response_hours', 8, 2)->default(0);
            $table->enum('trend', ['up', 'down', 'stable'])->default('stable');
            $table->timestamps();
        });

        // Equipment risk analytics
        Schema::create('equipment_risk_analytics', function (Blueprint $table) {
            $table->id();
            $table->string('equipment_name');
            $table->string('period');
            $table->integer('failure_rate_pct')->default(0);
            $table->integer('ticket_count')->default(0);
            $table->enum('risk_level', ['Low', 'Moderate', 'High', 'Critical'])->default('Low');
            $table->timestamps();
        });

        // Escalation risk snapshots
        Schema::create('escalation_risk_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('period');
            $table->integer('low_count')->default(0);
            $table->integer('medium_count')->default(0);
            $table->integer('high_count')->default(0);
            $table->integer('critical_count')->default(0);
            $table->integer('total_escalations')->default(0);
            $table->string('avg_resolution_time')->nullable(); // e.g. '4.2 hrs'
            $table->timestamps();
        });

        // Root cause analytics
        Schema::create('root_cause_analytics', function (Blueprint $table) {
            $table->id();
            $table->string('cause_name');
            $table->string('period');
            $table->integer('percentage')->default(0);
            $table->integer('ticket_count')->default(0);
            $table->enum('trend', ['up', 'down', 'stable'])->default('stable');
            $table->timestamps();
        });

        // Recurring issue analytics
        Schema::create('recurring_issue_analytics', function (Blueprint $table) {
            $table->id();
            $table->string('category');
            $table->string('period');
            $table->integer('frequency')->default(0);
            $table->integer('growth_pct')->default(0); // % change vs prior period
            $table->enum('severity', ['Low', 'Medium', 'High', 'Critical'])->default('Medium');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recurring_issue_analytics');
        Schema::dropIfExists('root_cause_analytics');
        Schema::dropIfExists('escalation_risk_snapshots');
        Schema::dropIfExists('equipment_risk_analytics');
        Schema::dropIfExists('employee_performance_analytics');
        Schema::dropIfExists('ticket_volume_snapshots');
    }
};
