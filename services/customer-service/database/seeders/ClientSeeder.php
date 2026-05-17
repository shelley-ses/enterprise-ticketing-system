<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Client;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ClientSeeder extends Seeder
{
    public function run(): void
    {
        // create client
        $client = Client::create([
            'client_name' => 'Test Client',
            'address' => 'QC',
            'contact_number' => '09123456789',
            'email' => 'test@email.com',
            'status' => true
        ]);

        // create credentials
        DB::table('clients_credentials')->insert([
            'client_id' => $client->id,
            'password_hash' => Hash::make('12345678'),
            'failed_login_count' => 0,
            'locked_until' => null,
            'last_login_at' => null,
            'password_change_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}