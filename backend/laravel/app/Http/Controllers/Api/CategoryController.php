<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiRecommendationSetting;
use App\Models\Category;
use App\Services\StoreStaffAccess;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function index(Request $request, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor', 'inventory_worker']);
            $this->schema();
            $data = $request->validate([...$this->protectedFields(), 'search' => ['nullable', 'string', 'max:100'],
                'status' => ['nullable', Rule::in(['active', 'inactive'])], 'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647']]);
            $query = Category::where('store_id', $context['store']->store_id)->withCount('products');
            if (!empty($data['search'])) $query->where('name', 'like', '%'.trim($data['search']).'%');
            if (!empty($data['status'])) $query->where('status', $data['status']);
            $total = (clone $query)->count(); $last = max(1, (int) ceil($total / 10)); $page = min($data['page'] ?? 1, $last);
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name', 'address']),
                'categories' => $query->orderBy('name')->orderBy('id')->offset(($page - 1) * 10)->limit(10)->get()->map(fn ($c) => $this->row($c)),
                'pagination' => ['current_page' => $page, 'last_page' => $last, 'per_page' => 10, 'total' => $total,
                    'from' => $total ? ($page - 1) * 10 + 1 : null, 'to' => $total ? min($total, $page * 10) : null],
            ])->header('Cache-Control', 'no-store, private');
        }, 3);
    }

    public function options(Request $request, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor', 'inventory_worker']);
            $this->schema();
            $request->validate($this->protectedFields());
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name']),
                'categories' => Category::where('store_id', $context['store']->store_id)->where('status', 'active')->orderBy('name')->orderBy('id')->get(['id', 'name', 'status']),
            ])->header('Cache-Control', 'no-store, private');
        }, 3);
    }

    public function store(Request $request, StoreStaffAccess $access) { return $this->save($request, $access); }
    public function update(Request $request, int $category, StoreStaffAccess $access) { return $this->save($request, $access, $category); }

    private function save(Request $request, StoreStaffAccess $access, ?int $id = null)
    {
        try {
            return DB::transaction(function () use ($request, $access, $id) {
                $context = $access->resolve($request->user(), ['supervisor']); $this->schema();
                $category = $id ? Category::where('store_id', $context['store']->store_id)->whereKey($id)->lockForUpdate()->firstOrFail() : new Category(['store_id' => $context['store']->store_id]);
                $request->merge(['name' => is_string($request->input('name')) ? Category::cleanName($request->input('name')) : $request->input('name')]);
                $data = $request->validate([...$this->protectedFields(), 'name' => ['required', 'string', 'max:100', 'not_regex:/[\p{C}]/u'], 'status' => ['required', Rule::in(['active', 'inactive'])]]);
                $key = Category::nameKey($data['name']);
                if (Category::where('store_id', $context['store']->store_id)->where('name_key', $key)->when($id, fn ($q) => $q->where('id', '!=', $id))->exists()) $this->duplicate();
                $before = $id ? $category->only(['name', 'status']) : null;
                $category->fill($data)->forceFill(['updated_by_user_id' => $context['user']->id]);
                if (!$id) $category->created_by_user_id = $context['user']->id;
                $category->save();
                if ($before && $before['name'] !== $category->name) {
                    // The relationship owns current category text. Do not touch order/receipt snapshots.
                    $category->products()->where('store_id', $category->store_id)->update(['category' => $category->name]);
                    $settings = AiRecommendationSetting::where('store_id', $category->store_id)->lockForUpdate()->first();
                    if ($settings) {
                        $previousSettings = $settings->settingsData();
                        foreach (['included_categories', 'excluded_categories'] as $field) $settings->$field = array_values(array_unique(array_map(fn ($name) => $name === $before['name'] ? $category->name : $name, $settings->$field ?? [])));
                        $settings->updated_by = $context['user']->id;
                        $settings->save();
                        DB::table('ai_recommendation_setting_audits')->insert(['store_id' => $category->store_id, 'changed_by' => $context['user']->id,
                            'before' => json_encode($previousSettings), 'after' => json_encode($settings->settingsData()), 'created_at' => now()]);
                    }
                }
                $this->audit($category, $context['user']->id, $id ? 'updated' : 'created', $before, $category->only(['name', 'status']));
                return response()->json(['message' => $id ? 'Category saved.' : 'Category added.', 'category' => $this->row($category->loadCount('products'))], $id ? 200 : 201);
            }, 3);
        } catch (UniqueConstraintViolationException) { $this->duplicate(); }
    }

    public function destroy(Request $request, int $category, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $category, $access) {
            $context = $access->resolve($request->user(), ['supervisor']); $this->schema();
            $request->validate($this->protectedFields());
            // Product creation/assignment locks this same store before validating the category.
            $record = Category::where('store_id', $context['store']->store_id)->whereKey($category)->lockForUpdate()->firstOrFail();
            abort_if($record->ever_used_at || $record->products()->exists(), 409, 'This category has been used by products and must be preserved. Set it to Inactive instead.');
            $this->audit($record, $context['user']->id, 'deleted', $record->only(['name', 'status']), null);
            $record->delete();
            return response()->json(['message' => 'Unused category deleted.']);
        }, 3);
    }

    private function row(Category $category): array
    {
        return $category->only(['id', 'name', 'status', 'products_count']) + ['can_delete' => !$category->ever_used_at && !$category->products_count];
    }
    private function audit(Category $category, int $actor, string $action, ?array $before, ?array $after): void
    {
        DB::table('category_changes')->insert(['store_id' => $category->store_id, 'category_id' => $category->id, 'changed_by_user_id' => $actor,
            'action' => $action, 'before' => $before ? json_encode($before) : null, 'after' => $after ? json_encode($after) : null, 'created_at' => now()]);
    }
    private function duplicate(): never { throw ValidationException::withMessages(['name' => 'A category with this name already exists in your store. Edit or reactivate that category.']); }
    private function schema(): void { abort_unless(Schema::hasTable('categories') && Schema::hasColumn('products', 'category_id'), 503, 'Category Management is awaiting database setup.'); }
    private function protectedFields(): array
    {
        return array_fill_keys(['store_id', 'user_id', 'role', 'role_id', 'category_id', 'created_by_user_id', 'updated_by_user_id', 'ever_used_at', 'name_key', 'created_at', 'updated_at', 'per_page'], ['prohibited']);
    }
}
