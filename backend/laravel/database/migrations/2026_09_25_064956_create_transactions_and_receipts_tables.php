<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id('transaction_id');
            $table->foreignId('order_id')->constrained('orders', 'order_id')->onDelete('cascade');
            $table->foreignId('assignment_id')->nullable()->constrained('worker_assignments', 'assignment_id')->nullOnDelete();
            $table->decimal('amount_paid', 10, 2);
            $table->enum('payment_mode', ['Online', 'Debit', 'COP']);
            $table->timestamp('settled_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('digital_receipts', function (Blueprint $table) {
            $table->id('receipt_id');
            $table->foreignId('transaction_id')->constrained('transactions', 'transaction_id')->onDelete('cascade');
            $table->timestamp('generated_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('pickup_verifications', function (Blueprint $table) {
            $table->id('verification_id');
            $table->foreignId('transaction_id')->constrained('transactions', 'transaction_id')->onDelete('cascade');
            $table->timestamp('verified_at')->useCurrent();
            $table->enum('verification_method', ['QR Code', 'Pickup Code']);
            $table->timestamps();
        });

        Schema::create('return_requests', function (Blueprint $table) {
            $table->id('return_id');
            $table->foreignId('order_id')->constrained('orders', 'order_id')->onDelete('cascade');
            $table->foreignId('receipt_id')->constrained('digital_receipts', 'receipt_id')->onDelete('cascade');
            $table->enum('request_status', ['Pending', 'Approved', 'Rejected', 'Resolved'])->default('Pending');
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('return_requests');
        Schema::dropIfExists('pickup_verifications');
        Schema::dropIfExists('digital_receipts');
        Schema::dropIfExists('transactions');
    }
};