<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiRecommendationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SupervisorAiRecommendationController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'data' => $this->payload(AiRecommendationSetting::current()),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'max_items' => ['required', 'integer', 'between:1,12'],
            'ranking_basis' => ['required', Rule::in(AiRecommendationSetting::RANKING_BASES)],
            'include_alternatives' => ['required', 'boolean'],
            'included_categories' => ['nullable', 'array', 'max:50'],
            'included_categories.*' => ['string', 'max:50', 'distinct'],
            'excluded_categories' => ['nullable', 'array', 'max:50'],
            'excluded_categories.*' => ['string', 'max:50', 'distinct'],
        ]);

        $included = $data['included_categories'] ?? [];
        $excluded = $data['excluded_categories'] ?? [];

        $overlap = array_values(array_intersect($included, $excluded));
        if ($overlap !== []) {
            throw ValidationException::withMessages([
                'excluded_categories' => 'A category cannot be both included and excluded: '
                    . implode(', ', $overlap) . '.',
            ]);
        }

        $setting = AiRecommendationSetting::current();
        $setting->update([
            'enabled' => $data['enabled'],
            'max_items' => $data['max_items'],
            'ranking_basis' => $data['ranking_basis'],
            'include_alternatives' => $data['include_alternatives'],
            'included_categories' => $included ?: null,
            'excluded_categories' => $excluded ?: null,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'AI recommendation settings saved.',
            'data' => $this->payload($setting->fresh()),
        ]);
    }

    private function payload(AiRecommendationSetting $setting): array
    {
        return [
            'enabled' => $setting->enabled,
            'max_items' => $setting->max_items,
            'ranking_basis' => $setting->ranking_basis,
            'include_alternatives' => $setting->include_alternatives,
            'included_categories' => $setting->included_categories ?? [],
            'excluded_categories' => $setting->excluded_categories ?? [],
            'updated_at' => $setting->updated_at,
        ];
    }
}