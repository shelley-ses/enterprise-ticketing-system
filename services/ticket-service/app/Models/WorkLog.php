<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkLog extends Model
{
    use HasFactory;

    protected $table = 'work_logs';

    protected $fillable = [
        'employee_id',
        'ticket_id',
        'task_description',
        'hours_spent',
        'log_date',
        'status',
    ];

    protected $casts = [
        'hours_spent' => 'decimal:2',
        'log_date' => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id', 'emp_id');
    }
}
