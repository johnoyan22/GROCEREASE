<?php

$proxies = array_values(array_filter(array_map(
    'trim', explode(',', (string) env('GROCEREASE_TRUSTED_PROXIES', ''))
)));

foreach ($proxies as $proxy) {
    if (! filter_var($proxy, FILTER_VALIDATE_IP)) {
        throw new RuntimeException('GROCEREASE_TRUSTED_PROXIES must contain exact trusted proxy IPs, never wildcards.');
    }
}

return ['proxies' => $proxies];
