<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Shoppers
        Schema::create('grocer_users', function (Blueprint $table) {
            $table->id('user_id');
            $table->foreignId('profile_id')->constrained('profiles', 'profile_id')->onDelete('cascade');
            $table->string('password_hash');
            $table->string('address', 255)->nullable();
            $table->string('photo', 255)->nullable();
            $table->timestamp('date_created')->useCurrent();
            $table->timestamps();
        });

        // Supervisors and System Administrators
        Schema::create('super_admins', function (Blueprint $table) {
            $table->id('admin_id');
            $table->foreignId('profile_id')->constrained('profiles', 'profile_id')->onDelete('cascade');
            $table->string('password_hash');
            $table->enum('role_type', ['Admin', 'Supervisor'])->default('Supervisor');
            $table->timestamps();
        });

        // Store Owners
        Schema::create('owners', function (Blueprint $table) {
            $table->id('owner_id');
            $table->foreignId('profile_id')->constrained('profiles', 'profile_id')->onDelete('cascade');
            $table->string('business_permit_no', 50);
            $table->timestamps();
        });

        // Assigned Inventory Workers
        Schema::create('workers', function (Blueprint $table) {
            $table->id('worker_id');
            $table->foreignId('profile_id')->constrained('profiles', 'profile_id')->onDelete('cascade');
            $table->decimal('worker_incentives', 10, 2)->default(0.00);
            $table->integer('order_handled')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('workers');
        Schema::dropIfExists('owners');
        Schema::dropIfExists('super_admins');
        Schema::dropIfExists('grocer_users');
    }
};