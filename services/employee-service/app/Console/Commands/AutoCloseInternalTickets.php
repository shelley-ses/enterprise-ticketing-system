<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AutoCloseInternalTickets extends Command
{
    protected $signature = 'tickets:auto-close-internal';
    protected $description = 'Auto-close internal tickets that have been resolved for more than 48 hours';

    public function handle()
    {
        $cutoff = now()->subHours(48);

        $tickets = DB::table('tickets')
            ->whereNotNull('requested_by')
            ->where('ticket_status_ID', 3)
            ->where('resolved_at', '<=', $cutoff)
            ->get();

        $count = 0;
        foreach ($tickets as $ticket) {
            DB::transaction(function () use ($ticket, &$count) {
                $now = now();
                DB::table('tickets')->where('ticket_ID', $ticket->ticket_ID)->update([
                    'ticket_status_ID' => 4,
                    'closed_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('ticket_audit_logs')->insert([
                    'ticket_ID' => $ticket->ticket_ID,
                    'action_type' => 'status_change',
                    'action_by_ID' => 1,
                    'actor_type' => 'system',
                    'details' => json_encode([
                        'status' => 'Closed',
                        'remarks' => 'Auto-closed after 48 hours of inactivity.',
                    ]),
                    'created_at' => $now,
                ]);
                $count++;
            });
        }

        $this->info("Auto-closed {$count} internal ticket(s).");
    }
}
