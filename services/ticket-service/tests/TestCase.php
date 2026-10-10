<?php

namespace Tests;

use App\Events\TicketChanged;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TicketChanged::class]);

        Http::preventStrayRequests();

        Http::fake([
            '*/api/internal/tickets/*/messages' => Http::response([], 200),
            '*/api/email/dispatch-event' => Http::response(['status' => 'success'], 200),
        ]);
    }
}
