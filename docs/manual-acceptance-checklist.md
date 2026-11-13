# Four-role manual acceptance checklist

Date: 2026-11-13 (Asia/Manila). Code verification is recorded separately from
human acceptance. **No human acceptance entry below has passed**; entries are
Pending or explicitly Blocked by provider setup. Do not mark
a full module complete solely because automation passes.

Use authorized test accounts in two stores and disposable/approved test records.
Never reset the working database. Apply only explicitly approved migrations;
see `adviser-database-review.md`. Preserve before/after stock and order references.
Use actual mobile/browser viewports as well as a physical phone where possible.

For each row record **Pass / Fail / Blocked**, tester/date and evidence reference.
Blank result fields are intentionally unaccepted, not implied passes.

## Authentication and own accounts

| ID | Role / procedure | Expected behavior | Automation evidence | Human result / evidence |
| --- | --- | --- | --- | --- |
| A1 | Guest: open Login/Register at 320–430 px; submit valid/invalid email/password forms | No Google/divider/dead reset action. Existing validation and Shopper registration → email verification remain. | Auth/email PHP tests; adviser UI and browser auth tests | Pending — ___ |
| A2 | All roles: log in, open assigned workspace, log out; retry old protected URL | Correct role redirect; expired/unauthorized session blocked; no role impersonation | Auth/role/account regression | Pending — ___ |
| A3 | Shopper: My Profile → edit first/last/address; cancel; reopen/save; refresh | Cancel discards draft. Save persists; header/sidebar/profile name updates. Email, phone, role/status/verification remain protected. | ShopperProfileTest; profile UI | Pending — ___ |
| A4 | Shopper: upload own PNG/JPEG/WebP; preview/save/replace/remove; refresh | Own photo persists, old image replaced, removal falls back safely. Unsupported/oversize images rejected. Another Shopper cannot view it. | ProfilePhotoTest, multipart API tests | Pending — ___ |
| A5 | Shopper: Account & Security → change with wrong/current password, mismatched/valid confirmation; cancel | Clear errors/loading/success; actual password changes; no unsaved preference switches | Password/auth PHP and UI tests | Pending — ___ |
| A6 | Inventory Worker/Supervisor: view header/profile; have Admin update authorized account name; refresh | Actual uppercase initials update. Identity/contact stay view-only to staff; own password flow remains | StaffOwnAccountTest; initials component/browser tests | Pending — ___ |
| A7 | Admin: Profile; Role permissions; Financial Setup | Real account/password controls and role counts. No fake notification toggle, role CRUD or financial revenue/allocations | Dashboard/API/browser tests | Pending — ___ |

The team must supply approved Terms of Service and Privacy Policy content before
public registration acceptance; this branch removes dead policy hyperlinks and
does not invent legal policy text or change backend agreement validation.

## Store categories and catalog

| ID | Role / procedure | Expected behavior | Automation evidence | Human result / evidence |
| --- | --- | --- | --- | --- |
| P1 | Supervisor A: System Configuration → add/rename/archive category; repeat duplicate name | Persistent same-store CRUD/counts; duplicate rejected; assignments/history retained | AdviserCatalogStockTest | Pending — ___ |
| P2 | Worker A: Add Product; inspect SKU, category and unit | SKU automatic/read-only; active own-store categories only; separate barcode, size and selling unit | Catalog API/UI; MariaDB concurrent SKU test | Pending — ___ |
| P3 | Worker: create two products in concurrent sessions; edit one | Unique store-prefixed SKUs; old SKU never regenerated or edited | Database constraint and concurrent API tests | Pending — ___ |
| P4 | Worker: enter Coca-Cola-like generic test product, size 1.5 L, unit bottle | Size/unit distinct; integer quantities remain; Browse, Cart, Checkout, order and receipt/draft show unit | Unit snapshot and cart/Checkout tests | Pending — ___ |
| P5 | Worker: upload/replace/remove a team-owned product image; refresh Browse/cart/AI | Correct photo, lazy display/fallback; no price/count/category changes; invalid executable/type/size denied | Product photo tests | Pending — ___ |
| P6 | Worker A: change price; view Price history; Shopper refresh/review; attempt stale quote | Actor/store/old/new/time audit; catalog/cart update; stale quote requires review; confirmed old order/receipt unchanged | Price audit/Checkout regression | Pending — ___ |
| P7 | Worker/Supervisor A: attempt Store B IDs and unauthorized category/photo writes | 403/404; no cross-store changes or private staff access | Store isolation tests | Pending — ___ |

## Stock, batches and notifications

