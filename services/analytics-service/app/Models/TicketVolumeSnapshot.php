<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketVolumeSnapshot extends Model
{
    protected $table = 'ticket_volume_snapshots';

    protected $fillable = [
        'period', 'historical', 'predicted', 'upper_bound', 'lower_bound',
        'predicted_total', 'peak_label',
    ];

    protected $casts = [
        'historical'   => 'array',
        'predicted'    => 'array',
        'upper_bound'  => 'array',
        'lower_bound'  => 'array',
    ];
}
