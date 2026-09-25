<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('workflow_statuses')) {
            Schema::create('workflow_statuses', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('bg_color')->default('#DBEAFE');
                $table->string('text_color')->default('#1D4ED8');
                $table->integer('order_position')->default(1);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('escalation_rules')) {
            Schema::create('escalation_rules', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('name');
                $table->boolean('is_active')->default(true);
                $table->string('trigger');
                $table->string('condition_text');
                $table->string('condition_highlight')->nullable();
                $table->string('action');
                $table->string('notify');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('escalation_rules');
        Schema::dropIfExists('workflow_statuses');
    }
};
