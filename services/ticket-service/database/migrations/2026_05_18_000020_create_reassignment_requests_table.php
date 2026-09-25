<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reassignment_requests', function (Blueprint $table) {
            $table->bigIncrements('request_id');
            $table->foreignId('ticket_id')->constrained('tickets', 'ticket_ID')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees', 'emp_id')->cascadeOnDelete();
            $table->text('reason');
            $table->string('status')->default('pending'); // pending, approved, denied
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reassignment_requests');
    }
};
