<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        DB::table('ticket_statuses')->updateOrInsert(
            ['status_name' => 'Pending Assignment'],
            ['color_code' => '#f59e0b', 'created_at' => now(), 'updated_at' => now()]
        );
    }

    public function down()
    {
        DB::table('ticket_statuses')->where('status_name', 'Pending Assignment')->delete();
    }
};