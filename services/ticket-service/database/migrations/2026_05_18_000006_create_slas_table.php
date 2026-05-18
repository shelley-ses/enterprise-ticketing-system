<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('slas', function (Blueprint $table) {
            $table->bigIncrements('sla_ID');
            $table->string('sla_name');
            $table->text('description')->nullable();
            $table->unsignedInteger('response_time_minutes')->nullable();
            $table->unsignedInteger('resolution_time_minutes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('slas');
    }
};