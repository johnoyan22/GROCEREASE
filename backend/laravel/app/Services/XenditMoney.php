<?php

namespace App\Services;

final class XenditMoney
{
    public static function decimal(int $cents): string
    {
        abort_unless($cents >= 0 && $cents <= FinancialMoney::MAX, 409, 'Unsupported provider amount.');
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function encode(array $payload): string
    {
        // Our decimal strings become JSON number tokens without passing through a float.
        return preg_replace('/("(?:amount|net_unit_amount)"\s*:\s*)"([0-9]+\.[0-9]{2})"/', '$1$2', json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
    }

    public static function decode(string $raw): array
    {
        // Preserve lexical money tokens BEFORE json_decode turns decimal numbers into floats.
        $raw = preg_replace('/(?<!\\\\)("(?:amount|request_amount|capture_amount|net_unit_amount)"\s*:\s*)(-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+\-]?[0-9]+)?)(?=\s*[,}])/', '$1"$2"', $raw);
        try { $data = json_decode($raw, true, 64, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { abort(502, 'Invalid provider JSON. Reconciliation is required.'); }
        abort_unless(is_array($data), 502, 'Invalid provider response.');
        return $data;
    }

    public static function cents(mixed $value): int
    {
        abort_unless(is_string($value) && preg_match('/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/D', $value, $m), 409, 'Provider amount has an unsupported format.');
        $amount = (int) $m[1] * 100 + (int) str_pad($m[2] ?? '', 2, '0');
        abort_if($amount > FinancialMoney::MAX, 409, 'Provider amount exceeds the supported range.');
        return $amount;
    }
}
