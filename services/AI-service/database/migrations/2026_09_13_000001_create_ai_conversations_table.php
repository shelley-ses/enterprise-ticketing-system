<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ai_conversations', function (Blueprint $table) {
            $table->string('id', 64)->primary(); // UUID or client conversation ID
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('title')->default('New Support Inquiry');
            $table->enum('status', ['active', 'escalated', 'ticket_created', 'closed'])->default('active');
            $table->longText('messages')->nullable(); // JSON formatted array of messages
            $table->json('escalation_data')->nullable(); // Suggested ticket parameters
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_conversations');
    }
};
