<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $sqlite = Schema::getConnection()->getDriverName() === 'sqlite';

        Schema::create('store_inventory', function (Blueprint $table) use ($sqlite) {
            $table->id('store_inventory_id');
            $table->foreignId('store_id')
                ->constrained('stores', 'store_id')
                ->restrictOnDelete();
            $table->foreignId('product_id')->index()
                ->constrained('products', 'product_id')
                ->restrictOnDelete();

            if ($sqlite) {
                // SQLite requires CHECK constraints during table creation.
                $table->rawColumn(
                    'selling_price',
                    'decimal(10, 2) CHECK (selling_price >= 0)'
                );
                $table->rawColumn(
                    'hard_stock_qty',
                    'integer CHECK (hard_stock_qty >= 0)'
                )->default(0);
                $table->rawColumn(
                    'soft_stock_qty',
                    'integer CHECK (soft_stock_qty >= 0)'
                )->default(0);
            } else {
                $table->decimal('selling_price', 10, 2);
                $table->integer('hard_stock_qty')->default(0);
                $table->integer('soft_stock_qty')->default(0);
            }

            $table->enum('status', ['active', 'inactive'])
                ->default('inactive');
            $table->timestamps();

            $table->unique(
                ['store_id', 'product_id'],
                'store_inventory_store_product_unique'
            );
            $table->index(['store_id', 'status']);
        });

        if (! $sqlite) {
            DB::statement('ALTER TABLE store_inventory
                ADD CONSTRAINT store_inventory_price_nonnegative CHECK (selling_price >= 0),
                ADD CONSTRAINT store_inventory_hard_nonnegative CHECK (hard_stock_qty >= 0),
                ADD CONSTRAINT store_inventory_soft_nonnegative CHECK (soft_stock_qty >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('store_inventory');
    }
};
