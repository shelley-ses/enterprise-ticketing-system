<?php
// Assign tickets to engineer@example.com (emp_id=6) and activate them
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$empId = 6;

// Activate the engineer
DB::table('employees')->where('emp_id', $empId)->update(['is_active' => 1]);
echo "Activated engineer (emp_id=$empId)\n";

// Find tickets that have no assignment yet (unassigned) - status Open (1) or Pending (7)
$unassigned = DB::table('tickets as t')
    ->whereNotExists(function($q) {
        $q->select(DB::raw(1))
          ->from('ticket_assignments as ta')
          ->whereColumn('ta.ticket_ID', 't.ticket_ID');
    })
    ->whereIn('t.ticket_status_ID', [1, 7, 8]) // Open, Pending, Reopened
    ->limit(30)
    ->pluck('t.ticket_ID')
    ->toArray();

echo "Found " . count($unassigned) . " unassigned tickets to assign\n";

$now = now();
$assigned = 0;
foreach ($unassigned as $ticketId) {
    DB::table('ticket_assignments')->insert([
        'ticket_ID'         => $ticketId,
        'employee_ID'       => $empId,
        'assigned_by'       => $empId,
        'assignment_status' => 'pending',
        'assigned_at'       => $now,
        'completed_at'      => null,
        'created_at'        => $now,
        'updated_at'        => $now,
    ]);
    // Also update the tickets.assigned_to field
    DB::table('tickets')->where('ticket_ID', $ticketId)->update(['assigned_to' => $empId]);
    $assigned++;
}

echo "Assigned $assigned tickets to engineer@example.com (emp_id=$empId)\n";
echo "Done!\n";
