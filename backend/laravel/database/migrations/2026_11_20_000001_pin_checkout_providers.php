<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_checkout_attempts', function (Blueprint $t) {
            // Every existing row was created by the PayMongo path. Never infer this from current env.
            $t->string('provider', 20)->default('paymongo');
            $t->string('provider_reference', 64)->nullable()->unique();
            $t->string('provider_request_id', 100)->nullable();
            $t->string('provider_capture_id', 100)->nullable()->unique();
            $t->timestamp('verified_at')->nullable();
            $t->json('verified_evidence')->nullable();
            $t->json('observed_request_ids')->nullable();
        });
        Schema::create('xendit_session_events', function (Blueprint $t) {
            $t->char('id', 64)->primary();
            $t->uuid('attempt_id'); $t->foreign('attempt_id')->references('id')->on('payment_checkout_attempts')->restrictOnDelete();
            $t->string('topic', 40); $t->string('session_id', 100); $t->string('request_id', 100)->nullable(); $t->string('payment_id', 100)->nullable();
            $t->string('status', 20)->default('pending'); $t->string('last_error', 40)->nullable();
            $t->timestamp('received_at'); $t->timestamp('processed_at')->nullable();
            $t->index(['status', 'received_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('xendit_session_events');
        Schema::table('payment_checkout_attempts', fn (Blueprint $t) => $t->dropColumn(['provider', 'provider_reference', 'provider_request_id', 'provider_capture_id', 'verified_at', 'verified_evidence', 'observed_request_ids']));
    }
};
