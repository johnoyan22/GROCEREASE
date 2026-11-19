<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_sku_sequences', function (Blueprint $table) {
            $table->id(); // Database allocation, never MAX+1; existing product IDs/SKUs stay intact.
        });
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('size_amount', 12, 4)->nullable();
            $table->string('size_unit', 2)->nullable();
            $table->string('selling_unit', 16)->nullable();
        });
        Schema::table('store_inventory', function (Blueprint $table) {
            $table->boolean('batches_initialized')->default(false);
        });
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('selling_unit', 16)->nullable(); // Historical snapshots remain unchanged.
        });
        Schema::create('stock_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->uuid('operation_id');
            $table->char('request_hash', 64);
            $table->unsignedInteger('quantity');
            $table->date('received_date');
            $table->date('expiry_date')->nullable();
            $table->text('description');
            $table->string('status', 16)->default('pending');
            $table->foreignId('requested_by_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('decision_note')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->unique(['store_id', 'operation_id']);
        });
        Schema::create('inventory_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->foreignId('stock_receipt_id')->nullable()->unique()->constrained('stock_receipts')->restrictOnDelete();
            $table->string('reference', 64)->unique();
            $table->unsignedInteger('quantity_received');
            $table->unsignedInteger('remaining_quantity');
            $table->date('received_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('status', 16)->default('active');
            $table->string('source', 20)->default('receipt');
            $table->text('description')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['store_inventory_id', 'expiry_date']);
        });
        Schema::create('order_batch_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained('order_items', 'order_item_id')->restrictOnDelete();
            $table->foreignId('inventory_batch_id')->constrained('inventory_batches')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('status', 16)->default('reserved');
            $table->timestamps();
            $table->unique(['order_item_id', 'inventory_batch_id']);
        });
        Schema::create('batch_correction_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_adjustment_id')->constrained('stock_adjustments')->restrictOnDelete();
            $table->foreignId('inventory_batch_id')->constrained('inventory_batches')->restrictOnDelete();
            $table->integer('quantity_change');
            $table->timestamps();
        });

        // Preserve the exact historical count. Unknown dates/units are deliberately not inferred.
        // Existing active reservations stay attached to that historical stock.
        DB::transaction(function () {
            DB::table('store_inventory')->orderBy('store_inventory_id')->chunkById(100, function ($items) {
                foreach ($items as $item) {
                    if ($item->hard_stock_qty > 0) {
                        $batch = DB::table('inventory_batches')->insertGetId([
                            'store_inventory_id' => $item->store_inventory_id,
                            'reference' => 'GE-HIST-'.$item->store_inventory_id,
                            'quantity_received' => $item->hard_stock_qty, 'remaining_quantity' => $item->hard_stock_qty,
                            'source' => 'historical', 'status' => 'active',
                            'description' => 'Historical stock; receipt and expiry dates unknown.',
                            'created_at' => now(), 'updated_at' => now(),
                        ]);
                        $lines = DB::table('order_items')->join('orders', 'orders.order_id', '=', 'order_items.order_id')
                            ->where('order_items.store_inventory_id', $item->store_inventory_id)
                            ->where('orders.reservation_status', 'active')->select('order_items.*')->get();
                        foreach ($lines as $line) {
                            DB::table('order_batch_allocations')->insert([
                                'order_item_id' => $line->order_item_id, 'inventory_batch_id' => $batch,
                                'quantity' => $line->quantity, 'status' => 'reserved', 'created_at' => now(), 'updated_at' => now(),
                            ]);
                        }
                    }
                    DB::table('store_inventory')->where('store_inventory_id', $item->store_inventory_id)->update(['batches_initialized' => true]);
                }
            }, 'store_inventory_id');
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Receiving history cannot be rolled back safely. Restore a verified backup instead.');
    }
};
