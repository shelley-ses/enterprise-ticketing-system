<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SlaRule extends Model
{
    use HasFactory;

    protected $table = 'sla_rules';

    protected $fillable = [
        'department_id',
        'category_id',
        'priority',
        'response_time_limit',
        'resolution_time_limit',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'id');
    }

    public function category()
    {
        return $this->belongsTo(ProblemCategory::class, 'category_id', 'problem_category_ID');
    }
}
