<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Passport\HasApiTokens;

class Client extends Authenticatable
{
    use HasFactory;
    use HasApiTokens;

    protected $table = 'clients';

    protected $fillable = [
        'client_name',
        'address',
        'contact_number',
        'email',
    ];
}
