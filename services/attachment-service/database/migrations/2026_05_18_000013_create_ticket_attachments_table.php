<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_attachments', function (Blueprint $table) {
            $table->bigIncrements('attachment_id');
            $table->foreignId('ticket_id')->nullable()->constrained('tickets', 'ticket_ID')->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_path');
            $table->string('file_type')->nullable();
            $table->dateTime('uploaded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_attachments');
    }
};