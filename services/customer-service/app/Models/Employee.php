<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Employee extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;

    protected $table = 'employees';
    protected $primaryKey = 'emp_id';
    public $timestamps = false;

    protected $fillable = [
        'email',
        'password_hash',
        'first_name',
        'last_name',
        'role',
        'department',
        'failed_login_count',
        'locked_until',
        'last_login_at',
        'password_change_at',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'failed_login_count' => 'integer',
        'locked_until' => 'datetime',
        'last_login_at' => 'datetime',
        'password_change_at' => 'datetime',
    ];

    public function getAuthPassword()
    {
        return $this->password_hash;
    }
}