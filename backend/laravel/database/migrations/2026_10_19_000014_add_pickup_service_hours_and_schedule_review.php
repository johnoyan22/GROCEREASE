<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->json('pickup_service_hours')->nullable();
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('pickup_schedule_review_required')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('pickup_schedule_review_required');
        });
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('pickup_service_hours');
        });
    }
};
