<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('ticket_statuses')->upsert([
            [
                'ticket_status_ID' => 9,
                'status_name' => 'Discarded',
                'color_code' => '#ef4444',
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
        ], ['ticket_status_ID'], ['status_name', 'color_code', 'updated_at']);
    }


    public function down(): void
    {
        DB::table('ticket_statuses')->where('ticket_status_ID', 9)->delete();
    }
};
