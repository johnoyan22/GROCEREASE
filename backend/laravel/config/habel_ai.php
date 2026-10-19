<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Gemini naa diri ang API key, SENSITIVE !!!
    |--------------------------------------------------------------------------
    | The key and model live in backend/laravel/.env and are never committed:
    |   GEMINI_API_KEY=...
    |   GEMINI_MODEL=...   (a model that supports generateContent)
    */
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL'),
        'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        'timeout' => (int) env('GEMINI_TIMEOUT', 12),
    ],

];