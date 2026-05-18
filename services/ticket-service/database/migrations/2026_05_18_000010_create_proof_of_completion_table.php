<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proof_of_completion', function (Blueprint $table) {
            $table->bigIncrements('proof_ID');
            $table->foreignId('assignment_ID')->constrained('ticket_assignments', 'assignment_ID');
            $table->string('file_name');
            $table->string('file_path');
            $table->string('file_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->dateTime('uploaded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proof_of_completion');
    }
};