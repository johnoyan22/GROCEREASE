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
    $this->info('Provider session identity verified and bound. Await the signed paid webhook or run the expiration command.');
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