| ID | Role / procedure | Expected behavior | Automation evidence | Human result / evidence |
| --- | --- | --- | --- | --- |
| S1 | Worker: submit physical-count correction with Description | Existing version/reservation-floor validation; no direct change; backend reason audit preserved | StockAdjustmentTest | Pending — ___ |
| S2 | Worker: submit delivery with received/expiry/lot/quantity/description; Supervisor approve/reject | Pending leaves Hard/Soft intact. Approval adds physical units exactly once and records batch/actor/before/after. Rejection adds nothing. | Receiving + MariaDB approval race | Pending — ___ |
| S3 | Receive two batches with different expiries; quarantine one; use controlled test dates | Unsafe remainder unavailable; physical Hard unchanged. Handover consumes safe batches FEFO and preserves reservations. Unsafe reservations block release for reconciliation. | Batch expiry/FEFO/handover tests | Pending — ___ |
| S4 | Worker: request batch disposal; Supervisor review | Physical and batch remainder deducted only on approval with audit; cannot fall below reserved units | Disposal/stock tests | Pending — ___ |
| S5 | Inspect legacy unbatched stock | No fabricated receiving dates or double-counted imports. Physically inspect/reconcile unsafe goods and withhold affected offerings under operational policy | Legacy-preservation checks | Pending — ___ |
| S6 | Worker: download CSV; preview valid, invalid, foreign SKU, duplicate and expired rows; confirm valid subset | Line-specific errors; accepted/rejected summary; actor/store-bound preview; requests only; replay rejected; Supervisor approval required | CSV validation/replay tests | Pending — ___ |
| S7 | Supervisor: configure reorder level and maximum per order separately | Reuses low_stock_threshold; limits and reorder policy remain distinct and persisted | Stock policy regressions | Pending — ___ |
| S8 | Drop sellable stock to threshold; refresh repeatedly; acknowledge as Worker and Supervisor; recover/drop again | One persistent alert per episode; own acknowledgements persist; authorized store only; new alert after recovery/drop. Scheduler catches date expiry. Manual reports still work. | Stock alert tests | Pending — ___ |

## Orders, pickup, invoices and reports

| ID | Role / procedure | Expected behavior | Automation evidence | Human result / evidence |
| --- | --- | --- | --- | --- |
| O1 | Shopper: Browse → add/update/remove cart; refresh/account/store switch | One account/store cart, current prices/stock/limits; no reservation before successful Checkout | Shared-cart/API/browser tests | Pending — ___ |
| O2 | Shopper: select future pickup and COP; review; change price before confirming; submit/retry | Fresh authoritative review, COP ceiling, atomic reserve and idempotent retry; no client-supplied price/payment trusted | Checkout + MariaDB reservation test | Pending — ___ |
| O3 | Supervisor: assign picker, start/complete checklist, mark Ready; race assignments | Manual delegation and one active order per worker; appropriate preparation guards preserved | Delegation/preparation + MariaDB race | Pending — ___ |
| O4 | Supervisor A: lookup ID, GE-order, receipt GE-order-handover and TX-payment; test invalid/foreign/completed | Correct assigned-store identity/schedule/payment/preparation/claim state; clear unavailable/completed feedback | AdviserOrdersDocumentsTest | Pending — ___ |
| O5 | Shopper: show QR/PIN on phone; Supervisor: check claimant, confirm cashier/provider evidence, record actual handover | All separate checks required. Reference lookup/code alone cannot release. Once-only deduction/completion. | Pickup lifecycle + MariaDB handover | Pending — ___ |
| O6 | Shopper cancel; COP No-Show; Admin strike correction; resale/refund review | Exactly-once release; existing strikes/restrictions and physical disposition preserved; no assumed safe resale/refund transfer | COP/resolution/payment regressions | Pending — ___ |
| O7 | Complete paid order; view/print original receipt; generate invoice draft twice; edit current catalog/seller details | Original receipt works. One immutable Draft / Pro Forma reference; historical unit/prices; no official-tax claim; audit persists | Invoice tests + MariaDB generation race | Pending — ___ |
| O8 | Admin: save only approved seller registration details; attempt official issuance switch | Config/audit persisted; documents remain draft; required partner/tax/numbering dependencies explicit | Invoice protections tests | Pending — ___ |
| O9 | Supervisor/Admin: export filtered sales/transactions/orders/stock/COP as applicable; inspect multi-page PDF | Real PDF, correct scope/Manila period/records/totals/peso/page numbers; no foreign-store access; stock snapshot not invented historical balance | PDF tests/render QA | Pending — ___ |
| O10 | Authorized teammate: PayMongo actual Hosted Checkout success/failure/duplicate/expiry | Test mode only; verified signed webhook payment; COP and pickup guards retained | HTTP fakes pass; real provider pending | Blocked: authorized sandbox setup/testing — ___ |

## AI and final acceptance

| ID | Procedure | Expected behavior | Human result / evidence |
| --- | --- | --- | --- |
| AI1 | Follow `ai-teammate-handoff.md` text/alternatives/settings tests in two stores | Actual catalog prices/stock, shared cart, stale/foreign context rejected; friendly missing setup | Pending — ___ |
| AI2 | Authorized teammate verifies eligible model/key; real image with consent plus invalid/no-match cases | Provider success only claimed from actual test; no fabricated item, key leak or permanent AI image storage | Blocked: authorized Gemini test — ___ |
| V1 | Repeat key screens at 320, 375, 390, 430, 768, 1024; staff at 1366×768, 1440×900, 1920×1080 | Reachable actions, no page overflow, readable QR/price/total, keyboard/focus and accessible drawer/dialog | Pending human/device review — ___ |
| V2 | Review working backup, migration approval and original-value fingerprint comparison | Existing users/stores/products/stock/reservations/payments/orders/audits preserved | Pending approved application — ___ |
| V3 | Adviser/team sign off exact module scope and update 40-point matrix | Count only fully accepted module-role combinations; no new credit from tests alone | Pending — ___ |
