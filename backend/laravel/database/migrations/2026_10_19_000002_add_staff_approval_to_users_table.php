<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('staff_approved_at')->nullable()->index();

            $table->foreignId('staff_approved_by_user_id')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('staff_approved_by_user_id');
            $table->dropIndex(['staff_approved_at']);
            $table->dropColumn('staff_approved_at');
        });
    }
};