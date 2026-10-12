<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('supervisor_stock_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_inventory_id')->constrained('store_inventory', 'store_inventory_id')->cascadeOnDelete();
            $table->foreignId('worker_id')->nullable()->constrained('workers', 'worker_id')->nullOnDelete();
            $table->string('reason', 255);
            $table->unsignedInteger('requested_quantity')->nullable();
            $table->enum('status', ['Pending', 'Approved', 'Rejected', 'Needs Review'])->default('Pending');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('supervisor_stock_requests'); }
};
