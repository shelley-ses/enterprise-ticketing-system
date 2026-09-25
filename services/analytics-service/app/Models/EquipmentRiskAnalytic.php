<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EquipmentRiskAnalytic extends Model
{
    protected $table = 'equipment_risk_analytics';

    protected $fillable = [
        'equipment_name', 'period', 'failure_rate_pct',
        'ticket_count', 'risk_level',
    ];
}
