<?php

namespace App\Events;

use App\Models\Employee;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class EmployeeStatusChanged implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(public Employee $employee)
    {
    }

    public function broadcastOn(): array
    {
        return [new Channel('employee-status')];
    }

    public function broadcastAs(): string
    {
        return 'employee.status.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->employee->emp_id,
            'email' => $this->employee->email,
            'first_name' => $this->employee->first_name,
            'last_name' => $this->employee->last_name,
            'role' => $this->employee->role,
            'department' => $this->employee->department,
            'is_active' => (bool) $this->employee->is_active,
            'last_seen_at' => optional($this->employee->last_seen_at)->toISOString(),
        ];
    }
}