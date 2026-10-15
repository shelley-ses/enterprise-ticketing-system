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
        $this->assertSame('array', config('cache.default'), "Expected cache driver 'array', got " . config('cache.default'));

        $mockClient = new class {
            public function scan(&$iterator, $pattern = null, $count = 100) {
                return false;
            }
            public function del($key) {
                return 1;
            }
        };

        $mockRedisConn = new class($mockClient) {
            private $client;
            public function __construct($client) {
                $this->client = $client;
            }
            public function client() {
                return $this->client;
            }
            public function scan($iterator = 0, $options = []) {
                return [0, []];
            }
            public function del($key) {
                return 1;
            }
        };

        \Illuminate\Support\Facades\Redis::shouldReceive('connection')
            ->byDefault()
            ->andReturn($mockRedisConn);

        \Illuminate\Support\Facades\Redis::shouldReceive('scan')
            ->byDefault()
            ->andReturn([0, []]);

        \Illuminate\Support\Facades\Redis::shouldReceive('del')
            ->byDefault()
            ->andReturn(0);

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
