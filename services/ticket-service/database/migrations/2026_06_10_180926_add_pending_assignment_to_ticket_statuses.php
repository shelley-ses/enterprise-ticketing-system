<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        DB::table('ticket_statuses')->insert([
            'ticket_status_ID' => 9,
            'status_name' => 'Pending Assignment',
        ]);
    }

    public function down()
    {
        DB::table('ticket_statuses')->where('status_name', 'Pending Assignment')->delete();
    }
};