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

        if (\Illuminate\Support\Facades\DB::connection()->getDatabaseName() === 'ticketing_system') {
            throw new \RuntimeException("Refusing to run tests against production/development database 'ticketing_system'");
        }

        $this->assertSame('log', config('broadcasting.default'), "Expected broadcast driver 'log', got " . config('broadcasting.default'));

        Event::fake([TicketChanged::class]);

        Http::preventStrayRequests();

        \Illuminate\Support\Facades\Cache::forever(
            'ticket:config:limits:last-known-good',
            \App\Services\TicketConfigurationService::DEFAULT_LIMITS
        );
        \Illuminate\Support\Facades\Cache::put(
            'ticket:config:limits',
            \App\Services\TicketConfigurationService::DEFAULT_LIMITS,
            300
        );

        Http::fake([
            '*/api/internal/tickets/*/messages' => Http::response([], 200),
            '*/api/email/dispatch-event' => Http::response(['status' => 'success'], 200),
        ]);
    }
}
