<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->string('name', 100);
            $key = $table->string('name_key', 100);
            if (DB::getDriverName() === 'mysql') $key->collation('utf8mb4_bin');
            $table->string('status', 16)->default('active');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->dateTime('ever_used_at')->nullable();
            $table->timestamps();
            $table->unique(['store_id', 'name_key']);
            $table->unique(['store_id', 'id']);
        });
        Schema::create('category_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            // Retain identity and snapshots even when a never-used category is deleted.
            $table->unsignedBigInteger('category_id')->index();
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 16);
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->dateTime('created_at');
        });
        Schema::create('category_mapping_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->unique()->constrained('products', 'product_id')->restrictOnDelete();
            $table->string('reason', 80);
            $table->dateTime('created_at');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('category_id')->nullable();
            $table->text('category_legacy')->nullable();
            $table->foreign(['store_id', 'category_id'], 'products_owned_category_foreign')
                ->references(['store_id', 'id'])->on('categories')->restrictOnDelete();
        });
        DB::table('products')->orderBy('product_id')->chunkById(100, function ($products) {
            foreach ($products as $product) {
                DB::transaction(function () use ($product) {
                    $raw = $product->category;
                    $name = trim(preg_replace('/[\p{Z}\s]+/u', ' ', $raw ?? '') ?? '');
                    DB::table('products')->where('product_id', $product->product_id)->update(['category_legacy' => $raw]);
                    $reason = !$product->store_id ? 'No unambiguous store owner' : ($name === '' ? 'Blank legacy category' :
                        (mb_strlen($name) > 100 || preg_match('/[\p{C}]/u', $name) ? 'Invalid legacy category name' : null));
                    if ($reason) {
                        DB::table('category_mapping_issues')->insert(['product_id' => $product->product_id, 'reason' => $reason, 'created_at' => now()]);
                        return;
                    }
                    $key = mb_convert_case($name, MB_CASE_FOLD, 'UTF-8');
                    $category = DB::table('categories')->where('store_id', $product->store_id)->where('name_key', $key)->first();
                    $id = $category?->id ?? DB::table('categories')->insertGetId(['store_id' => $product->store_id,
                        'name' => $name, 'name_key' => $key, 'status' => 'active', 'ever_used_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
                    DB::table('products')->where('product_id', $product->product_id)->update(['category_id' => $id, 'category' => $category?->name ?? $name]);
                });
            }
        }, 'product_id');
        // Keep current AI name filters aligned with the canonical backfilled label.
        // Existing setting audits and transaction snapshots remain untouched.
        DB::table('store_ai_recommendation_settings')->orderBy('id')->chunkById(100, function ($settings) {
            foreach ($settings as $setting) {
                $names = DB::table('categories')->where('store_id', $setting->store_id)->pluck('name', 'name_key');
                $updates = [];
                foreach (['included_categories', 'excluded_categories'] as $field) {
                    $values = json_decode($setting->$field ?? '[]', true) ?? [];
                    $updates[$field] = json_encode(array_values(array_unique(array_map(function ($value) use ($names) {
                        $key = mb_convert_case(trim(preg_replace('/[\p{Z}\s]+/u', ' ', $value) ?? ''), MB_CASE_FOLD, 'UTF-8');
                        return $names[$key] ?? $value;
                    }, $values))));
                }
                DB::table('store_ai_recommendation_settings')->where('id', $setting->id)->update($updates);
            }
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Category identities and legacy mapping evidence must be preserved.');
    }
};
