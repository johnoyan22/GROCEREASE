<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\DB;

class OrderNotifications
{
    public function notify(Order $order, string $type, string $message): void
    {
        DB::table('order_notifications')->insertOrIgnore([
            'user_id' => $order->shopper_user_id, 'order_id' => $order->order_id,
            'type' => $type, 'message' => $message, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
