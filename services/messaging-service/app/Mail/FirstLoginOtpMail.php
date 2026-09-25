<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class FirstLoginOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $name,
        public string $otp,
        public int $expiresMinutes
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your first login verification code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.first-login-otp',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
