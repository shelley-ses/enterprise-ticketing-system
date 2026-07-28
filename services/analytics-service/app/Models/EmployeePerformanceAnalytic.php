<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeePerformanceAnalytic extends Model
{
    protected $table = 'employee_performance_analytics';

    protected $fillable = [
        'employee_name', 'period', 'ticket_count',
        'sla_compliance', 'avg_response_hours', 'trend',
    ];

    protected $casts = [
        'sla_compliance'    => 'float',
        'avg_response_hours' => 'float',
    ];
}
