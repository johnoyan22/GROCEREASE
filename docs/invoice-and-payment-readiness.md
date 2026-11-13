# Invoice, PDF and payment readiness

Reviewed 2026-11-13 (Asia/Manila). This is an implementation handoff; the
partner supermarket must confirm its own registration and invoicing obligations.

## What this branch issues

An independent **Sales Invoice — Draft / Pro Forma** document, clearly marked
on screen, in the PDF heading and on every PDF page. It is not an authorized
tax invoice. Existing order receipts retain their own workflow and references.
Generation requires verified payment and completed physical handover. A unique
order constraint and order lock prevent duplicates. Subsequent calls retrieve
the original immutable seller/order/price/unit snapshot and reference. PDF exports
are audited. No record is overwritten when catalog prices or seller settings change.

Admin records supermarket-approved seller details at Reports → Seller invoice
details. Empty fields remain unconfirmed; GrocerEase never becomes the grocery
seller by default. No UI or API switch can enable official issuance. No tax rate,
VAT exemption, discount or withholding rule is guessed. Legacy item units remain
unspecified rather than retroactively inferred.

## BIR sources checked

- [RR 7-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf): invoices are the primary sale document; seller registration, required invoice information and printing/registration requirements matter. Confirm seller registered identity/TIN/branch, buyer fields where applicable, descriptions, quantities, unit costs, authorized numbering and applicable tax breakdown before official issuance.
- [RR 11-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2011-2024.pdf) and [RMC 77-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf): distinguish payment receipts from invoices; special transitional conversion rules are not a general permission to rename an application receipt.
- [RR 11-2025](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2011-2025.pdf): structured electronic invoice rules cover specified taxpayers and registered/accredited systems. A printable PDF alone does not establish electronic-invoicing compliance.
- [RR 26-2025](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2026-2025.pdf): the covered taxpayer groups have a December 31, 2026 electronic-invoicing deadline; its e-commerce group distinguishes Small/Medium/Large from exempted Micro taxpayers. The partner must confirm its classification and applicable authorization/reporting obligations.
- [RR 6-2026](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%206-2026.pdf) adds separately stated creditable withholding tax where applicable. The partner must confirm applicability and calculation before official issuance. The [2026 circular index](https://www.bir.gov.ph/2026-Revenue-Memorandum-Circulars) must also be reviewed for current electronic-invoicing procedures, including RMC 98-2026. The dynamically loaded circular index and attempted primary circular download did not expose its complete document in this environment; no unverified circular-specific technical requirement is treated as implemented.

Before an official-invoice phase, the partner accountant/RDO must approve:

1. Registered seller, branch, registration category and any online seller registration display.
2. Authority to print/issue, authorized serial ranges and software/electronic invoicing approvals as applicable.
3. Per-item VAT/zero-rated/exempt treatment, discounts, rounding, withholding and buyer information rules.
4. Issuance timing, corrections/voids/credit notes, reprints, retention and audit policy.
5. Applicable 2026 circulars, taxpayer classification, structured data and reporting/certification obligations.

Until these are confirmed and separately implemented/accepted, obtain the
supermarket's authorized invoice outside this draft workflow.

## PDF reports

Server-rendered Dompdf PDFs use DejaVu Sans (peso glyph), real role/store-scoped
records, current filters, Manila dates, totals, repeated table headers and page
numbers. Remote resources, JavaScript and PHP execution are disabled.
Supervisor exports orders, stock and verified transactions/payments. Admin
exports stock, sales, transactions and COP failures/restrictions. Stock reports
are current snapshots; date-filtered historical balances are not fabricated.
Exports exceeding 5,000 records require narrower filters and never silently omit rows.

## PayMongo test-only handoff

Existing `PayMongoGateway`, `PaymentCheckout`, signed webhook validation,
reservation expiry/reconciliation and migration **000015** are preserved.
No new payment adapter or real merchant configuration was introduced.

Authorized team member setup (never commit values):

1. Obtain approval for pending migration 000015, then apply it with preservation checks.
2. Configure `PAYMENT_GATEWAY_MODE=test`, `PAYMONGO_TEST_STORE_ID`,
   `PAYMONGO_TEST_MERCHANT_ID`, `PAYMONGO_TEST_SECRET_KEY`,
   `PAYMONGO_TEST_WEBHOOK_SECRET`, `PAYMONGO_TEST_METHODS` in the existing environment.
   Keys must be test keys; each configured merchant is isolated to one store.
3. Register the authorized HTTPS webhook `/api/payments/paymongo/test/{store}/webhook`.
   Configure actual merchant-enabled channels and Supervisor pickup/paid holding policy.
4. Use real Hosted Checkout in test mode; a browser success URL must never mark an order paid.
5. Test success via signed callback; bad signatures; wrong store/amount/currency;
   duplicate callbacks; failed/abandoned payment; uncertain session recovery;
   expiry and once-only reservation release. Run `payments:expire-unpaid --dry-run`
   before an approved operational run. Use `payments:reconcile-session` only with
   the actual authorized session from that merchant.
6. Confirm COP remains available, and every paid order still requires preparation,
   claimant/QR/PIN verification and physical handover before completion.

Automation uses HTTP fakes (`SandboxPaymentTest`); **no real PayMongo sandbox
transaction was executed or accepted in this branch session**.
