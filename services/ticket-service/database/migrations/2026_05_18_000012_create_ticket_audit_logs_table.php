<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_audit_logs', function (Blueprint $table) {
            $table->bigIncrements('log_ID');
            $table->foreignId('ticket_ID')->constrained('tickets', 'ticket_ID');
            $table->string('action_type');
            $table->foreignId('action_by_ID')->constrained('users', 'id');
            $table->string('actor_type');
            $table->dateTime('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_audit_logs');
    }
};