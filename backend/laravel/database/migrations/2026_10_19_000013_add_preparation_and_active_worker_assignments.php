<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedInteger('prepared_qty')->default(0);
            $table->foreignId('prepared_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->dateTime('prepared_at')->nullable();
        });
        Schema::create('active_worker_assignments', function (Blueprint $table) {
            $table->unsignedBigInteger('worker_id')->primary();
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('order_id')->unique();
            $table->foreignId('assignment_id')->unique()->constrained('worker_assignments', 'assignment_id')->restrictOnDelete();
            $table->foreign(['store_id', 'worker_id'])->references(['store_id', 'worker_id'])->on('workers')->restrictOnDelete();
            $table->foreign(['store_id', 'order_id'])->references(['store_id', 'order_id'])->on('orders')->restrictOnDelete();
        });
        Schema::create('order_preparation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained('order_items', 'order_item_id')->restrictOnDelete();
            $table->foreignId('recorded_by_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('previous_qty');
            $table->unsignedInteger('prepared_qty');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_preparation_logs');
        Schema::dropIfExists('active_worker_assignments');
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['prepared_by_user_id']);
            $table->dropColumn(['prepared_qty', 'prepared_by_user_id', 'prepared_at']);
        });
    }
};
