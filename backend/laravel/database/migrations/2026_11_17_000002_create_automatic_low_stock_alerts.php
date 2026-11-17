<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('low_stock_episodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->foreignId('active_inventory_id')->nullable()->unique()->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->string('product_name', 255);
            $table->string('sku', 100);
            $table->string('selling_unit', 16)->nullable();
            $table->unsignedInteger('observed_physical_qty');
            $table->unsignedInteger('reorder_level');
            $table->unsignedBigInteger('stock_version');
            $table->string('opened_from', 40);
            $table->boolean('delivery_pending')->default(true)->index();
            $table->dateTime('started_at');
            $table->unsignedInteger('current_physical_qty');
            $table->unsignedInteger('current_reorder_level')->nullable();
            $table->dateTime('evaluated_at');
            $table->dateTime('closed_at')->nullable();
            $table->string('closure_reason', 40)->nullable();
            $table->index(['store_id', 'id']);
            $table->unique(['store_id', 'id']);
            $table->foreign(['store_id', 'store_inventory_id'], 'low_episode_owned_inventory')
                ->references(['store_id', 'store_inventory_id'])->on('store_inventory')->restrictOnDelete();
        });
        Schema::create('staff_low_stock_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('episode_id')->constrained('low_stock_episodes')->restrictOnDelete();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('delivered_at');
            $table->dateTime('read_at')->nullable();
            $table->unique(['episode_id', 'user_id']);
            $table->index(['user_id', 'store_id', 'id']);
            $table->foreign(['store_id', 'episode_id'], 'low_notification_owned_episode')
                ->references(['store_id', 'id'])->on('low_stock_episodes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Low-stock event and notification history must be preserved.');
    }
};
