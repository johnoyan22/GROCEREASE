<?php

namespace App\Models\Concerns;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Casts\Attribute;

trait HasReceiptDates
{
    // Keep SQL DATE values date-only on SQLite as well as MariaDB; timestamps retain their time.
    protected function receivedDate(): Attribute
    {
        return Attribute::make(set: fn ($value) => $value === null ? null : Carbon::parse($value)->format('Y-m-d'));
    }

    protected function expiryDate(): Attribute
    {
        return Attribute::make(set: fn ($value) => $value === null ? null : Carbon::parse($value)->format('Y-m-d'));
    }
}
