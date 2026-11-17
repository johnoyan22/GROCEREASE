<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    protected $fillable = ['store_id', 'name', 'status', 'created_by_user_id', 'updated_by_user_id'];
    protected function casts(): array { return ['ever_used_at' => 'datetime']; }

    public static function cleanName(string $name): string
    {
        return trim(preg_replace('/[\p{Z}\s]+/u', ' ', $name) ?? '');
    }

    public static function nameKey(string $name): string { return mb_convert_case(self::cleanName($name), MB_CASE_FOLD, 'UTF-8'); }

    protected static function booted(): void
    {
        static::saving(function (self $category) {
            $category->name = self::cleanName($category->name);
            $category->name_key = self::nameKey($category->name);
        });
    }

    public function products(): HasMany { return $this->hasMany(Product::class); }
}
