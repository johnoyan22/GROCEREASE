<?php

return [
    'cache_store' => env('REPORT_CACHE_STORE', 'file'),
    'ttl_minutes' => 15,
    'max_source_rows' => 5000,
    'max_report_rows' => 1000,
    'max_bytes' => 4 * 1024 * 1024,
    'page_size' => 25,
];
