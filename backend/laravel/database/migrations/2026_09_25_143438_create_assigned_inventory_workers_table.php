<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('assigned_inventory_workers', function (Blueprint $table) {
            $table->id('inventory_worker_id');

            $table->foreignID('profile_id')
                ->unique()
                ->constrained('profiles','profile_id')
                ->onDelete('cascade');
            
                $table->foreignID('store_id')
                    ->constrained('stores', 'store_id')
                    ->onDelete('cascade');
                
                $table->string('password_hash');

                $table->enum('status', ['Active', 'Inactive'])
                    ->default('Active');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assigned_inventory_workers');
    }
};
