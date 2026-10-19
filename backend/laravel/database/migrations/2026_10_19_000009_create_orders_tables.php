<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id('order_id');
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('shopper_user_id')->constrained('users')->restrictOnDelete();
            $table->string('store_name', 100);
            $table->string('store_address', 255);
            $table->string('shopper_name', 255);
            $table->enum('status', ['waiting', 'preparing', 'ready_for_pickup', 'completed', 'canceled'])->default('waiting');
            $table->enum('payment_method', ['cash_on_pickup', 'digital'])->default('cash_on_pickup');
            $table->enum('payment_status', ['unpaid', 'paid'])->default('unpaid');
            $table->enum('reservation_status', ['active', 'released', 'fulfilled'])->default('active');
            $table->unsignedInteger('subtotal_centavos');
            $table->unsignedInteger('service_fee_centavos')->default(0);
            $table->unsignedInteger('total_centavos');
            $table->string('service_fee_policy', 64);
            $table->char('currency', 3)->default('PHP');
            $table->uuid('idempotency_key');
            $table->char('request_hash', 64);
            $table->dateTime('canceled_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['shopper_user_id', 'idempotency_key'], 'orders_shopper_idempotency_unique');
            $table->unique(['store_id', 'order_id'], 'orders_store_identity_unique');
            $table->index(['store_id', 'status', 'order_id']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id('order_item_id');
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('store_inventory_id');
            $table->string('product_name', 255);
            $table->string('sku', 64);
            $table->string('size', 100)->nullable();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price_centavos');
            $table->unsignedInteger('line_total_centavos');
            $table->timestamps();
            $table->foreign(['store_id', 'order_id'], 'items_order_store_foreign')
                ->references(['store_id', 'order_id'])->on('orders')->restrictOnDelete();
            $table->foreign(['store_id', 'store_inventory_id'], 'items_inventory_store_foreign')
                ->references(['store_id', 'store_inventory_id'])->on('store_inventory')->restrictOnDelete();
            $table->unique(['order_id', 'store_inventory_id']);
        });

        Schema::create('order_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->enum('previous_status', ['waiting', 'preparing', 'ready_for_pickup', 'completed', 'canceled'])->nullable();
            $table->enum('new_status', ['waiting', 'preparing', 'ready_for_pickup', 'completed', 'canceled']);
            $table->string('note', 500)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_history');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
