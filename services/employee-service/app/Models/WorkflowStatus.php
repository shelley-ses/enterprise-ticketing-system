<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkflowStatus extends Model
{
    use HasFactory;

    protected $table = 'workflow_statuses';

    protected $fillable = [
        'name',
        'description',
        'bg_color',
        'text_color',
        'order_position',
    ];
}
