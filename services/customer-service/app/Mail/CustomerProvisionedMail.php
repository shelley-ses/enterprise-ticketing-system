<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Models\Client;

class CustomerProvisionedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Client $client,
        public string $temporaryPassword
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Welcome to Enterprise Ticketing System - Your Account Details',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.customer-provisioned',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
