<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->boolean('proof_rejected')->default(false)->after('ticket_status_ID');
            $table->text('rejection_reason')->nullable()->after('proof_rejected');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn(['proof_rejected', 'rejection_reason']);
        });
    }
};
