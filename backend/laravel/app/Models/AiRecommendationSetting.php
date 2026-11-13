<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class AiRecommendationSetting extends Model
{
    public const RANKING_BASES = ['hybrid', 'purchase_history', 'popularity'];

    public const FIELDS = ['enabled', 'max_items', 'ranking_basis', 'included_categories', 'excluded_categories', 'include_alternatives'];

    protected $table = 'store_ai_recommendation_settings';

    protected $fillable = ['store_id', 'enabled', 'max_items', 'ranking_basis', 'included_categories', 'excluded_categories', 'include_alternatives', 'updated_by'];

    protected $attributes = ['enabled' => true, 'max_items' => 5, 'ranking_basis' => 'hybrid', 'include_alternatives' => true];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'max_items' => 'integer', 'included_categories' => 'array', 'excluded_categories' => 'array', 'include_alternatives' => 'boolean'];
    }

    public static function forStore(int $storeId): self
    {
        abort_unless(Schema::hasTable('store_ai_recommendation_settings'), 503, 'AI recommendations are not available yet. Your team needs to complete the reviewed AI database setup. Shopping and other store features remain available.');

        // Reads do not create singleton rows or modify the database.
        return static::query()->firstOrNew(['store_id' => $storeId]);
    }

    public function settingsData(): array
    {
        return ['enabled' => $this->enabled, 'max_items' => $this->max_items,
            'ranking_basis' => $this->ranking_basis, 'include_alternatives' => $this->include_alternatives,
            'included_categories' => $this->included_categories ?? [], 'excluded_categories' => $this->excluded_categories ?? []];
    }
}
