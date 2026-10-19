<?php

return [
    'cop_max_centavos' => 150000,
    // Technical lifetime of a price-confirmation token, not a pickup/no-show deadline.
    'quote_lifetime_seconds' => 600,
    'service_fee' => [
        'status' => 'pending_partner_approval',
        'enabled' => false,
        'rate_basis_points' => null,
        'cap_centavos' => null,
    ],
];
