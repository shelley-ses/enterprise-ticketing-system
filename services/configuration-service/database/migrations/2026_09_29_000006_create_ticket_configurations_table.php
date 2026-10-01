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
        Schema::create('ticket_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('key', 64)->unique();
            $table->json('value');
            $table->timestamps();
        });

        // Seed initial ticket configurations
        $now = now();
        $defaults = [
            'number_format' => [
                'prefix' => 'TKT',
                'includeDeptCode' => false,
                'deptCode' => '',
                'dateSegment' => 'none',
                'digitLength' => 4,
            ],
            'defaults' => [
                'status' => 'Open',
                'priority' => 'Low',
                'slaPolicy' => 'dynamic',
            ],
            'limits' => [
                'isUnlimited' => true,
                'limit' => 5,
            ],
            'transitions' => [
                'Open' => [
                    'allowed' => ['In Progress (CS-owned)', 'Cancelled'],
                    'type' => 'editable',
                    'description' => 'Initial ticket state upon customer or internal creation.',
                ],
                'In Progress (CS-owned)' => [
                    'allowed' => ['On Hold/Pending', 'Assigned', 'Resolved'],
                    'type' => 'editable',
                    'description' => 'Ticket being triaged or actively handled directly by Customer Service.',
                ],
                'Assigned' => [
                    'allowed' => ['Reassigned', 'In Progress (Employee-owned)'],
                    'type' => 'editable',
                    'description' => 'Ticket dispatched to an engineer/technician and awaiting their acceptance.',
                ],
                'Reassigned' => [
                    'allowed' => ['In Progress (Employee-owned)', 'Assigned'],
                    'type' => 'editable',
                    'description' => 'Ticket reassignment requested or approved for re-dispatch.',
                ],
                'In Progress (Employee-owned)' => [
                    'allowed' => ['On Hold/Pending', 'Reassigned', 'Resolved'],
                    'type' => 'editable',
                    'description' => 'Service engineer has accepted the assignment and is actively working on the machine.',
                ],
                'Resolved' => [
                    'allowed' => ['Closed', 'In Progress (Employee-owned)'],
                    'type' => 'editable',
                    'description' => 'Work is marked complete with proof of completion pending evaluation.',
                ],
                'Closed' => [
                    'allowed' => ['Reopened'],
                    'type' => 'editable',
                    'caption' => 'Reopening is permitted only within the configured reopen window (e.g. 48h after resolution).',
                    'description' => 'Final confirmed state. Can transition to Reopened within the allowed reopen window.',
                ],
                'Reopened' => [
                    'allowed' => ['In Progress (CS-owned)'],
                    'type' => 'fixed',
                    'caption' => 'Automatic transition: Reopened tickets immediately route to Customer Service (CS-owned). This transition is system-automated and non-editable.',
                    'description' => 'Ticket reopened by customer within window; routes automatically to CS.',
                ],
                'On Hold/Pending' => [
                    'allowed' => [],
                    'type' => 'contextual',
                    'caption' => 'Contextual transition: Resumes back to whichever In Progress state it came from (CS-owned or Employee-owned). This is contextual rather than a fixed pair, so it is non-editable.',
                    'description' => 'Ticket paused awaiting parts, customer feedback, or external dependency.',
                ],
                'Cancelled' => [
                    'allowed' => [],
                    'type' => 'terminal',
                    'caption' => 'Terminal status: No further transitions permitted from Cancelled.',
                    'description' => 'Ticket discarded or cancelled before assignment.',
                ],
            ],
            'windows' => [
                'reopenEnabled' => true,
                'reopenWindowDays' => 2,
                'autoCloseEnabled' => true,
                'autoCloseWindowDays' => 2,
            ],
            'file_limits' => [
                'maxFileSizeMB' => 15,
                'allowedFileTypes' => ['PDF', 'DOCX', 'DOC', 'JPG', 'JPEG', 'PNG'],
                'maxFileCount' => 5,
                'malwareScanningEnabled' => true,
            ],
            'routing' => [
                'new_ticket' => ['role_cs'],
                'new_message' => ['contextual_assigned'],
                'overdue_ticket' => ['role_cs'],
            ],
        ];

        foreach ($defaults as $key => $val) {
            DB::table('ticket_configurations')->insert([
                'key' => $key,
                'value' => json_encode($val),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_configurations');
    }
};
