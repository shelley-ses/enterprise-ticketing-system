<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('system_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('key', 64)->unique();
            $table->json('value');
            $table->timestamps();
        });

        // Seed initial baseline configurations
        $now = now();
        $defaults = [
            [
                'key' => 'company_info',
                'value' => json_encode([
                    'address' => 'SBSI Building, 28 East Capitol Drive, Kapitolyo, Pasig City, Metro Manila, Philippines 1603',
                    'contactNumber' => '+63 2 8635 9999',
                    'contactEmail' => 'support@sbsi.com.ph',
                    'socialLinks' => [
                        ['id' => 'soc-1', 'platform' => 'LinkedIn', 'url' => 'https://www.linkedin.com/company/scientific-biotech-specialties-inc'],
                        ['id' => 'soc-2', 'platform' => 'Facebook', 'url' => 'https://www.facebook.com/ScientificBiotechSpecialties'],
                        ['id' => 'soc-3', 'platform' => 'Twitter / X', 'url' => 'https://x.com/sbsi_ph'],
                    ],
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'system_status',
                'value' => json_encode([
                    'status' => 'Operational',
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'log_level',
                'value' => json_encode([
                    'level' => 'Info',
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('system_configurations')->insert($defaults);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_configurations');
    }
};
