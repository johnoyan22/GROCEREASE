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
