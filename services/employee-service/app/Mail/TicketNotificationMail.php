<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TicketNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $notificationTitle;
    public string $notificationMessage;
    public string $ticketRef;
    public string $ticketTitle;
    public string $category;
    public string $priority;
    public string $ticketLink;

    public function __construct(
        string $notificationTitle,
        string $notificationMessage,
        string $ticketRef,
        string $ticketTitle,
        string $category,
        string $priority,
        string $ticketLink
    ) {
        $this->notificationTitle = $notificationTitle;
        $this->notificationMessage = $notificationMessage;
        $this->ticketRef = $ticketRef;
        $this->ticketTitle = $ticketTitle;
        $this->category = $category;
        $this->priority = $priority;
        $this->ticketLink = $ticketLink;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->notificationTitle,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.ticket-notification',
        );
    }
}
