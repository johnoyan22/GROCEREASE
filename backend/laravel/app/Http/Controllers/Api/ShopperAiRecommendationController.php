<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiRecommendationSetting;
use App\Services\AiRecommendation\QueryParser;
use App\Services\AiRecommendation\RecommendationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopperAiRecommendationController extends Controller
{
    public function __construct(
        private readonly RecommendationEngine $engine,
        private readonly QueryParser $parser,
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
        $parsed = $this->parser->parse($input['query']);

        if ($parsed['keywords'] === []) {
            return response()->json([
                'message' => 'Tell me what you are looking for, for example "pasta for 4 under ₱500".',
                'data' => ['items' => [], 'total' => 0, 'parsed' => $parsed],
                'meta' => ['enabled' => $settings->enabled, 'source' => 'no_keywords'],
            ]);
        }

        $result = $this->engine->fromQuery($request->user()->id, $parsed, $settings);

        return response()->json([
            'data' => [
                'items' => $result['items'],
                'total' => $result['total'],
                'parsed' => $parsed,
            ],
            'meta' => ['enabled' => $settings->enabled, 'source' => $result['source']],
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