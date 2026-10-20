<?php

// Each entry authorizes exactly one store and merchant. Never fall back to another store's key.
return [
    'mode' => env('PAYMENT_GATEWAY_MODE', 'disabled'),
    'reservation_minutes' => 15,
    'signature_tolerance_seconds' => 300,
    'merchants' => env('PAYMONGO_TEST_STORE_ID') ? [
        (int) env('PAYMONGO_TEST_STORE_ID') => [
            'merchant_id' => env('PAYMONGO_TEST_MERCHANT_ID'),
            'secret_key' => env('PAYMONGO_TEST_SECRET_KEY'),
            'webhook_secret' => env('PAYMONGO_TEST_WEBHOOK_SECRET'),
            'methods' => array_values(array_filter(explode(',', env('PAYMONGO_TEST_METHODS', '')))),
        ],
    ] : [],
];
