# Admin staff management and store assignments

Date: October 19, 2026.
Status: React integration implemented and automated checks passed; the user
reported browser testing done, then requested Admin Store Management. Individual
manual case results were not recorded by the assistant. This connects the existing
Feature 2A/2B APIs. It does not start Feature 5 or require a new database migration.

## What is functional

Open `/admin/staff` through Admin > Staff Management.

- Load real Supervisor and Inventory Worker accounts, Admin approval state, current
  store, store address/status, and active destination stores.
- Search name/email/ID/store, filter role/approval, refresh, and show real counts.
- Create a Supervisor or Inventory Worker account with a profile and password.
  The existing backend records the authenticated Admin's approval automatically.
  Email verification remains separate from staff approval.
- Approve existing pending staff through a confirmation dialog. Approval retries
  preserve the original approver and timestamp in the backend.
- Assign approved staff to an active store, or transfer them to another active
  store. The dialog identifies stores by name, ID, and address, and shows the
  current/destination store before submission. Selecting the current store does
  not enable a redundant save.
- Show field validation, session/authentication failures, loading/retry and empty
  states. Mutations disable repeated submissions while saving. Native dialogs
  handle focus containment and Escape dismissal; dismissal is blocked during save.

Scope: login staff accounts only. Picking/packing personnel remain non-login
workers belonging to their store. Account editing/deletion, password resets, new
roles, and store CRUD are outside this UI integration. Existing Supervisor
assignment permissions are unchanged. The separate Role Management prototype and
other Admin prototype screens were not converted into real modules by this work.

## Files changed for this integration

- `frontend/src/pages/admin/StaffManagement.jsx`: real staff list, search/filter,
  approval/assignment actions, success and loading/error states.
- `frontend/src/components/admin/StaffActionDialog.jsx`: creation, approval, and
  assignment/transfer forms, validation messages and pending-submission handling.
- `frontend/src/hooks/useAdminStaff.js`: cancellable reads, retry and response checks.
- `frontend/src/services/api.js`: four Admin service calls using the existing
  Sanctum cookie/session and CSRF helpers; whitelisted creation/assignment bodies.
- `frontend/src/components/admin/AdminLayout.jsx`: Staff Management sidebar link.
- `frontend/src/routes/AppRoutes.jsx`: `/admin/staff` inside the Admin-only route.
- `frontend/tests/admin-staff-api.test.mjs`: request/response/security error contracts.
- `frontend/package.json`: `npm run test:staff`.

Existing unrelated edits in AdminLayout, AppRoutes and the shared API client were
preserved. No backend source or schema change was needed for this integration.

## Existing API contract used

| Method | Path | Purpose |
|---|---|---|
| GET | /api/admin/staff-store-assignments | Login staff, current assignments, active store choices |
| POST | /api/admin/staff | Create account/profile and record Admin approval |
| PUT | /api/admin/staff/{user}/approval | Approve existing staff |
| PUT | /api/admin/staff/{user}/store-assignment | Assign or transfer approved staff |

All four routes enforce Sanctum authentication and the Admin role. The backend
validates the selected role/store, rejects unapproved targets and inactive stores,
and derives the approval/assignment actor from the authenticated session. The
frontend sends no approver IDs, approval timestamps, role IDs or client-selected
user ID in mutation bodies. These frontend restrictions supplement the backend;
the backend remains responsible for authorization.

Create and assign are deliberately two explicit operations. If assignment fails,
the created account stays visible as Unassigned and can be assigned again without
recreating the account. Every successful mutation refreshes the staff list from
the database. If that read fails, the success notice stays visible alongside a
reload error, rather than inviting a second account creation.

## Automated checks executed

- `php artisan test`: 156 passed, 2,034 assertions; zero failed. Existing guarded
  SQLite `:memory:` tests cover account/profile transaction rollback, role/guest
  rejection, duplicate credentials, approval metadata, active-store placement,
  transfer persistence, and isolation between stores. No working MariaDB test
  records were created or changed.
- `node --test tests/admin-staff-api.test.mjs tests/inventory-api.test.mjs`:
  18 passed (10 staff, 8 inventory); zero failed. HTTP is mocked for these tests.
- ESLint: changed JS/JSX integration files passed.
- Vite production build: passed. The existing bundle-size advisory remains
  (approximately 601 kB minified JavaScript before gzip).
- Browser operations and React form interactions: pending the user's manual test.

## Exact browser acceptance checklist

