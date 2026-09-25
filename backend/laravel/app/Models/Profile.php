<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    protected $primaryKey = 'profile_id';

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone_number',
    ];
}
