<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StoreCategory extends Model
{
    protected $fillable = ['store_id', 'name', 'name_key', 'active', 'updated_by_user_id'];
    protected function casts(): array { return ['active' => 'boolean']; }
    public function products() { return $this->hasMany(Product::class, 'category_id'); }
}
