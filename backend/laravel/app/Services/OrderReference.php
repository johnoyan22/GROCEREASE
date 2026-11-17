<?php

namespace App\Services;

class OrderReference
{
    public static function format(int|string $id): string
    {
        return 'GE-ORD-'.str_pad((string) $id, 8, '0', STR_PAD_LEFT);
    }

    public static function parse(string $reference): ?string
    {
        if (!preg_match('/^GE-ORD-([0-9]{8,20})$/D', $reference, $match)) return null;
        $id = ltrim($match[1], '0');
        if ($id === '' || strlen($id) > 20 || (strlen($id) === 20 && strcmp($id, '18446744073709551615') > 0)) return null;
        return self::format($id) === $reference ? $id : null;
    }
}
