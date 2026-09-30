<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FeedbackQuestion extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'feedback_questions';

    protected $fillable = [
        'category',
        'text',
        'response_type',
        'options',
        'is_enabled',
        'order_position',
        'is_default',
    ];

    protected $casts = [
        'options'        => 'array',
        'is_enabled'     => 'boolean',
        'is_default'     => 'boolean',
        'order_position' => 'integer',
        'deleted_at'     => 'datetime',
    ];

    /**
     * Format model attributes for clean API consumption by React frontend.
     */
    public function toApiResponse(): array
    {
        return [
            'id'            => (string) $this->id,
            'category'      => $this->category,
            'text'          => $this->text,
            'responseType'  => $this->response_type,
            'options'       => $this->options ?? ($this->response_type === 'Multiple Choice' ? ['Yes', 'No'] : null),
            'isEnabled'     => (bool) $this->is_enabled,
            'orderPosition' => (int) $this->order_position,
            'isDefault'     => (bool) $this->is_default,
            'createdAt'     => $this->created_at?->toIso8601String(),
            'updatedAt'     => $this->updated_at?->toIso8601String(),
        ];
    }
}
