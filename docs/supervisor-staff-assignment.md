# Supervisor Store Workers

Date: October 19, 2026.
Status: React integration implemented and automated checks passed; user browser
verification pending. This connects existing Feature 2B endpoints without starting
stock requests or order delegation.

## Functional scope

Supervisor > Store Workers opens `/supervisor/workers`, with two category buttons:

- Inventory Workers: the working account-assignment functionality described below.
- Pickers & Packers: a clearly labelled Pending implementation panel. Registration,
  editing, and order assignment are not available for these non-login personnel yet.

There is one Store Workers sidebar item. The former `/supervisor/staff` frontend
URL redirects to `/supervisor/workers`; the backend API URLs remain unchanged.

- Displays the real assigned store, address and ID.
- Lists Inventory Workers assigned to that store and their Admin approval state.
  Inventory Workers assigned elsewhere do not appear in this list.
- Separately lists Admin-approved Inventory Worker accounts with no store
  assignment: the existing approved pool for assignment to a store.
- Searches both lists by name/email/account ID and shows real counts.
- Confirms the selected account and assigned store before submission. The account
  enters the store's staff list after success and leaves the available list.
- Handles loading, empty/search-empty, retry, success and failure states. Native
  dialogs contain keyboard focus, allow Cancel/Escape when idle, and block repeated
  submissions/dismissal while saving.
- Handles a candidate claimed elsewhere after loading: 409 and Refresh staff list,
  rather than a retry of the stale selection.

The Inventory Workers category manages authenticated accounts. Picker/packer
records will remain separate non-login personnel records inside the same Store
Workers area. The old picker/packer prototype source is preserved but is no longer
the routed workers page. Account creation/approval and transfers between stores
remain Admin operations. No new login roles or migration needed.

## Existing API and authorization

| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/supervisor/staff | None | store, staff[], available_staff[] |
| PUT | /api/supervisor/staff/{user}/store-assignment | {} | message, assignment |

The client does not submit a store ID, actor ID, role or approval fields. Laravel
gets the Supervisor from the Sanctum session, checks approval and active store
assignment, locks the participating users/assignment/store, and saves the worker's
placement with the Supervisor's users.id as assigned_by_user_id. Only approved
Inventory Worker targets qualify.

Existing placement elsewhere returns 409. Repeating a same-store assignment keeps
the original row ID, actor and timestamps. Ineligible targets return 422; missing
accounts 404; unauthorized/unapproved/unassigned/inactive-store Supervisors 403;
guests 401; throttled writes 429. Store/actor overrides are rejected by Laravel.

Laravel resolves the store again at write time. If Admin changes a Supervisor's
store while an old page is open, the current authorized store is used. Success
names the actual store returned by the API, and reloads the store and both lists.
Refresh before assigning after an Admin placement change.

## Files changed

- `frontend/src/components/Supervisor/SupervisorStoreWorkers.jsx`: combined Store
  Workers area, real Inventory Worker lists/search/counts/assignment, and pending
  Pickers & Packers category. Renamed from SupervisorStaffAssignments.jsx.
- `frontend/src/components/Supervisor/StaffAssignmentDialog.jsx`: confirmation,
  pending guard, errors and refresh-before-retry behavior.
- `frontend/src/hooks/useSupervisorStaff.js`: cancellable reads, response checks,
  error/reload handling; clears old lists while loading/on failure.
- `frontend/src/services/api.js`: getSupervisorStaff and assignSupervisorStaff,
  reusing shared Sanctum/CSRF helpers.
- `frontend/src/components/Supervisor/SupervisorApp.jsx`: workers route and old
  staff URL redirect.
- `frontend/src/components/Supervisor/SupervisorSidebar.jsx`: single Store Workers link.
- `frontend/tests/supervisor-staff-api.test.mjs`: nine contract/error tests.
- `frontend/package.json`: `npm run test:supervisor-staff`.

No backend source/schema change. Existing Admin, Store Products and other edits
were preserved. The new page uses actual endpoint data rather than mock
SupervisorContext picker/packer records or static storeInfo.

## Checks executed

- `php artisan test --compact`: **180 passed, 2,476 assertions**, zero failed.
  Guarded SQLite `:memory:` tests cover approval, persistence, eligible-list/store
  scoping, same-store retries, cross-store rejection, actor overrides, role/guest
  checks and inactive stores. No working MariaDB records changed by tests.
- Node API tests for Supervisor staff, Admin staff/stores and inventory:
  **35 passed**, zero failed (nine new Supervisor tests); HTTP requests are mocked.
- ESLint: all changed JS/JSX files passed.
- Vite build passed; existing bundle-size advisory remains (about 621 kB minified
  JavaScript before gzip).
- `artisan route:list --path=supervisor/staff -vv`: both routes retain Sanctum and
  Supervisor-role middleware; assignment retains its 20/min throttle.
- Browser interactions and working MariaDB mutation verification are pending the
  user's manual test. No migration, seeder or automatic staff reassignment ran.

## Exact browser acceptance checklist

