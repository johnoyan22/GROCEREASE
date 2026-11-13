<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_invoice_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->unique()->constrained('stores', 'store_id')->restrictOnDelete();
            $table->string('registered_name')->nullable();
            $table->string('registered_address', 500)->nullable();
            $table->string('tin', 30)->nullable();
            $table->string('branch_code', 10)->nullable();
            $table->string('tax_registration', 20)->default('unconfirmed');
            $table->string('numbering_authority')->nullable();
            $table->text('review_notes')->nullable();
            $table->foreignId('updated_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
        Schema::create('order_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders', 'order_id')->restrictOnDelete();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->string('reference', 64)->unique();
            $table->string('document_type', 20)->default('pro_forma');
            $table->longText('snapshot');
            $table->foreignId('generated_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('generated_at');
        });
        Schema::create('invoice_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores', 'store_id')->restrictOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained('order_invoices')->restrictOnDelete();
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 40);
            $table->text('details')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_audits');
        Schema::dropIfExists('order_invoices');
        Schema::dropIfExists('store_invoice_settings');
    }
};
