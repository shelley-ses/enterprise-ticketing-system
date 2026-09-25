<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_trackings', function (Blueprint $table) {
            $table->bigIncrements('sla_log_ID');
            $table->foreignId('assignment_ID')->nullable()->constrained('ticket_assignments', 'assignment_ID')->nullOnDelete();
            $table->foreignId('sla_ID')->nullable()->constrained('slas', 'sla_ID')->nullOnDelete();
            $table->string('stage');
            $table->dateTime('expected_time')->nullable();
            $table->dateTime('actual_time')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_trackings');
    }
};