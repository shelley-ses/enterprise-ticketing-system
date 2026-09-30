<?php

namespace App\Services;

use App\Events\TicketChanged;
use App\Mail\TicketNotificationMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
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
     * Maps subject/action to an event template key.
     */
    protected function inferEventKey(string $subject): ?string
    {
        $normalized = strtolower($subject);
        if (str_contains($normalized, 'created')) return 'ticket_created';
        if (str_contains($normalized, 'assign')) return 'ticket_assigned';
        if (str_contains($normalized, 'status')) return 'ticket_status_changed';
        if (str_contains($normalized, 'resolved')) return 'ticket_resolved';
        if (str_contains($normalized, 'closed')) return 'ticket_closed';
        if (str_contains($normalized, 'escalat')) return 'ticket_escalated';
        if (str_contains($normalized, 'message')) return 'new_message';
        if (str_contains($normalized, 'sla')) return 'sla_breach_warning';
        return null;
    }

    /**
     * Dispatches a template-driven email via configuration-service.
     */
    public function dispatchTemplateEmail(string $recipientEmail, ?string $eventKey, array $data = []): bool
    {
        if (!$eventKey) {
            return false;
        }

        try {
            $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
            $response = Http::timeout(6)->post("{$configUrl}/api/email/dispatch-event", [
                'eventKey' => $eventKey,
                'to'       => $recipientEmail,
                'data'     => $data,
            ]);

            if ($response->successful()) {
                $status = $response->json('status');
                if ($status === 'success' || $status === 'skipped') {
                    Log::info("Event email [{$eventKey}] handled by configuration-service for {$recipientEmail} (status: {$status})");
                    return true;
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Configuration-service template dispatch-event failed: {$e->getMessage()}");
        }

        return false;
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
        string $priority,
        ?string $eventKey = null,
        array $extraData = []
    ): void {
        $employee = DB::table('employees')->where('emp_id', $empId)->first();
        if (!$employee || !$employee->email) {
            return;
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $ticketLink = url("/tickets/{$ticketId}");

        $inferredKey = $eventKey ?? $this->inferEventKey($subject);
        $templateDispatched = $this->dispatchTemplateEmail($employee->email, $inferredKey, array_merge([
            'customer_name'   => ($employee->first_name ?? '') . ' ' . ($employee->last_name ?? ''),
            'agent_name'      => ($employee->first_name ?? '') . ' ' . ($employee->last_name ?? ''),
            'ticket_number'   => $ticketRef,
            'ticket_subject'  => $ticketTitle,
            'ticket_priority' => $priority,
            'ticket_category' => $category,
            'ticket_link'     => $ticketLink,
            'message_preview' => $message,
        ], $extraData));

        if ($templateDispatched) {
            return;
        }

        try {
            $mailable = new TicketNotificationMail(
                $subject,
                $message,
                $ticketRef,
                $ticketTitle,
                $category,
                $priority,
                $ticketLink
            );
            $this->dispatchEmail($employee->email, $mailable);
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
        string $priority,
        ?string $eventKey = null,
        array $extraData = []
    ): void {
        $client = DB::table('clients')->where('id', $customerId)->first();
        if (!$client || !$client->email) {
            return;
        }

        $ticketRef = 'TKT-' . str_pad((string) $ticketId, 4, '0', STR_PAD_LEFT);
        $ticketLink = url("/tickets/{$ticketId}");

        $inferredKey = $eventKey ?? $this->inferEventKey($subject);
        $templateDispatched = $this->dispatchTemplateEmail($client->email, $inferredKey, array_merge([
            'customer_name'   => $client->client_name ?? 'Valued Customer',
            'ticket_number'   => $ticketRef,
            'ticket_subject'  => $ticketTitle,
            'ticket_priority' => $priority,
            'ticket_category' => $category,
            'ticket_link'     => $ticketLink,
            'message_preview' => $message,
        ], $extraData));

        if ($templateDispatched) {
            return;
        }

        try {
            $mailable = new TicketNotificationMail(
                $subject,
                $message,
                $ticketRef,
                $ticketTitle,
                $category,
                $priority,
                $ticketLink
            );
            $this->dispatchEmail($client->email, $mailable);
        } catch (\Exception $e) {
            Log::warning("Failed to send customer email to {$client->email}: {$e->getMessage()}");
        }
    }

    /**
     * Dispatches email via configuration-service (Resend), falling back to SMTP.
     */
    protected function dispatchEmail(string $recipientEmail, TicketNotificationMail $mailable): void
    {
        try {
            $configUrl = env('CONFIGURATION_SERVICE_URL', 'http://configuration-service:8000');
            $response = Http::timeout(6)->post("{$configUrl}/api/email/dispatch", [
                'to' => $recipientEmail,
                'subject' => $mailable->subject ?? 'Ticket Notification',
                'html' => $mailable->render(),
            ]);

            if ($response->successful()) {
                Log::info("Ticket notification email dispatched via Resend to {$recipientEmail}");
                return;
            }
        } catch (\Throwable $e) {
            Log::warning("Configuration service email dispatch failed, falling back to SMTP: {$e->getMessage()}");
        }

        Mail::to($recipientEmail)->send($mailable);
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
