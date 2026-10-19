<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workers', function (Blueprint $table) {
            $table->id('worker_id');
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->string('full_name', 150);
            $table->enum('work_type', ['picker', 'packer', 'picker_packer'])->default('picker_packer');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['store_id', 'worker_id'], 'workers_store_identity_unique');
        });

        Schema::create('worker_assignments', function (Blueprint $table) {
            $table->id('assignment_id');
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('worker_id');
            $table->string('worker_name', 150);
            $table->enum('task_type', ['picking', 'packing', 'picking_packing']);
            $table->enum('status', ['assigned', 'completed', 'canceled'])->default('assigned');
            $table->foreignId('assigned_by_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('completed_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('canceled_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->dateTime('assigned_at');
            $table->dateTime('completed_at')->nullable();
            $table->dateTime('canceled_at')->nullable();
            $table->string('completion_note', 500)->nullable();
            $table->string('cancellation_reason', 500)->nullable();
            $table->timestamps();
            $table->foreign(['store_id', 'worker_id'], 'assignments_worker_store_foreign')
                ->references(['store_id', 'worker_id'])->on('workers')->restrictOnDelete();
            $table->foreign(['store_id', 'order_id'], 'assignments_order_store_foreign')
                ->references(['store_id', 'order_id'])->on('orders')->restrictOnDelete();
            $table->index(['store_id', 'order_id', 'status']);
            $table->index(['store_id', 'worker_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_assignments');
        Schema::dropIfExists('workers');
    }
};
