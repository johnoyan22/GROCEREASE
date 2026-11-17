<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PickupCredential;
use App\Services\OrderData;
use App\Services\OrderReference;
use App\Services\PickupClaim;
use App\Services\PickupPolicy;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PickupClaimController extends Controller
{
    public function lookup(Request $request, StoreStaffAccess $access, OrderData $data): JsonResponse
    {
        $request->validate(['reference' => ['required', 'string', 'max:27'], 'store_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $access, $data) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $id = OrderReference::parse($request->string('reference')->toString());
            abort_unless($id, 404, 'Order reference unavailable.');
            $order = Order::where('store_id', $context['store']->store_id)->whereKey($id)->lockForUpdate()->firstOrFail();
            return $this->privateResponse(['order' => $data->present($order)]);
        }, 3);
    }

    public function resolve(Request $request, StoreStaffAccess $access, PickupClaim $claim, OrderData $data): JsonResponse
    {
        $input = $this->input($request);
        return DB::transaction(function () use ($input, $access, $request, $claim, $data) {
            $context = $access->resolve($request->user(), ['supervisor']);
            app(PickupPolicy::class)->requireSchema();
            $query = Order::where('store_id', $context['store']->store_id);
            if ($input['method'] === 'qr') {
                // Join only within the resolved store. Never resolve foreign tokens first.
                $query->whereIn('order_id', PickupCredential::select('order_id')->where('token_hash', hash('sha256', $input['credential'])));
            } else {
                $id = OrderReference::parse($input['reference'] ?? '');
                abort_unless($id, 422, 'The pickup credential is invalid or unavailable.');
                $query->whereKey($id);
            }
            $order = $query->lockForUpdate()->first();
            abort_unless($order, 422, 'The pickup credential is invalid or unavailable.');
            // An order-level scan must never silently select a different order.
            abort_if(isset($input['order_context']) && (int) $input['order_context'] !== $order->order_id, 409, 'This code belongs to a different order. Close this pickup and use Scan QR from Orders.');
            $credential = $claim->credential($order, $context['store'], $input['method'], $input['credential']);
            return $this->privateResponse(['order' => $data->present($order), 'credential_expires_at' => $credential->expires_at->toIso8601String()]);
        }, 3);
    }

    public function claim(Request $request, int $order, StoreStaffAccess $access, PickupClaim $claim, OrderData $data): JsonResponse
    {
        $input = $this->input($request, true);
        return DB::transaction(function () use ($request, $order, $input, $access, $claim, $data) {
            $context = $access->resolve($request->user(), ['supervisor']);
            app(PickupPolicy::class)->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_if($record->status === 'completed', 409, 'Already claimed. Refresh this order for its Pickup Receipt.');
            $credential = $claim->credential($record, $context['store'], $input['method'], $input['credential']);
            $input['claimant_name'] = $input['claiming_as'] === 'shopper' ? $record->shopper_name : $input['claimant_name'];
            $claim->verify($record, $credential, $context['user']->id, $input, true);
            $claim->handover($record, $context['store'], $context['user']->id);
            return $this->privateResponse(['message' => 'Paid order handed over and claimed.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    private function input(Request $request, bool $final = false): array
    {
        $allowed = $final ? ['method', 'credential', 'claiming_as', 'claimant_name', 'claimant_check_note', 'identity_checked', 'physically_handed_over']
            : ['method', 'credential', 'reference', 'order_context'];
        abort_if(array_diff(array_keys($request->all()), $allowed), 422, 'Unexpected pickup fields.');
        return $request->validate([
            'method' => ['required', Rule::in(['pin', 'qr'])],
            'credential' => ['required', 'string', 'max:64', $request->input('method') === 'pin' ? 'regex:/^[0-9]{8}$/D' : 'regex:/^[a-f0-9]{64}$/D'],
            ...($final ? [
                'claiming_as' => ['required', Rule::in(['shopper', 'representative'])],
                'claimant_name' => ['prohibited_if:claiming_as,shopper', 'required_if:claiming_as,representative', 'string', 'max:150', 'regex:/\S/u'],
                'claimant_check_note' => ['nullable', 'string', 'max:250'],
                'identity_checked' => ['required', 'accepted'], 'physically_handed_over' => ['required', 'accepted'],
            ] : ['reference' => ['required_if:method,pin', 'string', 'max:27'], 'order_context' => ['sometimes', 'integer', 'min:1']]),
        ]);
    }

    private function privateResponse(array $data): JsonResponse
    {
        return response()->json($data)->header('Cache-Control', 'no-store, private')->header('Pragma', 'no-cache');
    }
}
