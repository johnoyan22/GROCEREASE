<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('cop_restrictions', function (Blueprint $table) {
            $table->id('restriction_id');
            $table->foreignId('user_id')->constrained('grocer_users', 'user_id')->onDelete('cascade');
            $table->foreignId('admin_id')->nullable()->constrained('super_admins', 'admin_id')->nullOnDelete();
            $table->boolean('is_restricted')->default(false);
            $table->integer('violation_count')->default(0);
            $table->timestamp('flagged_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ban_appeals', function (Blueprint $table) {
            $table->id('appeal_id');
            $table->foreignId('restriction_id')->constrained('cop_restrictions', 'restriction_id')->onDelete('cascade');
            $table->foreignId('admin_id')->nullable()->constrained('super_admins', 'admin_id')->nullOnDelete();
            $table->text('reason');
            $table->enum('appeal_status', ['Pending', 'Approved', 'Rejected'])->default('Pending');
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_recommendations', function (Blueprint $table) {
            $table->id('ai_id');
            $table->foreignId('user_id')->constrained('grocer_users', 'user_id')->onDelete('cascade');
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('ai_recommendations');
        Schema::dropIfExists('ban_appeals');
        Schema::dropIfExists('cop_restrictions');
    }
};