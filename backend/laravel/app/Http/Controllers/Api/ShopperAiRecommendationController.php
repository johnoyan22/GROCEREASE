<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiRecommendationSetting;
use App\Models\StoreInventory;
use App\Services\AiRecommendation\ImageUnderstanding;
use App\Services\AiRecommendation\QueryUnderstanding;
use App\Services\AiRecommendation\RecommendationEngine;
use App\Services\AiRecommendation\SelectedStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class ShopperAiRecommendationController extends Controller
{
    public function __construct(private readonly RecommendationEngine $engine, private readonly QueryUnderstanding $understanding,
        private readonly ImageUnderstanding $images, private readonly SelectedStore $selection) {}

    public function selectStore(Request $request): JsonResponse
    {
        $input = $request->validate(['store_id' => ['required', 'integer', 'min:1'], 'user_id' => ['prohibited']]);
        abort_unless($request->hasSession(), 409, 'A signed-in browser session is required to select a supermarket.');
        $store = $this->selection->select($request, (int) $input['store_id']);

        return $this->respond(['store' => $store->only(['store_id', 'store_name', 'address'])]);
    }

    public function index(Request $request, int $store): JsonResponse
    {
        $settings = $this->settings($request, $store);
        $input = $request->validate(['cart_inventory_ids' => ['sometimes', 'array', 'max:100'], 'cart_inventory_ids.*' => ['integer', 'min:1', 'distinct']]);
        $ids = array_map('intval', $input['cart_inventory_ids'] ?? []);
        $known = StoreInventory::forStore($store)->whereIn('store_inventory_id', $ids)
            ->whereHas('product', fn ($q) => $q->forStore($store))->count();
        if ($known !== count($ids)) {
            throw ValidationException::withMessages(['cart_inventory_ids' => 'Cart context must belong to the selected supermarket.']);
        }
        $result = $this->engine->recommend($request->user()->id, $ids, $settings);

        return $this->respond(['store_id' => $store, 'data' => $result['items'], 'meta' => ['enabled' => $settings->enabled, 'source' => $result['source']]]);
    }

    public function ask(Request $request, int $store): JsonResponse
    {
        $settings = $this->settings($request, $store);
        $input = $request->validate(['query' => ['required', 'string', 'min:2', 'max:500']]);
        $parsed = $this->understanding->understand($input['query'], $this->engine->catalog($settings));

        return $this->queryResponse($request, $store, $parsed);
    }

    public function image(Request $request, int $store): JsonResponse
    {
        $settings = $this->settings($request, $store);
        $input = $request->validate([
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:4096', 'dimensions:max_width=6000,max_height=6000'],
            'note' => ['nullable', 'string', 'max:300'], 'provider_consent' => ['required', 'accepted'],
        ]);
        if (! $settings->enabled) {
            return $this->queryResponse($request, $store, ['source' => 'disabled']);
        }
        abort_unless($this->images->isAvailable(), 503, 'Image understanding is unavailable. Use Ask anything with the local keyword fallback.');
        $parsed = $this->images->understand($request->file('image'), $input['note'] ?? null, $this->engine->catalog($settings));
        abort_if($parsed === null, 503, 'The AI provider could not read that photo. Try again or use Ask anything.');

        return $this->queryResponse($request, $store, $parsed);
    }

    public function alternatives(Request $request, int $store, int $item): JsonResponse
    {
        $settings = $this->settings($request, $store);

        return $this->respond(['store_id' => $store, 'data' => $this->engine->alternatives($item, $settings),
            'meta' => ['enabled' => $settings->enabled, 'alternatives_enabled' => $settings->include_alternatives]]);
    }

    public function cartCheck(Request $request, int $store, int $item): JsonResponse
    {
        $settings = $this->settings($request, $store);
        $input = $request->validate(['quantity' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'expected_price' => ['required', 'numeric', 'min:0', 'decimal:0,2'], 'stock_version' => ['required', 'integer', 'min:0']]);
        $product = $this->engine->catalog($settings)->firstWhere('store_inventory_id', $item);
        abort_unless($product, 409, 'This recommendation is unavailable. Refresh recommendations.');
        abort_if($product->stock_version !== (int) $input['stock_version'] || $product->selling_price !== number_format((float) $input['expected_price'], 2, '.', ''),
            409, 'This recommendation changed. Refresh and review its current price and availability.');
        $limit = min($product->available_stock, $product->max_per_order ?? $product->available_stock);
        abort_if($input['quantity'] > $limit, 409, 'The requested cart quantity exceeds current availability or the per-order limit.');

        return $this->respond(['store_id' => $store, 'product' => $product]);
    }

    private function settings(Request $request, int $store): AiRecommendationSetting
    {
        $request->validate(['store_id' => ['prohibited'], 'user_id' => ['prohibited'], 'shopper_user_id' => ['prohibited'], 'cart_product_ids' => ['prohibited']]);
        abort_unless($request->hasSession(), 409, 'Select a supermarket in a signed-in browser session first.');
        $this->selection->require($request, $store);

        return AiRecommendationSetting::forStore($store);
    }

    private function queryResponse(Request $request, int $store, array $parsed): JsonResponse
    {
        $this->selection->require($request, $store);
        // Resolve again after provider latency, including Supervisor disable/category changes.
        $settings = AiRecommendationSetting::forStore($store);
        $result = $this->engine->fromQuery($request->user()->id, $parsed, $settings);

        return $this->respond(['store_id' => $store,
            'data' => ['items' => $result['items'], 'total' => $result['total'], 'parsed' => Arr::only($parsed, ['budget', 'headcount', 'keywords'])],
            'meta' => ['enabled' => $settings->enabled, 'source' => $result['source'], 'understanding' => $parsed['source'],
                'estimate' => true, 'quantity_policy' => 'One unit per matching product; adjust quantities in My Cart. Headcount is context, not a serving guarantee.']]);
    }

    private function respond(array $data): JsonResponse
    {
        return response()->json($data)->header('Cache-Control', 'no-store, private');
    }
}
