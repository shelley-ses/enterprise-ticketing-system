<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EscalationRiskSnapshot extends Model
{
    protected $table = 'escalation_risk_snapshots';

    protected $fillable = [
        'period', 'low_count', 'medium_count', 'high_count',
        'critical_count', 'total_escalations', 'avg_resolution_time',
    ];
}
