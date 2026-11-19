<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\OrderDeadlines;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('orders:process-deadlines {--dry-run : Preview without changing any record}', function () {
    $result = app(OrderDeadlines::class)->process((bool) $this->option('dry-run'));
    $this->info(json_encode($result));
})->purpose('Classify eligible unclaimed orders and issue pickup-window reminders safely');

Schedule::command('orders:process-deadlines')->everyMinute()->withoutOverlapping();

Artisan::command('payments:expire-unpaid {--dry-run : Preview candidates without provider calls or record changes}', function () {
    $this->info(json_encode(app(\App\Services\PaymentCheckout::class)->expireUnpaid((bool) $this->option('dry-run'))));
})->purpose('Expire unpaid sandbox sessions before safely releasing their reservations');
Schedule::command('payments:expire-unpaid')->everyMinute()->withoutOverlapping();

Artisan::command('payments:reconcile-session {attempt : Existing attempt UUID} {session : Provider session ID from the authorized merchant dashboard}', function () {
    app(\App\Services\PaymentCheckout::class)->reconcileSession($this->argument('attempt'), $this->argument('session'));
    $this->info('Provider session verified and bound. Xendit capture is checked through V3; PayMongo retains its signed-webhook path. Refresh the existing order.');
})->purpose('Recover an uncertain sandbox session without creating another payable session');

Artisan::command('inventory:reconcile-low-stock', function () {
    $this->info('Evaluated '.app(\App\Services\LowStockMonitor::class)->reconcile().' inventory records.');
})->purpose('Reconcile physical low-stock episodes and deliver once to current eligible staff');
Schedule::command('inventory:reconcile-low-stock')->everyMinute()->withoutOverlapping();

Artisan::command('inventory:category-mapping-status', function () {
    $rows = \Illuminate\Support\Facades\DB::table('category_mapping_issues')->join('products', 'products.product_id', '=', 'category_mapping_issues.product_id')
        ->whereNull('products.category_id')->orderBy('products.product_id')->get(['products.product_id', 'products.store_id', 'category_mapping_issues.reason']);
    $this->table(['Product ID', 'Store ID', 'Mapping issue'], $rows->map(fn ($r) => [(string) $r->product_id, $r->store_id ?? 'Unassigned', $r->reason])->all());
    $this->info($rows->count().' unresolved category mappings. Original text is preserved in products.category_legacy.');
})->purpose('Report legacy products requiring category mapping review; no data changes');


Artisan::command('payments:xendit-simulate {attempt : Existing Xendit TEST attempt UUID}', function () {
    $this->info(json_encode(app(\App\Services\XenditCheckout::class)->simulate($this->argument('attempt'))));
})->purpose('Request official TEST simulation; never marks an order Paid from its acknowledgement');

Artisan::command('payments:xendit-retry-events', function () {
    $this->info(json_encode(app(\App\Services\XenditCheckout::class)->retryEvents()));
})->purpose('Retry up to 25 durable Xendit session notifications using provider verification');
Schedule::command('payments:xendit-retry-events')->everyMinute()->withoutOverlapping();

Artisan::command('payments:xendit-status {attempt : Existing attempt UUID} {--refresh : Read Xendit and reconcile verified capture}', function () {
    $a=\App\Models\PaymentCheckoutAttempt::where(['provider'=>'xendit','mode'=>'test'])->findOrFail($this->argument('attempt'));
    if($this->option('refresh'))app(\App\Services\XenditCheckout::class)->status($a->order_id);
    $a->refresh();
    $this->info(json_encode(['attempt'=>$a->id,'store_id'=>$a->store_id,'order_id'=>$a->order_id,'provider'=>$a->provider,'mode'=>$a->mode,
        'status'=>$a->status,'session_id'=>$a->provider_session_id,'request_id'=>$a->provider_request_id,'payment_id'=>$a->provider_payment_id,
        'verified_at'=>$a->verified_at?->toIso8601String(),'expires_at'=>$a->expires_at->toIso8601String(),'last_error'=>$a->last_error,
        'pending_events'=>\Illuminate\Support\Facades\DB::table('xendit_session_events')->where('attempt_id',$a->id)->where('status','pending')->count()]));
})->purpose('Safe CLI diagnostics; default is read-only, with no credentials or hosted URLs');
