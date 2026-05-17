<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefreshToken extends Model
{
    protected $table = 'refresh_tokens';

    protected $fillable = [
        'client_id',
        'token_hash',
        'expires_at',
    ];

    protected $dates = [
        'expires_at',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
