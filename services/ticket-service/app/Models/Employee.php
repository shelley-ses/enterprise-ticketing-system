<?php

namespace App\Models;

class Employee extends User
{
    protected $table = 'employees';
    protected $primaryKey = 'emp_id';
}