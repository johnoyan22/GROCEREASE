<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->string('batch_reference', 100);
            $table->date('received_date');
            $table->date('expiration_date')->nullable();
            $table->unsignedInteger('quantity_received');
            $table->unsignedInteger('remaining_qty');
            $table->string('status', 20)->default('available');
            $table->foreignId('received_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['store_id', 'store_inventory_id', 'batch_reference'], 'batch_store_inventory_reference_unique');
        });
        Schema::create('stock_receiving_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->foreignId('batch_id')->nullable()->constrained('stock_batches')->restrictOnDelete();
            $table->string('kind', 20)->default('receive');
            $table->string('batch_reference', 100);
            $table->date('received_date');
            $table->date('expiration_date')->nullable();
            $table->unsignedInteger('quantity');
            $table->text('description');
            $table->string('status', 20)->default('pending');
            $table->foreignId('requested_by_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('decision_note')->nullable();
            $table->unsignedInteger('hard_stock_before')->nullable();
            $table->unsignedInteger('hard_stock_after')->nullable();
            $table->dateTime('decided_at')->nullable();
            $table->timestamps();
            // Rejected deliveries need a corrected new reference, preventing accidental reimport.
            $table->unique(['store_id', 'store_inventory_id', 'batch_reference', 'kind'], 'receiving_request_duplicate_guard');
        });
        Schema::create('stock_batch_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('stock_batches')->restrictOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->string('event', 30);
            $table->unsignedInteger('quantity')->default(0);
            $table->text('description');
            $table->dateTime('created_at');
        });
        Schema::create('stock_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->string('product_name');
            $table->integer('available_qty');
            $table->unsignedInteger('reorder_level');
            $table->dateTime('recovered_at')->nullable();
            $table->dateTime('created_at');
        });
        Schema::create('stock_alert_states', function (Blueprint $table) {
            $table->foreignId('store_inventory_id')->primary()->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->foreignId('current_alert_id')->nullable()->constrained('stock_alerts')->restrictOnDelete();
        });
        Schema::create('stock_alert_acknowledgements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained('stock_alerts')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('read_at');
            $table->unique(['alert_id', 'user_id']);
        });
    }

    public function down(): void
    {
        foreach (['stock_alert_acknowledgements', 'stock_alert_states', 'stock_alerts', 'stock_batch_events', 'stock_receiving_requests', 'stock_batches'] as $table) Schema::dropIfExists($table);
    }
};
