<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Laravel\Sanctum\HasApiTokens;

class Client extends Model
{
    use HasFactory;
    use HasApiTokens;

    protected $fillable = [ 
        'client_name',
        'address',
        'contact_number',
        'email',
    ];

    protected $casts = [
        'status' => 'boolean',
    ];

    public function credential()
    {
        return $this->hasOne(ClientCredential::class, 'client_id');
    }
}
