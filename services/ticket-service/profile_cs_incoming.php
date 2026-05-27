<?php
$startBoot = microtime(true);
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$bootTime = (microtime(true) - $startBoot) * 1000;
echo "Laravel Boot Time: " . round($bootTime, 2) . " ms\n";

$startQuery = microtime(true);
$rows = Illuminate\Support\Facades\DB::table('tickets as t')
    ->join('problem_categories as pc', 'pc.problem_category_ID', '=', 't.problem_category_ID')
    ->join('ticket_statuses as ts', 'ts.ticket_status_ID', '=', 't.ticket_status_ID')
    ->leftJoin('clients as c', 'c.id', '=', 't.created_by')
    ->leftJoin('machines as m', 'm.machine_ID', '=', 't.machine_ID')
    ->select(
        't.ticket_ID',
        't.title',
        'pc.category_name',
        'ts.status_name',
        't.created_at',
        'c.client_name',
        'm.machine_name',
        'm.serial_number'
    )
    ->orderByDesc('t.created_at')
    ->limit(50)
    ->get();
$queryTime = (microtime(true) - $startQuery) * 1000;
echo "Database Query Time: " . round($queryTime, 2) . " ms (fetched " . count($rows) . " rows)\n";

$startMap = microtime(true);
$mapped = $rows->map(function ($row) {
    // Mimic the controller mapping logic
    $slaTime = microtime(true);
    // Mimic slaLabel:
    $createdAt = $row->created_at;
    $sla = 'On Track';
    if ($createdAt) {
        $hours = now()->diffInHours($createdAt);
        if ($hours >= 48) {
            $sla = 'Breached';
        } elseif ($hours >= 24) {
            $sla = 'At Risk';
        }
    }
    
    $date = optional($row->created_at)->format('m/d/Y') ?? now()->format('m/d/Y');
    
    return [
        'id' => 'TKT-' . str_pad((string) $row->ticket_ID, 4, '0', STR_PAD_LEFT),
        'ticket_ID' => (int) $row->ticket_ID,
        'customer' => $row->client_name ?: 'Unknown Customer',
        'title' => $row->title,
        'category' => $row->category_name,
        'status' => $row->status_name,
        'equipment' => $row->machine_name . ' - ' . $row->serial_number,
        'sla' => $sla,
        'date' => $date,
    ];
});
$mapTime = (microtime(true) - $startMap) * 1000;
echo "Mapping Time: " . round($mapTime, 2) . " ms\n";
