<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

final class FinancialMoney
{
    public const MAX = 4294967295;
    public const MAX_BUDGET = 9000000000000;

    public static function format(int $centavos): string
    {
        $absolute = abs($centavos);
        $whole = preg_replace('/\B(?=(\d{3})+(?!\d))/', ',', (string) intdiv($absolute, 100));
        return 'PHP '.($centavos < 0 ? '-' : '').$whole.'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function parse(mixed $value, string $field = 'amount', bool $zero = false): int
    {
        if (!is_string($value) || !preg_match('/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/D', $value, $m)) {
            throw ValidationException::withMessages([$field => 'Use an exact PHP decimal string, for example 500.00 (up to two decimal places).']);
        }
        $amount = (int) $m[1] * 100 + (int) str_pad($m[2] ?? '', 2, '0');
        if ($amount > self::MAX || $amount < ($zero ? 0 : 1)) {
            throw ValidationException::withMessages([$field => 'Amount must be '.($zero ? 'zero or ' : '').'positive and no greater than PHP 42,949,672.95.']);
        }
        return $amount;
    }
}
