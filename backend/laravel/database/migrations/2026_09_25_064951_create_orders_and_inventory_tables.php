<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('orders', function (Blueprint $table) {
            $table->id('order_id');
            $table->foreignId('user_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->enum('order_status', ['Pending', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'])->default('Pending');
            $table->boolean('priority_order')->default(false);
            $table->decimal('priority_fee', 10, 2)->default(0.00);
            $table->timestamp('time_completion')->nullable();
            $table->enum('payment_type', ['Online', 'Debit', 'COP']);
            $table->string('pickup_window', 50);
            $table->string('verification_code', 20)->unique();
            $table->decimal('gross_amount', 10, 2);
            $table->decimal('service_fee', 10, 2); // 3% mandatory service fee
            $table->decimal('net_total', 10, 2);
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id('order_item_id');
            $table->foreignId('order_id')->constrained('orders', 'order_id')->onDelete('cascade');
            $table->foreignId('product_id')->constrained('products', 'product_id')->onDelete('cascade');
            $table->integer('qty_requested');
            $table->integer('qty_packed')->nullable();
            $table->timestamps();
        });

        Schema::create('worker_assignments', function (Blueprint $table) {
            $table->id('assignment_id');
            $table->foreignId('admin_id')->constrained('super_admins', 'admin_id')->onDelete('cascade'); // Delegating Supervisor
            $table->foreignId('worker_id')->constrained('workers', 'worker_id')->onDelete('cascade');
            $table->foreignId('order_id')->constrained('orders', 'order_id')->onDelete('cascade');
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('worker_assignments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};