<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class EmployeeSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('employees')->upsert([
            [
                'email' => 'cs@gmail.com',
                'password_hash' => Hash::make('12345678'),
                'first_name' => 'Ava',
                'last_name' => 'Santos',
                'role' => 'customer service',
                'department' => 'Customer Service',
            ],
            [
                'email' => 'employee@gmail.com',
                'password_hash' => Hash::make('12345678'),
                'first_name' => 'Mark',
                'last_name' => 'Reyes',
                'role' => 'service',
                'department' => 'Service',
            ],
        ], ['email'], ['password_hash', 'first_name', 'last_name', 'role', 'department']);
    }
}