Use your usual running frontend and Laravel servers. No migration or seeder is
needed. New accounts created through these steps will persist in your local DB.

1. Log in as Admin. Click Staff Management, or open
   `http://localhost:5173/admin/staff`. Confirm the real staff list and current
   stores. Search an existing email, filter role/approval, clear filters, refresh.
2. Click Create Staff Account. Enter a new first/last name, unused email and unused
   Philippine mobile number (`09...` or `+639...`), a password of at least eight
   characters and matching confirmation, optional address, and Supervisor role.
   Click Create and approve account. Expect a success message and a new Approved,
   Unassigned row. Clear filters if necessary, then refresh the browser to confirm
   persistence. Repeat for an Inventory Worker with different unused credentials.
3. In each new row, click Assign store. Choose Store A (check ID/address), save and
   refresh. Expect Store A on both rows. Log in as the new Inventory Worker in a
   separate browser profile and open `/inventory/products`; the Store A workspace
   should load. As the new Supervisor, `/supervisor/inventory` shows Store A data.
4. On any existing Pending approval row, verify Assign store is disabled. Click
   Approve account, inspect the account identity, and confirm approval. Refresh:
   Approved persists and assignment is enabled. If no pending rows exist, this
   manual case is unavailable without a fixture; the automated backend test covers
   it. Do not create an unapproved account by bypassing the approved UI.
5. For the test Inventory Worker, click Transfer store. Choose Store B and read
   the displayed transfer before saving. Refresh: the row shows Store B; other
   staff stay assigned as before. Refresh that worker's Products page in its
   separate browser profile: Store B data replaces Store A data. Store A products
   cannot be listed/edited by that worker; Store A staff still see Store A data.
   Use test accounts so transferring does not disrupt your normal working staff.
6. Open another transfer and choose its current store: save remains disabled.
   Choose another store, then Cancel (also try Escape): refresh and confirm no
   assignment change. Test creating an account and cancelling before submission.
7. Attempt a duplicate email/phone (including local vs international phone format),
   invalid phone, short password, and mismatched confirmation. Browser validation
   or Laravel field errors must prevent creation. After a server error, correct
   the values and retry. No success notice should appear for a failed request.
8. Confirm inactive stores are excluded from destination choices. Staff currently
   at an inactive store are labelled, and can be transferred to an active store.
   If no inactive store exists, this case is covered by the backend tests.
9. Log out: `/admin/staff` redirects to login. Sign in as Shopper, Inventory Worker,
   or Supervisor and try that URL: it must not render Admin controls. Direct Admin
   API requests return 401 as guest and 403 under non-Admin accounts.
10. While on the staff page, switch the browser network to Offline and click
    Refresh: show a retry error instead of demo rows. Restore the connection and
    Retry. Check dialog keyboard navigation, cancel and saving-disabled controls.

For read-only database verification after creation/assignment, use your DB viewer:

```sql
SELECT u.id, u.email, r.slug AS role,
       u.staff_approved_at, u.staff_approved_by_user_id,
       a.id AS assignment_id, a.store_id, s.store_name,
       a.assigned_by_user_id
FROM users u
JOIN roles r ON r.role_id = u.role_id
LEFT JOIN staff_store_assignments a ON a.user_id = u.id
LEFT JOIN stores s ON s.store_id = a.store_id
WHERE r.slug IN ('supervisor', 'inventory_worker')
ORDER BY u.id;
```

After a transfer, the assignment_id should stay the same while store_id changes.
Approval and assignment actor IDs should identify the Admin who performed each
action. Do not query or copy password hashes for this verification.

## Debugging and handoff notes

React form -> shared API service -> Admin-only Laravel route -> existing
AdminStaffController or StaffStoreAssignmentController -> User/Profile or
StaffStoreAssignment -> database -> JSON -> success notice and list reload.

For a failure, inspect the browser Network response status/body first. A 422
contains field errors; a 401 requires login; 419 concerns the CSRF/session cookie;
403 means the session is not an Admin; 429 requires waiting for the write rate
limit. Network/500 failures leave an uncertain write outcome: refresh the staff
list before retrying account creation. Laravel logs are in
`backend/laravel/storage/logs/laravel.log`.

Team summary: existing Features 2A/2B now have an Admin React interface using real
accounts and store choices. No new tables, roles or endpoints. Preserve the four
login roles and server-side assignment checks. The user reported manual completion;
this report does not independently count a new module-role point as complete or
authorize starting Feature 5.