Use your usual frontend/Laravel servers. These browser actions intentionally save
test staff placements to your local database.

1. As Admin, ensure Store A and Store B are active. Place an approved test Supervisor
   in each using `/admin/staff`. Create an approved test Inventory Worker with
   unused credentials, and leave it Unassigned. Optionally assign a different test
   Inventory Worker to each store to check the own-store lists. Record store/user
   IDs: multiple branches may share a name.
2. In a separate browser profile, log in as Supervisor A. Open Store Workers or
   `http://localhost:5173/supervisor/workers`, then Inventory Workers. Confirm Store A's name/address/ID and
   assigned Inventory Workers. The new unassigned worker appears under Available.
   Store B's assigned staff must not appear in either list. Supervisors, Shoppers,
   Admins and unapproved Inventory Workers must not appear as candidates.
3. Search a name/email/ID and clear. Both lists should filter/restore with correct
   counts and empty-search messages.
4. Click Assign to my store for the available test account. Check identity and
   Store A. Cancel (also try Escape), refresh: it stays available. Open and confirm
   again: success names Store A and the worker moves into the assigned list.
   Refresh the browser to verify persistence and the reduced available count.
5. As Admin, refresh Staff Management: the account belongs to Store A. The database
   assignment actor is Supervisor A. Log in as that Inventory Worker in another
   profile and open `/inventory/products` or `/inventory/stock`: Store A data loads.
6. As Supervisor B, refresh Store Workers: that worker is absent from both B's
   assigned list and the available pool. For a race check, create another approved
   unassigned test worker, leave A's confirmation open, assign that worker to B in
   another profile, then submit A's old dialog. Expect 409 and a refresh action,
   with no success or automatic retry. Refresh removes the stale candidate and
   placement stays with B.
7. As Admin, deactivate A's test store. Refresh A's staff page: access is denied and
   lists/actions disappear. Submission from an old dialog also returns 403 without
   assigning anyone. Reactivate and Retry: existing staff return. An unassigned or
   unapproved Supervisor is also denied; if no fixture exists, backend tests cover it.
8. Log out and visit `/supervisor/workers`: expect login. As Admin, Shopper or Inventory
   Worker, that URL must not show Supervisor controls; direct Supervisor API calls
   return 403. Guest API calls return 401.
9. For API boundary checks, GET `/api/supervisor/staff?store_id=<B>` and an assignment
   body containing store_id/assigned_by_user_id return 422, preserving placement.
   A nonexistent target ID returns 404. Use the existing
   [CSRF-enabled console helper](feature-4-store-inventory.md#csrf-enabled-browser-console-helper)
   for manual writes so Sanctum cookies/CSRF headers are included.
10. Set the browser network Offline and Refresh: error and Retry replace the lists.
    Restore the connection and retry. If an assignment response is lost, refresh
    before retrying: placement may already have succeeded. Check keyboard focus,
    Cancel/Escape and disabled controls during saving.

Read-only database verification (replace 12 with the test Inventory Worker's ID):

```sql
SELECT a.id, a.user_id, a.store_id, s.store_name, a.assigned_by_user_id,
       a.created_at, a.updated_at
FROM staff_store_assignments a
JOIN stores s ON s.store_id = a.store_id
WHERE a.user_id = 12;
```

Expect one row, the authorized store, and Supervisor's user ID as actor for a new
assignment. Another store's failed claim must not alter the row. Admin approval
metadata remains separate from the Supervisor's assignment actor.

## Handoff and debugging

SupervisorStoreWorkers -> assignSupervisorStaff -> session/CSRF request ->
Supervisor-only route -> StaffStoreAssignmentController::supervisorAssign ->
authorization/locks -> StaffStoreAssignment -> database -> JSON -> actual-store
success message -> reload both lists.

Inspect browser Network status/body, then
`backend/laravel/storage/logs/laravel.log`. 409 means assigned elsewhere; 422 means
invalid target/input; 403 means role/approval/store access does not qualify; 419
concerns the CSRF/session cookie. Refresh closes stale selections. Assignment never
creates credentials or changes account approval.

This Feature 2B UI integration is ready for manual verification. The next separate
workflow is Inventory Worker Stock Update Requests and Supervisor Stock Approval,
after confirming the outstanding stock quantity/action policy.

## Store Workers navigation check

1. Confirm the Supervisor sidebar has one Store Workers item, replacing the
   separate Staff Assignment and Pickers & Packers items.
2. Open it: Inventory Workers retains the real assigned/available lists and
   assignment dialog. Verify one existing assignment flow and refresh persistence.
3. Select Pickers & Packers: show Pending implementation and the explanation that
   these personnel have no login accounts. No mock personnel/actions should appear.
4. Return to Inventory Workers and confirm the lists still work. Open the old
   `/supervisor/staff` URL and confirm it redirects to `/supervisor/workers`.

Latest consolidation checks: changed JSX passed ESLint, production build passed,
and all nine Supervisor staff API tests passed. This was a frontend navigation/UI
change; no backend or database changes were made and Laravel tests were not rerun.
