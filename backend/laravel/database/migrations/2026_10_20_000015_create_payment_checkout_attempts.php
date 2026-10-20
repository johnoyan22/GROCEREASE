<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_checkout_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->string('merchant_id', 100);
            $table->char('credential_fingerprint', 64);
            $table->string('mode', 10)->default('test');
            $table->unsignedInteger('amount_centavos');
            $table->char('currency', 3)->default('PHP');
            $table->json('channels');
            $table->string('status', 40)->default('pending');
            $table->string('provider_session_id', 100)->nullable()->unique();
            $table->text('checkout_url')->nullable(); // Encrypted model cast; never log this URL.
            $table->string('provider_payment_id', 100)->nullable()->unique();
            $table->string('last_error', 100)->nullable(); // Only local codes, never provider payloads.
            $table->dateTime('expires_at');
            $table->dateTime('expired_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'expires_at']);
        });
        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider_event_id', 100)->unique();
            $table->uuid('attempt_id');
            $table->foreign('attempt_id')->references('id')->on('payment_checkout_attempts')->restrictOnDelete();
            $table->char('body_hash', 64);
            $table->dateTime('received_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payment_checkout_attempts');
    }
};
