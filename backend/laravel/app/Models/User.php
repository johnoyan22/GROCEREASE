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
    public const STAFF_ROLES = ['inventory_worker', 'supervisor'];

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
        'staff_approved_at',
        'staff_approved_by_user_id',
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
            'staff_approved_at' => 'datetime',
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

        public function staffApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_approved_by_user_id', 'id');
    }

    public function isApprovedStaff(): bool
    {
        return in_array($this->role?->slug, self::STAFF_ROLES, true)
            && $this->staff_approved_at !== null
            && $this->staff_approved_by_user_id !== null;
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

        public function staffStoreAssignment(): HasOne
    {
        return $this->hasOne(StaffStoreAssignment::class, 'user_id', 'id');
    }

    public function assignedStore(): ?Store
    {
        if (! $this->isApprovedStaff()) {
            return null;
        }

        // Resolve current placement even if an older relation was already loaded.
        return $this->staffStoreAssignment()
            ->with('store')
            ->whereHas('store', fn ($query) => $query->active())
            ->first()?->store;
    }
}
