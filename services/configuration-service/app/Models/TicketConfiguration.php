<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketConfiguration extends Model
{
    use HasFactory;

    protected $table = 'ticket_configurations';

    protected $fillable = [
        'key',
        'value',
    ];

    protected $casts = [
        'value' => 'array',
    ];

    /**
     * Get a configuration value by key or return fallback default.
     */
    public static function getByKey(string $key, mixed $default = null): mixed
    {
        $record = static::where('key', $key)->first();
        return $record ? $record->value : $default;
    }

    /**
     * Set a configuration value by key.
     */
    public static function setByKey(string $key, mixed $value): static
    {
        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );
    }
}
