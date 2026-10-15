<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('supervisor_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('super_admins', 'admin_id')->cascadeOnDelete();
            $table->string('event_key', 191);
            $table->string('type', 30);
            $table->string('title', 160);
            $table->text('message');
            $table->json('metadata')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->unique(['admin_id', 'event_key']);
            $table->index(['admin_id', 'read_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supervisor_notifications');
    }
};
