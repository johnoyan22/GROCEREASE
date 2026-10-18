<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_recommendation_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(true);
            $table->unsignedTinyInteger('max_items')->default(5);
            $table->string('ranking_basis', 30)->default('hybrid'); // hybrid, purchase_history, popularity
            $table->json('included_categories')->nullable();
            $table->json('excluded_categories')->nullable();
            $table->boolean('include_alternatives')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_recommendation_settings');
    }
};