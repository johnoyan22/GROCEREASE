<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id('product_id');
            $table->string('name');
            $table->string('sku')->unique();
            $table->string('barcode')->nullable();
            $table->string('size')->nullable(); // e.g., "5kg", "1L", "60g"
            $table->string('category');
            $table->decimal('base_cost', 10, 2);
            $table->decimal('selling_price', 10, 2);
            $table->integer('stock_quantity')->default(0);
            $table->string('status')->default('Active'); // Active, Low Stock, Out of Stock, Archived
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};