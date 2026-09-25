<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EscalationRule extends Model
{
    use HasFactory;

    protected $table = 'escalation_rules';

    protected $fillable = [
        'name',
        'is_active',
        'trigger',
        'condition_text',
        'condition_highlight',
        'action',
        'notify',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
