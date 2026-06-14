<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Indexes are already present in the database from foreign constraints and previous migrations.
    }

    public function down(): void
    {
        // No schema updates to roll back.
    }
};
