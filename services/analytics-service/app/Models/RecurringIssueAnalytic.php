<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecurringIssueAnalytic extends Model
{
    protected $table = 'recurring_issue_analytics';

    protected $fillable = [
        'category', 'period', 'frequency', 'growth_pct', 'severity',
    ];
}
