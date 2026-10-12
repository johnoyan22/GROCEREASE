<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order; // Ensure you have an Order model and migration

class OrderController extends Controller {
    public function index() {
        return response()->json(Order::with('items')->latest()->get());
    }

    public function store(Request $request) {
        $order = Order::create([
            'subtotal' => $request->subtotal,
            'service_charge' => $request->service_charge,
            'total' => $request->total,
            'payment_method' => $request->payment_method,
            'status' => $request->status ?? 'To pay'
        ]);

        foreach ($request->items as $item) {
            $order->items()->create([
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'price' => $item['price']
            ]);
        }

        return response()->json(['message' => 'Order created successfully', 'order' => $order]);
    }

    public function pay($id) {
        $order = Order::findOrFail($id);
        $order->update(['status' => 'Successful']);
        return response()->json(['message' => 'Order paid successfully']);
    }
}