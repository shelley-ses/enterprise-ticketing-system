<?php

namespace App\Services;

use App\Models\WorkLog;

class WorkLogService
{
    public function getFilteredQuery(int $employeeId, ?string $dateFrom, ?string $dateTo, ?string $status)
    {
        $query = WorkLog::where('employee_id', $employeeId);

        if ($dateFrom) {
            $query->where('log_date', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->where('log_date', '<=', $dateTo);
        }

        if ($status) {
            $query->where('status', $status);
        }

        $query->orderBy('log_date', 'desc')->orderBy('created_at', 'desc');

        return $query;
    }

    public function getWorkLogs(int $employeeId, ?string $dateFrom, ?string $dateTo, ?string $status, int $perPage = 15)
    {
        return $this->getFilteredQuery($employeeId, $dateFrom, $dateTo, $status)
            ->paginate($perPage);
    }

    public function getFilteredWorkLogsForExport(int $employeeId, ?string $dateFrom, ?string $dateTo, ?string $status)
    {
        return $this->getFilteredQuery($employeeId, $dateFrom, $dateTo, $status)
            ->get();
    }

    public function generateCsv($workLogs): string
    {
        $handle = fopen('php://temp', 'r+');

        fputcsv($handle, ['ID', 'Ticket ID', 'Task Description', 'Hours Spent', 'Log Date', 'Status', 'Created At']);

        foreach ($workLogs as $log) {
            fputcsv($handle, [
                $log->id,
                $log->ticket_id ?? 'N/A',
                $log->task_description,
                number_format((float) $log->hours_spent, 2),
                $log->log_date,
                $log->status,
                $log->created_at,
            ]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    public function generatePdf($workLogs)
    {
        $html = $this->renderPdfHtml($workLogs);

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);

        return $pdf->output();
    }

    private function renderPdfHtml($workLogs): string
    {
        $rows = '';
        foreach ($workLogs as $log) {
            $rows .= '<tr>
                <td>' . e($log->id) . '</td>
                <td>' . e($log->ticket_id ?? 'N/A') . '</td>
                <td>' . e($log->task_description) . '</td>
                <td>' . number_format((float) $log->hours_spent, 2) . '</td>
                <td>' . e($log->log_date) . '</td>
                <td>' . e($log->status) . '</td>
            </tr>';
        }

        return '
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; }
                h1 { text-align: center; font-size: 18px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
                th { background-color: #f4f4f4; font-weight: bold; }
                .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
            </style>
        </head>
        <body>
            <h1>Work Logs Report</h1>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Ticket ID</th>
                        <th>Task Description</th>
                        <th>Hours Spent</th>
                        <th>Log Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ' . $rows . '
                </tbody>
            </table>
            <div class="footer">Generated on ' . now()->format('Y-m-d H:i:s') . '</div>
        </body>
        </html>';
    }
}
