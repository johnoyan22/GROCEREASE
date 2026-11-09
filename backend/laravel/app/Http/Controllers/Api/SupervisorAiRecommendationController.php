<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiRecommendationSetting;
use App\Models\Product;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SupervisorAiRecommendationController extends Controller
{
    public function show(Request $request, StoreStaffAccess $access): JsonResponse
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);

            return $this->payload(AiRecommendationSetting::forStore($context['store']->store_id), $context['store']);
        });
    }

    public function update(Request $request, StoreStaffAccess $access): JsonResponse
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $store = $context['store'];
            abort_unless((int) $request->input('expected_store_id') === $store->store_id, 409, 'Your store assignment changed. Refresh AI settings before saving.');
            $categories = Product::forStore($store->store_id)->distinct()->pluck('category')->all();
            $input = $request->validate([
                'enabled' => ['required', 'boolean'], 'max_items' => ['required', 'integer', 'between:1,12'],
                'ranking_basis' => ['required', Rule::in(AiRecommendationSetting::RANKING_BASES)], 'include_alternatives' => ['required', 'boolean'],
                'included_categories' => ['present', 'array', 'max:50'], 'included_categories.*' => ['string', 'max:100', 'distinct', Rule::in($categories)],
                'excluded_categories' => ['present', 'array', 'max:50'], 'excluded_categories.*' => ['string', 'max:100', 'distinct', Rule::in($categories)],
                'store_id' => ['prohibited'], 'updated_by' => ['prohibited'], 'user_id' => ['prohibited'], 'updated_at' => ['prohibited'],
            ]);
            if (array_intersect($input['included_categories'], $input['excluded_categories'])) {
                throw ValidationException::withMessages(['excluded_categories' => 'A category cannot be both included and excluded.']);
            }
            $settings = AiRecommendationSetting::forStore($store->store_id);
            $before = $settings->settingsData();
            $settings->fill($input)->forceFill(['updated_by' => $context['user']->id])->save();
            DB::table('ai_recommendation_setting_audits')->insert(['store_id' => $store->store_id, 'changed_by' => $context['user']->id,
                'before' => json_encode($before), 'after' => json_encode($settings->settingsData()), 'created_at' => now()]);

            return $this->payload($settings->fresh(), $store);
        });
    }

    private function payload(AiRecommendationSetting $settings, $store): JsonResponse
    {
        return response()->json(['data' => $settings->settingsData() + ['store_id' => $store->store_id,
            'updated_by' => $settings->updated_by, 'updated_at' => $settings->updated_at], 'store' => $store->only(['store_id', 'store_name']),
            'categories' => Product::forStore($store->store_id)->distinct()->orderBy('category')->pluck('category'),
            'audit' => DB::table('ai_recommendation_setting_audits')->where('store_id', $store->store_id)->orderByDesc('id')->limit(10)->get(['id', 'changed_by', 'created_at']),
            'dataset_rule' => 'Completed, paid, fulfilled purchases with physical handover and valid payment evidence in this supermarket. No purchase history uses available inventory.'])
            ->header('Cache-Control', 'no-store, private');
    }
}
