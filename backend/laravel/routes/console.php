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
