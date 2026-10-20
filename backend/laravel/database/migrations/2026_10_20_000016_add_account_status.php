<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('account_status', 10)->default('active');
        });
        Schema::create('account_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('previous_status', 10);
            $table->string('new_status', 10);
            $table->string('reason', 500);
            $table->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('account_status_logs');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('account_status'));
    }
};
