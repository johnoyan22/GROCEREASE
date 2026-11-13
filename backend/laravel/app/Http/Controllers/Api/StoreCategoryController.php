<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiRecommendationSetting;
use App\Models\Product;
use App\Models\StoreCategory;
use App\Services\StoreStaffAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class StoreCategoryController extends Controller
{
    public function index(Request $request, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $this->requireSchema();
            return response()->json(['categories' => StoreCategory::where('store_id', $context['store']->store_id)
                ->withCount('products')->orderBy('name')->get(), 'store' => $context['store']->only(['store_id', 'store_name'])]);
        });
    }

    public function save(Request $request, StoreStaffAccess $access, ?int $category = null)
    {
        return DB::transaction(function () use ($request, $access, $category) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $this->requireSchema();
            $storeId = $context['store']->store_id;
            $record = $category ? StoreCategory::where('store_id', $storeId)->lockForUpdate()->findOrFail($category) : new StoreCategory(['store_id' => $storeId]);
            $request->merge(['name' => is_string($request->name) ? trim($request->name) : $request->name]);
            $input = $request->validate(['name' => ['required', 'string', 'max:100'], 'active' => ['required', 'boolean'],
                'store_id' => ['prohibited'], 'updated_by_user_id' => ['prohibited']]);
            $key = mb_strtolower($input['name']);
            validator(['name' => $key], ['name' => [Rule::unique('store_categories', 'name_key')->where('store_id', $storeId)->ignore($record->id)]])->validate();
            $before = $record->exists ? $record->only(['name', 'active']) : null;
            $old = $record->name;
            $record->fill($input + ['name_key' => $key, 'updated_by_user_id' => $context['user']->id])->save();
            if ($old && $old !== $record->name) {
                // Keep the legacy category string used by catalog filtering and Habel's AI engine.
                Product::forStore($storeId)->where('category_id', $record->id)->update(['category' => $record->name]);
                if (Schema::hasTable('store_ai_recommendation_settings')) {
                    $settings = AiRecommendationSetting::where('store_id', $storeId)->lockForUpdate()->first();
                    if ($settings) {
                        $previous = $settings->settingsData();
                        foreach (['included_categories', 'excluded_categories'] as $field) {
                            $settings->$field = array_values(array_unique(array_map(fn ($name) => $name === $old ? $record->name : $name, $settings->$field ?? [])));
                        }
                        $settings->updated_by = $context['user']->id;
                        $settings->save();
                        DB::table('ai_recommendation_setting_audits')->insert(['store_id' => $storeId, 'changed_by' => $context['user']->id,
                            'before' => json_encode($previous), 'after' => json_encode($settings->settingsData()), 'created_at' => now()]);
                    }
                }
            }
            DB::table('category_audits')->insert(['category_id' => $record->id, 'actor_user_id' => $context['user']->id,
                'before' => $before ? json_encode($before) : null, 'after' => json_encode($record->only(['name', 'active'])), 'created_at' => now()]);
            return response()->json(['message' => 'Category saved. Existing assignments are retained.', 'category' => $record], $category ? 200 : 201);
        }, 3);
    }

    private function requireSchema(): void
    {
        abort_unless(Schema::hasTable('store_categories'), 503, 'Category management is awaiting the reviewed catalog database setup.');
    }
}
