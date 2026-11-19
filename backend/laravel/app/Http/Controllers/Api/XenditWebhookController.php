<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\XenditCheckout;
use App\Services\XenditGateway;
use App\Services\XenditMoney;
use Illuminate\Http\Request;

class XenditWebhookController extends Controller
{
    public function __invoke(Request $request, int $store, XenditGateway $gateway, XenditCheckout $checkout)
    {
        $gateway->requireSchema(); $merchant=$gateway->merchant($store, true);
        $token=$request->header('x-callback-token','');
        abort_unless(is_string($token) && hash_equals($merchant['webhook_secret'],$token),401,'Invalid Xendit callback token.');
        $raw=$request->getContent();abort_if(strlen($raw)>262144,413);
        $payload=XenditMoney::decode($raw);
        abort_unless(($payload['business_id']??null)===$merchant['merchant_id'],409,'Xendit callback business does not belong to this store.');
        return response()->json($checkout->receive($store,$payload))->header('Cache-Control','no-store, private');
    }
}
