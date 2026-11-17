# Reports: implemented scope and remaining work

Reports now use authorized backend query services, with one workspace per role:

- Inventory Worker: Current Stock Summary, Batches and Expiry, Stock Requests and Changes, Availability Activity.
- Supervisor: those inventory reports plus Payments and Pickup Summary and Order Operations Summary.
- Admin: Payments and Pickup Summary, Store Operations Summary and COP Summary, across stores or with an explicit store filter.

Admin retains `/admin/reports`; Supervisor retains `sales-reports`. Worker Reports uses
`/inventory/reports`; `/inventory/activity` redirects to its Availability Activity report.
Transactions remains a separate operational drill-down and does not calculate report totals.

## Data and period bases

Period reports default to the current Manila month to date and accept at most 93 inclusive days.
Selected days are converted from Manila midnight to UTC with an exclusive next-day upper bound.
Stock and batch reports are current generation-time snapshots; they do not accept historical dates.
Each table states its event basis. Request approvals use `decided_at`; pending/rejected requests
use `created_at`. Corrections use recorded deltas; missing legacy delta evidence is explicitly
unavailable. These records do not reconstruct a complete inventory movement ledger.

Low stock still means physical quantity <= configured Re-order Level; a null threshold is unset.
Available quantities reuse existing reservation/batch rules. Product quantities are never summed
across selling units. Batch numbers and unknown historical receipt/expiry dates are preserved.

Collections require existing `PaymentEvidence` validation. Actual COP collections, trusted
test/sandbox payments and legacy/unclassified digital payments are separated. No supported
production digital payment source currently proves a live collection mode; historical digital
records are not assumed actual. Payment confirmation dates and physical handover dates are
separate bases. Current paid-awaiting-pickup counts do not imply a completed sale. Refund flags
produce status counts only: there is no completed refund-money ledger, so no net/refund-adjusted
amount is claimed. Historical money comes from saved orders/payments, not current catalog prices.

## Shared preview and PDF

An opaque, private, user/role/session/assignment-bound snapshot stores the complete generated
dataset for 15 minutes in the configured report cache (`REPORT_CACHE_STORE`, default `file`).
Preview pagination and PDF export read that same dataset and recheck current authorization.
Reassignment, changed approval/role, session rotation, ownership mismatch and expiry deny access.
Changing UI filters invalidates export until Generate Report runs again. Source/size limits
return explicit narrowing errors; no results are silently truncated.
Defaults bound total source reads to 5,000 rows, rendered report tables to 1,000 rows, and
serialized snapshots to 4 MiB. Preview pages contain 25 rows; PDF totals and tables include all
rows in the accepted snapshot.

The server renderer is `barryvdh/laravel-dompdf` 3.1.2 with Dompdf 3.1.6, locked for PHP 8.2 /
Laravel 12. Install with `composer install`; no report migration is required. Report templates
use local embedded DejaVu fonts, escaped text and GrocerEase text branding; remote resources,
PHP execution and JavaScript are disabled. Downloads are real selectable-text PDFs, private/no-store,
with repeated table headers and page numbers. Stock, payment and policy state is not changed.
The preview and PDF use a compact black-and-white report layout: no colored headings or shaded
cells. Report/store names, period or snapshot date, author, selected filters and necessary totals
remain. Short captions distinguish event dates from current counts; longer explanations stay in
the report data/documentation. Empty secondary sections, routine zero test/legacy totals and
no-refund-needed status tables are hidden. Nonzero test/legacy totals and data-quality warnings
remain explicit; underlying saved metrics and rows are unchanged.
Report cache storage and the renderer's normal temporary/font cache directories must be writable.
The initial dependency command was
`composer require "barryvdh/laravel-dompdf:^3.1" --with-dependencies` from `backend/laravel`.
Existing installations should use the committed lockfile via `composer install`.

For repeatable PDF/UI QA, run `ReportSummariesTest` from `backend/laravel` with
`REPORT_PDF_QA=1`, then `node tests/reports-browser-smoke.mjs` from `frontend`.
The browser fixture uses mocked HTTP and the resulting isolated-QA PDF bytes; it does not
stand in for the backend authorization/calculation tests or real PDF text/render inspection.
QA outputs are temporary and ignored by Git under `tmp/pdfs/reports` and `tmp/reports-browser`.

## Deferred

COP policy editing, new payment providers (including Xendit), fiscal invoices, refund processing,
settlement/profit reporting, payroll/incentives, SaaS revenue, scheduled reports, report-builder
tools and general notification/delivery features are outside this report implementation.
Existing low-stock monitoring, notification behavior and historical operational records are preserved.
