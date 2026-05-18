<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_assignments', function (Blueprint $table) {
            $table->bigIncrements('assignment_ID');
            $table->foreignId('ticket_ID')->constrained('tickets', 'ticket_ID');
            $table->foreignId('employee_ID')->constrained('users', 'id');
            $table->foreignId('assigned_by')->constrained('users', 'id');
            $table->string('assignment_status')->default('assigned');
            $table->dateTime('assigned_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_assignments');
    }
};