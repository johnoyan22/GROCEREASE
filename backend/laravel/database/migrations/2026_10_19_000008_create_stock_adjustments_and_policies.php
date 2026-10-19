<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Refuse invalid legacy stock before making any schema changes. Never repair counts silently.
        if (DB::table('store_inventory')->whereColumn('soft_stock_qty', '>', 'hard_stock_qty')->exists()) {
            throw new RuntimeException('Reserved stock exceeds physical stock. Reconcile these records before migrating.');
        }

        Schema::table('store_inventory', function (Blueprint $table) {
            $table->unsignedBigInteger('stock_version')->default(0);
            $table->unsignedInteger('max_per_order')->nullable();
            $table->unsignedInteger('low_stock_threshold')->nullable();
        });

        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            // SQLite cannot add a CHECK to an existing table. These guards preserve its existing foreign keys.
            DB::unprepared("CREATE TRIGGER inventory_reserved_insert BEFORE INSERT ON store_inventory
                WHEN NEW.soft_stock_qty > NEW.hard_stock_qty
                BEGIN SELECT RAISE(ABORT, 'Reserved stock exceeds physical stock'); END");
            DB::unprepared("CREATE TRIGGER inventory_reserved_update BEFORE UPDATE OF hard_stock_qty, soft_stock_qty ON store_inventory
                WHEN NEW.soft_stock_qty > NEW.hard_stock_qty
                BEGIN SELECT RAISE(ABORT, 'Reserved stock exceeds physical stock'); END");
        } else {
            DB::statement('ALTER TABLE store_inventory ADD CONSTRAINT inventory_reserved_lte_physical CHECK (soft_stock_qty <= hard_stock_qty)');
        }

        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('store_inventory_id');
            $table->foreignId('requested_by_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('observed_hard_stock_qty');
            $table->unsignedInteger('observed_soft_stock_qty');
            $table->unsignedBigInteger('observed_stock_version');
            $table->unsignedInteger('requested_hard_stock_qty');
            $table->string('reason', 1000);
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('decision_note', 1000)->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->foreign(['store_id', 'store_inventory_id'], 'adjustments_inventory_store_foreign')
                ->references(['store_id', 'store_inventory_id'])->on('store_inventory')->restrictOnDelete();
            $table->index(['store_id', 'status', 'id']);
        });

        Schema::create('inventory_policy_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('store_inventory_id');
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('previous_max_per_order')->nullable();
            $table->unsignedInteger('new_max_per_order')->nullable();
            $table->unsignedInteger('previous_low_stock_threshold')->nullable();
            $table->unsignedInteger('new_low_stock_threshold')->nullable();
            $table->timestamps();
            $table->foreign(['store_id', 'store_inventory_id'], 'policy_inventory_store_foreign')
                ->references(['store_id', 'store_inventory_id'])->on('store_inventory')->restrictOnDelete();
            $table->index(['store_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_policy_logs');
        Schema::dropIfExists('stock_adjustments');
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            DB::unprepared('DROP TRIGGER IF EXISTS inventory_reserved_insert');
            DB::unprepared('DROP TRIGGER IF EXISTS inventory_reserved_update');
        } else {
            DB::statement('ALTER TABLE store_inventory DROP CONSTRAINT inventory_reserved_lte_physical');
        }
        Schema::table('store_inventory', function (Blueprint $table) {
            $table->dropColumn(['stock_version', 'max_per_order', 'low_stock_threshold']);
        });
    }
};
