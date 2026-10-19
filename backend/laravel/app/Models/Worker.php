<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Store personnel only. This is not an authentication model and has no credentials.
class Worker extends Model
{
    protected $primaryKey = 'worker_id';
    protected $fillable = ['store_id', 'full_name', 'work_type', 'status', 'created_by_user_id', 'updated_by_user_id'];

    public function assignments(): HasMany
    {
        return $this->hasMany(WorkerAssignment::class, 'worker_id', 'worker_id');
    }
}
