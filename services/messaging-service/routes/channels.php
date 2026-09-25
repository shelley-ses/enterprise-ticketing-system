<?php

use App\Models\Employee;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
*/

Broadcast::channel('ticket.{ticketId}', function ($user, $ticketId) {
    // Authorize any authenticated user (client or employee) to join the ticket channel.
    return $user !== null;
});
