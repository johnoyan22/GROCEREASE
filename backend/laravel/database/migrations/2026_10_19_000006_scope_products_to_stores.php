<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        $sqlite = Schema::getConnection()->getDriverName() === 'sqlite';

        if ($sqlite) {
            Schema::disableForeignKeyConstraints();
            try {
                DB::transaction(function () {
                    $this->applyOwnership(true);
                    if (DB::select('PRAGMA foreign_key_check') !== []) {
                        throw new RuntimeException('Product ownership migration found invalid references.');
                    }
                });
            } finally {
                Schema::enableForeignKeyConstraints();
            }
        } else {
            $this->applyOwnership(false);
        }
    }

    private function applyOwnership(bool $sqlite): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Nullable only to retain legacy products that have no known store.
            // Store APIs never expose these unassigned legacy records.
            $table->foreignId('store_id')->nullable()
                ->constrained('stores', 'store_id')->restrictOnDelete();
            $table->dropUnique('products_sku_unique');
            $table->unique(['store_id', 'sku'], 'products_store_sku_unique');
            $table->unique(['store_id', 'product_id'], 'products_store_product_unique');
        });

        DB::transaction(function () {
            DB::table('products')->orderBy('product_id')->chunkById(100, function ($products) {
                foreach ($products as $product) {
                    $stores = DB::table('store_inventory')
                        ->where('product_id', $product->product_id)
                        ->distinct()->orderBy('store_id')->pluck('store_id');

                    if ($stores->isEmpty()) {
                        continue; // Preserve unassigned legacy records without guessing an owner.
                    }

                    DB::table('products')->where('product_id', $product->product_id)
                        ->update(['store_id' => $stores->first()]);

                    foreach ($stores->skip(1) as $storeId) {
                        // Previously shared identities become independent store-owned copies.
                        $copy = (array) $product;
                        unset($copy['product_id']);
                        $copy['store_id'] = $storeId;
                        $id = DB::table('products')->insertGetId($copy, 'product_id');
                        DB::table('store_inventory')->where('store_id', $storeId)
                            ->where('product_id', $product->product_id)
                            ->update(['product_id' => $id]);
                    }
                }
            }, 'product_id');
        });

        if ($sqlite) {
            // Rebuild explicitly so SQLite retains the existing numeric CHECKs.
            Schema::create('store_inventory_owned', function (Blueprint $table) {
                $table->id('store_inventory_id');
                $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
                $table->unsignedBigInteger('product_id');
                $table->rawColumn('selling_price', 'decimal(10, 2) CHECK (selling_price >= 0)');
                $table->rawColumn('hard_stock_qty', 'integer CHECK (hard_stock_qty >= 0)')->default(0);
                $table->rawColumn('soft_stock_qty', 'integer CHECK (soft_stock_qty >= 0)')->default(0);
                $table->enum('status', ['active', 'inactive'])->default('inactive');
                $table->timestamps();
                $table->foreign(['store_id', 'product_id'], 'store_inventory_owned_product_foreign')
                    ->references(['store_id', 'product_id'])->on('products')->restrictOnDelete();
            });

            DB::statement('INSERT INTO store_inventory_owned
                (store_inventory_id, store_id, product_id, selling_price, hard_stock_qty,
                 soft_stock_qty, status, created_at, updated_at)
                SELECT store_inventory_id, store_id, product_id, selling_price, hard_stock_qty,
                       soft_stock_qty, status, created_at, updated_at FROM store_inventory');
            Schema::drop('store_inventory');
            Schema::rename('store_inventory_owned', 'store_inventory');
            Schema::table('store_inventory', function (Blueprint $table) {
                $table->unique(['store_id', 'product_id'], 'store_inventory_store_product_unique');
                $table->index(['store_id', 'status']);
                $table->index('product_id');
            });
        } else {
            Schema::table('store_inventory', function (Blueprint $table) {
                $table->foreign(['store_id', 'product_id'], 'store_inventory_owned_product_foreign')
                    ->references(['store_id', 'product_id'])->on('products')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        throw new RuntimeException(
            'Store-owned products cannot be merged back into a shared catalog automatically. Restore an approved backup instead.'
        );
    }
};
