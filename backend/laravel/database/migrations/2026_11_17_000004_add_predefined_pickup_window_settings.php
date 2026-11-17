<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->unsignedSmallInteger('pickup_preparation_minutes')->default(60);
            $table->unsignedSmallInteger('pickup_window_minutes')->default(60);
        });
    }

    public function down(): void
    {
        Schema::table('stores', fn (Blueprint $table) => $table->dropColumn(['pickup_preparation_minutes', 'pickup_window_minutes']));
    }
};
