<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_policies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('product_id');
            $table->unsignedInteger('max_per_order');
            $table->unsignedInteger('low_stock_threshold')->default(0);
            $table->boolean('enabled')->default(true);
            $table->timestamps();
            $table->unique(['store_id', 'product_id']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('stock_policies');
    }
};
