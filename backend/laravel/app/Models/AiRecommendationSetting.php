<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiRecommendationSetting extends Model
{
    public const RANKING_BASES = ['hybrid', 'purchase_history', 'popularity'];

    protected $fillable = [
        'enabled',
        'max_items',
        'ranking_basis',
        'included_categories',
        'excluded_categories',
        'include_alternatives',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'max_items' => 'integer',
            'included_categories' => 'array',
            'excluded_categories' => 'array',
            'include_alternatives' => 'boolean',
        ];
    }

    /**
     * The system uses one settings row. Create it with defaults on first use,
     * so no seeder change is needed.
     */
    public static function current(): self
    {
        return static::query()->first() ?? static::query()->create([])->fresh();
    }
}