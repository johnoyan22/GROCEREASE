<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('stores', function (Blueprint $table) {
            $table->id('store_id');
            $table->foreignId('admin_id')->constrained('super_admins', 'admin_id')->onDelete('cascade');
            $table->foreignId('owner_id')->constrained('owners', 'owner_id')->onDelete('cascade');
            $table->string('store_name', 100);
            $table->string('address', 255);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id('product_id');
            $table->string('product_name', 100);
            $table->string('category', 50);
            $table->decimal('base_cost', 10, 2);
            $table->timestamps();
        });

        Schema::create('store_inventory', function (Blueprint $table) {
            $table->id('store_inventory_id');
            $table->foreignId('store_id')->constrained('stores', 'store_id')->onDelete('cascade');
            $table->foreignId('product_id')->constrained('products', 'product_id')->onDelete('cascade');
            $table->decimal('selling_price', 10, 2);
            $table->integer('soft_stock_qty')->default(0); // Reserved stock during checkout/order queue
            $table->integer('hard_stock_qty')->default(0); // Physical verified on-shelf stock
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('store_inventory');
        Schema::dropIfExists('products');
        Schema::dropIfExists('stores');
    }
};