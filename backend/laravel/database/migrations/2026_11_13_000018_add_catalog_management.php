<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->string('name', 100);
            $table->string('name_key', 100);
            $table->boolean('active')->default(true);
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['store_id', 'name_key']);
            $table->unique(['store_id', 'id']);
        });
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('category_id')->nullable();
            $table->foreign(['store_id', 'category_id'])->references(['store_id', 'id'])->on('store_categories')->restrictOnDelete();
            $table->string('selling_unit', 30)->nullable();
            $table->string('image_path')->nullable();
        });
        Schema::table('order_items', function (Blueprint $table) {
            // Null means legacy unspecified; never guess historical selling units.
            $table->string('selling_unit', 30)->nullable();
        });
        Schema::create('product_price_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->restrictOnDelete();
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->decimal('old_price', 10, 2);
            $table->decimal('new_price', 10, 2);
            $table->timestamp('created_at');
        });
        Schema::create('category_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('store_categories')->restrictOnDelete();
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->text('before')->nullable();
            $table->text('after');
            $table->timestamp('created_at');
        });
        // Populate only the new relationship. Old names, SKUs, prices and counts remain untouched.
        DB::table('products')->whereNotNull('store_id')->orderBy('product_id')->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                $name = trim($row->category);
                if ($name === '') continue;
                $key = mb_strtolower($name);
                $category = DB::table('store_categories')->where('store_id', $row->store_id)->where('name_key', $key)->first();
                $id = $category?->id ?? DB::table('store_categories')->insertGetId([
                    'store_id' => $row->store_id, 'name' => $name, 'name_key' => $key, 'active' => true,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('products')->where('product_id', $row->product_id)->update(['category_id' => $id]);
            }
        }, 'product_id');
    }

    public function down(): void
    {
        Schema::dropIfExists('category_audits');
        Schema::dropIfExists('product_price_changes');
        Schema::table('order_items', fn (Blueprint $table) => $table->dropColumn('selling_unit'));
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['store_id', 'category_id']);
            $table->dropColumn(['category_id', 'selling_unit', 'image_path']);
        });
        Schema::dropIfExists('store_categories');
    }
};
