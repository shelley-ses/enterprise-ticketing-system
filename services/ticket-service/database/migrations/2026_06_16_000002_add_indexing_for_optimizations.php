<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->index(['is_internal', 'created_at'], 'idx_tickets_is_internal_created_at');
            $table->index(['requested_by', 'created_at'], 'idx_tickets_requested_by_created_at');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('idx_tickets_is_internal_created_at');
            $table->dropIndex('idx_tickets_requested_by_created_at');
        });
    }
};
