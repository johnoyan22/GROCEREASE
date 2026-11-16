<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_adjustments', function (Blueprint $table) {
            // Null identifies preserved historical whole-product requests.
            $table->foreignId('inventory_batch_id')->nullable()->constrained('inventory_batches')->restrictOnDelete();
            // Only pending requests occupy this unique slot; decisions retain their history.
            $table->foreignId('pending_batch_id')->nullable()->unique()->constrained('inventory_batches')->restrictOnDelete();
            $table->uuid('operation_id')->nullable();
            $table->char('request_hash', 64)->nullable();
            $table->unsignedInteger('observed_remaining_quantity')->nullable();
            $table->unsignedInteger('requested_remaining_quantity')->nullable();
            $table->unsignedInteger('observed_allocated_quantity')->nullable();
            $table->json('batch_snapshot')->nullable();
            $table->unique(['store_id', 'operation_id']);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Batch correction evidence must be preserved. Restore a verified backup instead.');
    }
};
