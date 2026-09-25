<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Message extends Model
{
    protected $connection = 'mongodb';
    protected $collection = 'messages';

    protected $fillable = [
        'ticket_id',
        'sender_id',
        'sender_name',
        'sender_type', // 'customer', 'employee', 'cs'
        'message',
        'edit_history',
        'deleted_by',
    ];

    /**
     * The "booted" method of the model.
     */
    protected static function booted()
    {
        try {
            self::raw(function ($collection) {
                $collection->createIndex(['ticket_id' => 1]);
                $collection->createIndex(['created_at' => -1]);
            });
        } catch (\Exception $e) {
            // Ignore index creation errors to prevent blocking runtime if connection issues occur during boot
        }
    }
}
