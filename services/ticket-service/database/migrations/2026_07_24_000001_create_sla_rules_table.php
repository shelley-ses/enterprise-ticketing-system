<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sla_rules')) {
            Schema::create('sla_rules', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('department_id');
                $table->unsignedBigInteger('category_id')->nullable();
                $table->string('priority');
                $table->integer('response_time_limit'); // in minutes
                $table->integer('resolution_time_limit'); // in minutes
                $table->timestamps();

                $table->foreign('department_id')->references('id')->on('departments')->cascadeOnDelete();
                $table->foreign('category_id')->references('problem_category_ID')->on('problem_categories')->nullOnDelete();
                $table->index(['department_id', 'priority']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_rules');
    }
};
