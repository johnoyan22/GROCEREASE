<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_inventory', function (Blueprint $table) {
            $table->unique(['store_id', 'store_inventory_id'], 'store_inventory_store_identity_unique');
        });

        Schema::create('inventory_availability_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('store_inventory_id');
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->enum('previous_status', ['active', 'inactive'])->nullable();
            $table->enum('new_status', ['active', 'inactive']);
            $table->timestamps();
            $table->foreign(['store_id', 'store_inventory_id'], 'availability_inventory_store_foreign')
                ->references(['store_id', 'store_inventory_id'])->on('store_inventory')->restrictOnDelete();
            $table->index(['store_id', 'id']);
        });

        Schema::create('low_stock_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('store_inventory_id');
            $table->foreignId('reported_by_user_id')->constrained('users')->restrictOnDelete();
            $table->text('note');
            $table->unsignedInteger('observed_hard_stock_qty');
            $table->unsignedInteger('observed_soft_stock_qty');
            $table->timestamps();
            $table->foreign(['store_id', 'store_inventory_id'], 'reports_inventory_store_foreign')
                ->references(['store_id', 'store_inventory_id'])->on('store_inventory')->restrictOnDelete();
            $table->index(['store_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('low_stock_reports');
        Schema::dropIfExists('inventory_availability_logs');
        Schema::table('store_inventory', function (Blueprint $table) {
            $table->dropUnique('store_inventory_store_identity_unique');
        });
    }
};
