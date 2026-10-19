<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkerAssignment extends Model
{
    protected $primaryKey = 'assignment_id';
    protected $fillable = [
        'store_id', 'order_id', 'worker_id', 'worker_name', 'task_type', 'status',
        'assigned_by_user_id', 'completed_by_user_id', 'canceled_by_user_id',
        'assigned_at', 'completed_at', 'canceled_at', 'completion_note', 'cancellation_reason',
    ];

    protected function casts(): array
    {
        return ['assigned_at' => 'datetime', 'completed_at' => 'datetime', 'canceled_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id', 'order_id');
    }
}
