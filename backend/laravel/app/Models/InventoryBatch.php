<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryBatch extends Model
{
    use \App\Models\Concerns\HasReceiptDates;
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['quantity_received' => 'integer', 'remaining_quantity' => 'integer', 'received_date' => 'date:Y-m-d', 'expiry_date' => 'date:Y-m-d'];
    }

    public function eligible(): bool
    {
        return $this->status === 'active' && (!$this->expiry_date || $this->expiry_date->format('Y-m-d') >= now('Asia/Manila')->format('Y-m-d'));
    }

    public function publicData(): array
    {
        return [...$this->only(['id', 'reference', 'quantity_received', 'remaining_quantity', 'description', 'source']),
            'batch_no' => self::displayNumber($this->id, $this->reference),
            'received_date' => $this->received_date?->format('Y-m-d'), 'expiry_date' => $this->expiry_date?->format('Y-m-d'),
            'status' => $this->remaining_quantity === 0 ? 'depleted' : (!$this->eligible() && $this->status === 'active' ? 'expired' : $this->status)];
    }

    public static function displayNumber(int $id, ?string $reference): string
    {
        // Preserve saved references. Format opaque references using a permanent ID alias.
        return $reference && preg_match('/^B-\d+$/D', $reference)
            ? $reference : 'B-'.str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    }
}
