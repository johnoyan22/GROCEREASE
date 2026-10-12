<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Check both structures before dropping either: MySQL DDL is not atomic.
        if (Schema::hasTable('phone_verifications')
            && DB::table('phone_verifications')->exists()) {
            throw new RuntimeException(
                'SMS OTP cleanup stopped: phone_verifications contains records. '
                .'Export the database and review those records before removing them.'
            );
        }

        if (Schema::hasColumn('profiles', 'phone_verified_at')
            && DB::table('profiles')->whereNotNull('phone_verified_at')->exists()) {
            throw new RuntimeException(
                'SMS OTP cleanup stopped: profiles contains verified phone dates. '
                .'Export the database and review those values before removing them.'
            );
        }

        Schema::dropIfExists('phone_verifications');

        if (Schema::hasColumn('profiles', 'phone_verified_at')) {
            Schema::table('profiles', function (Blueprint $table) {
                $table->dropColumn('phone_verified_at');
            });
        }
    }

    public function down(): void
    {
        // Rollback restores the old schema, not deleted data or PHP classes.
        if (! Schema::hasTable('phone_verifications')) {
            Schema::create('phone_verifications', function (Blueprint $table) {
                $table->id();
                $table->string('phone_number', 16)->index();
                $table->string('code_hash');
                $table->dateTime('expires_at');
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->dateTime('last_sent_at');
                $table->dateTime('consumed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasColumn('profiles', 'phone_verified_at')) {
            Schema::table('profiles', function (Blueprint $table) {
                $table->timestamp('phone_verified_at')->nullable();
            });
        }
    }
};
