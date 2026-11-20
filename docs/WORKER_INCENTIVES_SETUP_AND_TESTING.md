# Worker Tip Incentives: pre-implementation checkpoint

This checkpoint contains the proposed additive schema, internal incentive service and financial ledger extensions. **The module is not available in the application yet.** It does not collect shopper tips, add checkout charges, transfer money, create worker logins, enable cards or change merchant bindings.

## What is present

- An inactive-by-default, store/mode-scoped incentive plan with immutable effective-dated rate versions.
- Plan allocations backed by existing verified subscription funding and ordinary ledger reservations.
- Internal commitment, terminal-release, handover outbox and exactly-once earning service methods.
- Integer credit units (1,000 per order; 500 per role) and a fixed order reward split once, with the picking share receiving an odd centavo.
- Internal recording of selected offline payments, reservation consumption and audited mistaken-record corrections.
- A migration for explicit picking/packing responsibility, contribution verification and role-transfer history.

The services are foundations for subsequent integration, not public APIs. They expect validated inputs and the documented store/order transaction boundary. An active Admin authorizes funding and payment postings. Fulfillment earmarking uses the actual initiating staff member and approved plan; it does not impersonate an Admin.

## Remaining integration

1. Update assignment, role completion, packing review and readiness guards. The current controller still implements the previous single-worker workflow.
2. Connect first preparation assignment to commitment creation, real terminal classifications to release, and verified handover to durable outbox insertion in the same transaction.
3. Register a bounded reconciliation command/scheduler around `WorkerIncentives::reconcile()` and test interrupted handover processing.
4. Add strictly validated Admin endpoints and store-scoped read-only Supervisor endpoints, paginated/searchable workspaces, private evidence views and all role checks.
5. Extend Financial Setup totals and structured report/PDF snapshots for consumed funding, liabilities and Actual/Test isolation.
6. Complete service and endpoint payment/earning tests, commitment/settlement SQL concurrency checks, positive CARDS provider fixtures and hosted user acceptance.

There is no new Admin or Supervisor UI entry at this checkpoint. The recovery service is not yet exposed as an Artisan command. No incentive plans, funding, rewards or recorded worker payments are seeded in the working database.

## Migration

The working database is **not migrated automatically by this checkpoint**. Complete the remaining integration before enabling the module. Existing financial operations retain compatibility with the previous schema.

From the repository root, the additive migration command for the next implementation stage is:

```powershell
Set-Location backend/laravel
& 'C:\xampp\php\php.exe' artisan migrate --path=database/migrations/2026_11_20_000002_add_worker_incentives.php --force
```

The migration adds role coverage/contribution/transfer tables; plans, rules, allocations and commitments; commitment event/outbox and earning tables; recorded payments, payment applications, allocation settlements and corrections. It adds `role_schema_version` to assignments and `disbursed_centavos` to the existing incentive budget. It removes the order-wide active-worker uniqueness and adds unique active role coverage while preserving the one-active-assignment-per-worker key.

Existing active assignments receive responsibility rows only. No picking/packing completion or historical incentive is fabricated. Rollback refuses to remove posted contribution/commitment history; use forward corrections after records exist.

## Accounting definitions

**Net approved funding = available funds + reserved funds + net recorded worker disbursements.**

- Available: verified contributions less returns, allocated reservations and other approved movements.
- Reserved: unspent plan capacity, committed-but-unearned rewards and earned-but-unpaid liabilities. These are stages of the same reserved amount and must not be counted twice.
- Net recorded worker disbursements: reservation settlements for offline payments recorded by an Admin, less audited corrections establishing that the original payment record was mistaken and no payment was made. This is a recording of external activity, not a bank/wallet transfer performed by GrocerEase.
- A commitment earmarks capacity inside an existing allocation. Earning changes the liability stage without inventing or moving budget money.
- Returning unused capacity moves reserved funds back to available. Paying earnings consumes reserved funds; it does not return them to available.
- Original full reservation releases remain releases. New partial-return/settlement entries are stored separately and do not reinterpret historical movements.

No service charge, grocery payment or COP cash automatically funds incentives. Actual/Test sources remain separate. COP is Actual; a COP demo must not be implicitly enrolled in a Test plan. No Test enrollment or Actual plan is enabled automatically.

## Checks

Focused foundation checks are in `WorkerIncentiveFoundationTest`. Existing financial, worker and Xendit tests must continue to pass. The disposable MariaDB financial harness checks migration compatibility and existing allocation/reservation races; it does not establish the complete new incentive workflow or external payment success.

```powershell
& 'C:\xampp\php\php.exe' artisan test --compact --filter=WorkerIncentiveFoundationTest
node tests/mariadb-financial-smoke.mjs
```

Before calling the module complete, test both combined and separate worker contributions, immutable promised rates, exhausted capacity, no legacy backfill, payment provenance, missing/invalid handovers, interrupted outbox recovery, duplicate awards/payments, inactive-worker payment, corrections, private evidence and role-restricted reports. Use a disposable database for destructive or concurrent tests.

## Manual acceptance after the UI and hooks are implemented

Use Test mode for the configured Xendit store. Example values below are illustrative, never defaults:

1. Record and verify a Test subscription receipt in Financial Setup and contribute PHP 100.00.
2. Create an inactive Test plan at PHP 10.00 per full order credit, allocate PHP 100.00 and explicitly activate it.
3. Complete a genuine hosted Test payment; assign verified picking and packing responsibilities. Earned remains zero during preparation and Ready for Pickup.
4. Complete the normal paid QR/PIN handover. Expect one total credit and PHP 10.00 earned/unpaid exactly once.
5. Repeat with separate picker/packer workers: half credit and PHP 5.00 each. Check odd-cent splitting separately.
6. Change future rules and pause the plan; existing funded commitments must retain their snapshots. Cancel a genuinely unearned order and return its commitment to plan capacity once.
7. Record an externally made TEST payment for selected unpaid earnings. Verify settlement, private reference, no duplicate application and no transfer API request.
8. Verify source reversal protection, interrupted processing, cross-store/mode rejection and consistent period activity versus current-balance report/PDF totals.

Existing successful hosted GCash and pickup testing is not proof that these new incentive steps have been executed. Hosted card acceptance remains separate and pending.
