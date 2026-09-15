<?php

namespace App\Services;

use App\Events\TicketChanged;
use App\Mail\TicketNotificationMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class TicketNotificationService
{
    /**
     * Get user ID and user type (client or employee) from the incoming request.
     */
    public function getRecipientInfo(Request $request): array
    {
        $user = $request->user();
        if (!$user) {
            return [null, null];
        }
        if ($user instanceof \App\Models\Client) {
            return [$user->id, 'client'];
        }
        return [$user->emp_id, 'employee'];
    }

    /**
     * Persist an in-app notification in the database.
     */
    public function notifyRecipient(
        int $recipientId,
        string $recipientType,
        string $title,
        string $message,
        ?int $ticketId = null,
        ?array $data = null
    ): void {
        DB::table('notifications')->insert([
            'recipient_id' => $recipientId,
            'recipient_type' => $recipientType,
            'title' => $title,
            'message' => $message,
            'ticket_id' => $ticketId,
            'data' => $data ? json_encode($data) : null,
            'is_read' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Notify all customer service employees.
     */
    public function notifyCS(string $title, string $message, ?int $ticketId = null, ?array $data = null, ?int $excludeUserId = null): void
    {
        $csUsers = DB::table('employees')->where('role', 'customer service')->pluck('emp_id');
        foreach ($csUsers as $csEmpId) {
            if ($excludeUserId !== null && (int) $csEmpId === $excludeUserId) {
                continue;
            }
            $this->notifyRecipient((int)$csEmpId, 'employee', $title, $message, $ticketId, $data);
        }
    }

    /**
     * Notify customer (and requested_by employee if internal).
     */
    public function notifyCustomer(int $customerId, string $title, string $message, ?int $ticketId = null, ?array $data = null): void
    {
        $this->notifyRecipient($customerId, 'client', $title, $message, $ticketId, $data);

        if ($ticketId) {
            $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first(['requested_by']);
            if ($ticket && $ticket->requested_by) {
                $this->notifyRecipient((int)$ticket->requested_by, 'employee', $title, $message, $ticketId, $data);
            }
        }
    }

    /**
     * Dispatch email notification to an assigned employee.
     */
    public function sendTicketEmail(
        int $empId,
        string $subject,
        string $message,
        int $ticketId,
        string $ticketTitle,
        string $category,
        string $priority
    ): void {
        $employee = DB::table('employees')->where('emp_id', $empId)->first();
        if (!$employee || !$employee->email) {
            return;
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $ticketLink = url("/tickets/{$ticketId}");

        try {
            Mail::to($employee->email)->send(new TicketNotificationMail(
                $subject,
                $message,
                $ticketRef,
                $ticketTitle,
                $category,
                $priority,
                $ticketLink
            ));
        } catch (\Exception $e) {
            Log::warning("Failed to send ticket email to {$employee->email}: {$e->getMessage()}");
        }
    }

    /**
     * Dispatch email notification to a customer.
     */
    public function sendCustomerEmail(
        int $customerId,
        string $subject,
        string $message,
        int $ticketId,
        string $ticketTitle,
        string $category,
        string $priority
    ): void {
        $client = DB::table('clients')->where('id', $customerId)->first();
        if (!$client || !$client->email) {
            return;
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $ticketLink = url("/tickets/{$ticketId}");

        try {
            Mail::to($client->email)->send(new TicketNotificationMail(
                $subject,
                $message,
                $ticketRef,
                $ticketTitle,
                $category,
                $priority,
                $ticketLink
            ));
        } catch (\Exception $e) {
            Log::warning("Failed to send customer email to {$client->email}: {$e->getMessage()}");
        }
    }

    /**
     * Broadcast ticket lifecycle changes over Laravel Reverb WebSockets.
     */
    public function broadcastTicketChange(string $action, int $ticketId, array $payload = []): void
    {
        $ticket = DB::table('tickets')->where('ticket_ID', $ticketId)->first();

        $fullTicket = null;
        if ($ticketId > 0) {
            if (isset($payload['ticket'])) {
                $fullTicket = $payload['ticket'];
            } else {
                try {
                    $fullTicket = app(TicketService::class)->getFullTicketDetails($ticketId);
                } catch (\Throwable $e) {
                    $fullTicket = null;
                }
            }
        }

        $assignedEmpIds = [];
        if ($ticketId > 0) {
            $assignedEmpIds = DB::table('ticket_assignments')
                ->where('ticket_ID', $ticketId)
                ->pluck('employee_ID')
                ->map(fn($id) => (int)$id)
                ->all();
        }

        event(new TicketChanged(array_merge([
            'action' => $action,
            'ticket_ID' => $ticketId,
            'ticketId' => $ticketId,
            'updated_at' => now()->toISOString(),
            'customer_id' => $ticket?->created_by,
            'assigned_to' => $ticket?->assigned_to,
            'employee_ids' => $assignedEmpIds,
            'ticket_status_ID' => $ticket?->ticket_status_ID,
            'ticket' => $fullTicket,
        ], $payload)));
    }
}
