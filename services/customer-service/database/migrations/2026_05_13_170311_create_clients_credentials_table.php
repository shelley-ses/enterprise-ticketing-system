<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * clients_credentials
     */
    public function up(): void
    {
        Schema::create('clients_credentials', function (Blueprint $table) {
            $table->unsignedBigInteger('client_id')->primary();

            $table->string('password_hash');
            $table->integer('failed_login_count')->default(0);
            $table->timestamp('locked_until')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->timestamp('password_change_at')->nullable();

            $table->timestamps();

            $table->foreign('client_id')
                ->references('id')
                ->on('clients')
                ->onDelete('cascade');
        });
    }

    
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clients_credentials');
    }
};
