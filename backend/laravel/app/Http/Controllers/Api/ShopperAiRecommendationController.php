<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiRecommendationSetting;
use App\Services\AiRecommendation\ImageUnderstanding;
use App\Services\AiRecommendation\QueryUnderstanding;
use App\Services\AiRecommendation\RecommendationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class ShopperAiRecommendationController extends Controller
{
    public function __construct(
        private readonly RecommendationEngine $engine,
        private readonly QueryUnderstanding $understanding,
        private readonly ImageUnderstanding $imageUnderstanding,
    ) {
    }

    /** "Recommendation for you" cards. Optional: ?cart_product_ids[]=1&cart_product_ids[]=2 */
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'cart_product_ids' => ['nullable', 'array', 'max:100'],
            'cart_product_ids.*' => ['integer', 'min:1'],
        ]);

        $settings = AiRecommendationSetting::current();

        $result = $this->engine->recommend(
            $request->user()->id,
            array_map('intval', $input['cart_product_ids'] ?? []),
            $settings,
        );

        return response()->json([
            'data' => $result['items'],
            'meta' => ['enabled' => $settings->enabled, 'source' => $result['source']],
        ]);
    }

    /** "Ask anything": free text such as "pasta for 4 under 500". */
    public function ask(Request $request): JsonResponse
    {
        $input = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:500'],
        ]);

        $settings = AiRecommendationSetting::current();

        // Gemini (when configured) chooses from the real in-stock catalogue;
        // otherwise the keyword parser is used. Either way the engine builds the basket.
        $parsed = $this->understanding->understand(
            $input['query'],
            $this->engine->catalog($settings),
        );

        if ($parsed['keywords'] === [] && $parsed['product_ids'] === []) {
            return response()->json([
                'message' => 'Tell me what you are looking for, for example "pasta for 4 under ₱500".',
                'data' => ['items' => [], 'total' => 0, 'parsed' => Arr::only($parsed, ['budget', 'headcount'])],
                'meta' => [
                    'enabled' => $settings->enabled,
                    'source' => 'no_keywords',
                    'understanding' => $parsed['source'],
                ],
            ]);
        }

        $result = $this->engine->fromQuery($request->user()->id, $parsed, $settings);

        return response()->json([
            'data' => [
                'items' => $result['items'],
                'total' => $result['total'],
                'parsed' => Arr::only($parsed, ['budget', 'headcount', 'keywords']),
            ],
            'meta' => [
                'enabled' => $settings->enabled,
                'source' => $result['source'],
                'understanding' => $parsed['source'],
            ],
        ]);
    }

    /** "Upload image": a photo (dish, ingredients, shelf or list) plus an optional note. */
    public function image(Request $request): JsonResponse
    {
        $input = $request->validate([
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        $settings = AiRecommendationSetting::current();

        if (! $settings->enabled) {
            return response()->json([
                'data' => ['items' => [], 'total' => 0, 'parsed' => ['budget' => null, 'headcount' => null], 'detected' => []],
                'meta' => ['enabled' => false, 'source' => 'disabled', 'understanding' => 'gemini-image'],
            ]);
        }

        if (! $this->imageUnderstanding->isAvailable()) {
            return response()->json([
                'message' => 'Image recognition is not set up yet. Please use Ask anything for now.',
            ], 503);
        }

        $understood = $this->imageUnderstanding->understand(
            $request->file('image'),
            $input['note'] ?? null,
            $this->engine->catalog($settings),
        );

        if ($understood === null) {
            return response()->json([
                'message' => 'The AI service could not read that photo right now. Please try again, or use Ask anything.',
            ], 503);
        }

        $parsedAmounts = Arr::only($understood, ['budget', 'headcount']);

        if ($understood['product_ids'] === []) {
            return response()->json([
                'message' => 'I could not match that photo to products available in this store.',
                'data' => [
                    'items' => [],
                    'total' => 0,
                    'parsed' => $parsedAmounts,
                    'detected' => $understood['detected'],
                ],
                'meta' => ['enabled' => true, 'source' => 'no_match', 'understanding' => $understood['source']],
            ]);
        }

        $result = $this->engine->fromQuery($request->user()->id, $understood, $settings);

        return response()->json([
            'data' => [
                'items' => $result['items'],
                'total' => $result['total'],
                'parsed' => $parsedAmounts,
                'detected' => $understood['detected'],
            ],
            'meta' => [
                'enabled' => true,
                'source' => $result['source'],
                'understanding' => $understood['source'],
            ],
        ]);
    }

    /** Alternatives for a product, for example when it is out of stock. */
    public function alternatives(Request $request, int $product): JsonResponse
    {
        $settings = AiRecommendationSetting::current();
        $items = $this->engine->alternatives($product, $settings);

        abort_if($items === null, 404, 'Product not found.');

        return response()->json([
            'data' => $items,
            'meta' => ['enabled' => $settings->enabled],
        ]);
    }
}