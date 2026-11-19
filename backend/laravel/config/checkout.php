<?php

return [
    // Technical lifetime of a price-confirmation token, not a pickup/no-show deadline.
    'quote_lifetime_seconds' => 600,
    // Service charge and new digital-method rules use store_financial_policy_versions.
    // Missing policy defaults to fee OFF; no global fee flag is consulted.
];
