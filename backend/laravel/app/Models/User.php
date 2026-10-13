<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }

    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class, 'user_id', 'id');
    }

    public function accountData(): array
    {
        $this->loadMissing(['role', 'profile']);

        if ($this->role && $this->role->slug === 'supervisor') {
            $profileData = null;
        
            if ($this->profile) {
                $profileData = [
                    'first_name' => $this->profile->first_name,
                    'last_name' => $this->profile->last_name,
                    'phone_number' => $this->profile->phone_number,
                ];
            }

            return [
                'id' => $this->id,
                'email' => $this->email,
                'role' => ['name' => $this->role->name, 'slug' => $this->role->slug,],
                'profile' => $profileData,
            ];

        }

        $data = $this->toArray();
        if ($this->role && $this->role->slug === 'inventory_worker') {
            unset($data['email_verified_at']);
        }

        return $data;
    }
}
