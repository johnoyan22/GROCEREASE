# Transaction migrations: review and local application record

Status: **000009–000013 were applied to the normal `grocerease` MariaDB database on October 19, 2026, following explicit user approval.**
Stock migrations 000007/000008 were previously applied with explicit approval.
All five transaction migrations passed isolated SQLite tests and actual application in a temporary MariaDB database before local application. No historical applied migration was edited.

| Migration | Additive change |
|---|---|
| `2026_10_19_000009_create_orders_tables.php` | Orders, purchase-price items and status history; store/Shopper ownership, composite store references and unique per-Shopper checkout keys. Checkout exposes COP only; the digital discriminator reserves a future trusted-provider path. |
| `2026_10_19_000010_create_workers_and_assignments.php` | Non-login store workers and assignment history, with Supervisor user IDs, timestamps and completion/cancellation audit. |
| `2026_10_19_000011_create_pickup_audit_tables.php` | Encrypted pickup credentials, separate payment, claimant-verification and physical-handover records. No representative registration or ID-image storage. |
| `2026_10_19_000012_add_pickup_schedules_and_cop_records.php` | Nullable store operating-hours / paid-holding settings; scheduled/actual pickup dates and claim/refund state on new orders; closure/settings audit, COP strikes, disposition, notification and resolution records. |
| `2026_10_19_000013_add_preparation_and_active_worker_assignments.php` | Digital preparation fields/audit and unique active worker/order assignment keys. |

Together: **17 new tables**, nullable settings on existing stores, and schedule/preparation fields on the newly introduced order tables.
The migrations do not seed products/orders/workers, set operating hours, choose a holding duration, alter existing quantities/prices, create authentication accounts, or change staff assignments.

The approved application used only these exact five paths from `backend/laravel`:

```powershell
php artisan migrate --path=database/migrations/2026_10_19_000009_create_orders_tables.php --path=database/migrations/2026_10_19_000010_create_workers_and_assignments.php --path=database/migrations/2026_10_19_000011_create_pickup_audit_tables.php --path=database/migrations/2026_10_19_000012_add_pickup_schedules_and_cop_records.php --path=database/migrations/2026_10_19_000013_add_preparation_and_active_worker_assignments.php
```

Before/after verification matched record counts and deterministic SHA-256 hashes of the original columns in all **11 existing business tables**: stores, users, roles, profiles, staff_store_assignments, products, store_inventory, inventory_availability_logs, inventory_policy_logs, low_stock_reports and stock_adjustments. All **17 new tables were empty** after application. Both stores retained unconfigured (null) pickup hours and paid-holding settings. Only the five approved migration records and their schema changes were applied; no seeds ran.

`php artisan migrate:status` confirmed all five as Ran in batch 15. The read-only consultation preview, `php artisan orders:process-deadlines --dry-run`, returned `{"classified":0,"reminders":0,"dry_run":true}`. The real deadline command was not run against working records. The temporary verification script and hash/count snapshot were removed after successful comparison.
Do not run `migrate:fresh` or roll back working data.

Then Admin configures each store's **actual** pickup hours through Store Management. Real Checkout remains unavailable for an unconfigured store. Paid holding remains unset until the store explicitly selects its approved 24/48-hour setting.

Read `feature-7-to-10-transactions.md` for the complete role/browser checklist and safe scheduler commands.
