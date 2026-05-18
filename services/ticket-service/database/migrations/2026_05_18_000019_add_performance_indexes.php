<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tickets')) {
            Schema::table('tickets', function (Blueprint $table) {
                if (!$this->indexExists('tickets', 'tickets_created_by_index')) {
                    $table->index('created_by');
                }
                if (!$this->indexExists('tickets', 'tickets_ticket_status_id_index')) {
                    $table->index('ticket_status_ID');
                }
                if (!$this->indexExists('tickets', 'tickets_priority_id_index')) {
                    $table->index('priority_ID');
                }
                if (!$this->indexExists('tickets', 'tickets_assigned_to_index')) {
                    $table->index('assigned_to');
                }
                if (!$this->indexExists('tickets', 'tickets_created_at_index')) {
                    $table->index('created_at');
                }
            });
        }

        if (Schema::hasTable('clients')) {
            Schema::table('clients', function (Blueprint $table) {
                if (!$this->indexExists('clients', 'clients_id_index')) {
                    $table->index('id');
                }
            });
        }

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!$this->indexExists('users', 'users_id_index')) {
                    $table->index('id');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('tickets')) {
            Schema::table('tickets', function (Blueprint $table) {
                $table->dropIndexIfExists('tickets_created_by_index');
                $table->dropIndexIfExists('tickets_ticket_status_id_index');
                $table->dropIndexIfExists('tickets_priority_id_index');
                $table->dropIndexIfExists('tickets_assigned_to_index');
                $table->dropIndexIfExists('tickets_created_at_index');
            });
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        try {
            $connection = \DB::connection()->getDoctrineSchemaManager();
            $indexes = $connection->listTableIndexes($table);
            return isset($indexes[strtolower($index)]);
        } catch (\Throwable $e) {
            return false;
        }
    }
};
