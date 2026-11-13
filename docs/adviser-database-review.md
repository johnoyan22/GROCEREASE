# Database approval review

No working-database migration was applied in this development session.
Read-only `php artisan migrate:status` on 2026-11-13 confirmed:

- Existing AI migration **000017 is already applied**.
- Existing payment **000015** and account-status **000016** remain pending.
- New adviser migrations **000018, 000019 and 000020** remain pending.
- Follow-up locator migration **000021** is also pending; it is separately
  proposed after the user's landing-page correction, without working application.

## Exact proposed changes (awaiting user approval)

| Migration | New tables | Modified tables / original values |
| --- | --- | --- |
| `2026_11_13_000018_add_catalog_management.php` | `store_categories`, `category_audits`, `product_price_changes` | `products`: nullable `category_id` with same-store FK, nullable `selling_unit`, nullable `image_path`. `order_items`: nullable historical `selling_unit`. Existing category strings produce store-specific category rows and populate only the new category relationship. Existing names, SKUs, barcodes, prices, stock, orders and receipts remain unchanged. |
| `2026_11_13_000019_add_stock_receiving_and_alerts.php` | `stock_batches`, `stock_receiving_requests`, `stock_batch_events`, `stock_alerts`, `stock_alert_states`, `stock_alert_acknowledgements` | No original business table columns or stock counts change. New tables start empty. |
| `2026_11_13_000020_create_pro_forma_invoices.php` | `store_invoice_settings`, `order_invoices`, `invoice_audits` | No original business table columns or order/payment values change. New tables start empty. |
| `2026_11_13_000021_create_verified_store_locations.php` | `store_locations`, `store_location_audits` | No existing table or value changes. New tables start empty; no invented coordinates or automatic public store verification. Exact columns/workflow: `landing-page-and-store-locator.md`. Approval is separate from 18–20. |

Original migration files through 000017 remain unchanged. The new, unapproved
18–20 audit date fields were corrected to `dateTime` after actual disposable
MariaDB testing exposed old-server timestamp-default behavior. This is a
pre-application correction to new migrations, not a rewrite of an applied migration.

## Evidence and remaining live setup

SQLite tests compare every original table/column value before and after the
additive migrations. Disposable MariaDB accepted the complete migration set and
passed concurrent SKU, receiving approval, reservation, worker assignment,
handover and invoice-generation tests. Test databases and runtime files were
removed. These tests do not substitute for a reviewed working-database backup.

After explicit approval for these exact migrations:

1. Stop operational writes during the maintenance window. Take and verify the
   team's database backup using its approved backup process.
2. Run the read-only preservation helper in `backend/laravel`:
   `php tests/adviser-data-fingerprint.php snapshot maintenance-review`. Use a
   fresh unique label for each approved maintenance window. It writes only counts,
   original column names and hashes under ignored `tmp/`; no raw records or
   credentials are exported. It refuses to overwrite an existing snapshot.
3. Apply **only approved paths**, one at a time:

```text
php artisan migrate --path=database/migrations/2026_11_13_000018_add_catalog_management.php
php artisan migrate --path=database/migrations/2026_11_13_000019_add_stock_receiving_and_alerts.php
php artisan migrate --path=database/migrations/2026_11_13_000020_create_pro_forma_invoices.php
```

If migration **21 is also explicitly approved**, its separate exact path is:

```text
php artisan migrate --path=database/migrations/2026_11_13_000021_create_verified_store_locations.php
```

4. Run `php tests/adviser-data-fingerprint.php verify maintenance-review` with the
   same label. Review any changed table;
   concurrent operational changes can also cause a difference. Do not reset,
   restore, roll back or delete records automatically on a mismatch.
5. Verify category counts/relationships, preserved SKUs, unset legacy units,
   zero new stock movements, existing receipts and same-store permissions.
6. Supervisors review imported legacy categories, set selling units through the
   Worker catalog form as appropriate and inspect legacy stock. **Do not import
   an existing physical count as a new delivery**: imports represent added goods.
   Unknown historical receipt/expiry dates remain unknown; unsafe legacy
   offerings must be withheld through the existing operational availability and
   approved reconciliation procedure. The system does not reconstruct old batches.
7. Configure/run the Laravel scheduler (`schedule:run` every minute, or an
   approved development `schedule:work`) for `inventory:monitor`. It creates real
   in-system alerts; it never changes physical quantities or sends fake email/SMS.
8. Execute the four-role manual acceptance checklist on authorized test records.

Do not use an unrestricted `php artisan migrate` as a shortcut: it would also
apply pending payment 000015 and account-status 000016, which need their own
review/approval. No credentials are required for catalog/stock/pro-forma setup.
Gemini and PayMongo credentials remain with the authorized teammates.
