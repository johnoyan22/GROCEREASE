<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('profiles', function (Blueprint $table) {
            $table->id('profile_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->unique();
            $table->string('phone_number', 20);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('profiles');
    }
};