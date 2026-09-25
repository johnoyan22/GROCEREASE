<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->string('password_hash')->nullable()->after('profile_id');
        });

        // Preserve access for worker accounts created before passwords were stored.
        DB::table('workers')
            ->whereNull('password_hash')
            ->update(['password_hash' => Hash::make('password123')]);
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->dropColumn('password_hash');
        });
    }
};
