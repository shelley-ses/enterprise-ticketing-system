<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RootCauseAnalytic extends Model
{
    protected $table = 'root_cause_analytics';

    protected $fillable = [
        'cause_name', 'period', 'percentage', 'ticket_count', 'trend',
    ];
}
