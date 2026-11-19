<?php

// Each entry authorizes exactly one store and merchant. Never fall back to another store's key.
return [
    'provider' => env('PAYMENT_GATEWAY_PROVIDER', 'xendit'),
    'xendit' => [
        'store_id' => env('XENDIT_TEST_STORE_ID'), 'merchant_id' => env('XENDIT_TEST_BUSINESS_ID'),
        'secret_key' => env('XENDIT_TEST_SECRET_KEY'), 'webhook_secret' => env('XENDIT_TEST_WEBHOOK_TOKEN'),
        'channel_codes' => array_values(array_filter(array_map('trim', explode(',', env('XENDIT_TEST_CHANNELS', 'GCASH'))))),
    ],
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
