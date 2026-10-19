<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pickup_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders', 'order_id')->restrictOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->string('pin_hash');
            $table->text('secret_payload');
            $table->dateTime('expires_at');
            $table->dateTime('consumed_at')->nullable();
            $table->dateTime('revoked_at')->nullable();
            $table->string('revocation_reason', 250)->nullable();
            $table->timestamps();
        });
        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('confirmed_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('method', 40);
            $table->enum('verification_source', ['cashier', 'provider']);
            $table->string('provider', 80)->nullable();
            $table->string('provider_reference', 150)->nullable();
            $table->unsignedBigInteger('amount_centavos');
            $table->string('cashier_name', 150)->nullable();
            $table->string('evidence_type', 80);
            $table->text('evidence_reference');
            $table->dateTime('confirmed_at');
            $table->timestamps();
            $table->unique(['provider', 'provider_reference']);
        });
        Schema::create('pickup_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('pickup_credential_id')->unique()->constrained('pickup_credentials')->restrictOnDelete();
            $table->foreignId('verified_by_user_id')->constrained('users')->restrictOnDelete();
            $table->enum('method', ['pin', 'qr']);
            $table->string('claimant_name', 150);
            $table->text('claimant_check_note')->nullable();
            $table->dateTime('verified_at');
            $table->timestamps();
        });
        Schema::create('order_handovers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('order_payment_id')->unique()->constrained('order_payments')->restrictOnDelete();
            $table->foreignId('pickup_verification_id')->unique()->constrained('pickup_verifications')->restrictOnDelete();
            $table->foreignId('handed_over_by_user_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('handed_over_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_handovers');
        Schema::dropIfExists('pickup_verifications');
        Schema::dropIfExists('order_payments');
        Schema::dropIfExists('pickup_credentials');
    }
};
