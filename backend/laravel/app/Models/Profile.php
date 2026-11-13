<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Profile extends Model
{
    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        return $this->imagesrc && str_starts_with($this->imagesrc, 'profile-photos/')
            ? url('/api/shopper/profile/photo').'?v='.rawurlencode(basename($this->imagesrc)) : null;
    }

    protected $primaryKey = 'profile_id';

    protected $fillable = [
        'first_name',
        'last_name',
        'phone_number',
        'address',
        'imagesrc',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
