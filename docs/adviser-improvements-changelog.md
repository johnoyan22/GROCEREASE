# Adviser improvement checkpoints

Date: 2026-11-13. Branch: `feature/adviser-improvements`. No pushes or merges.

## 1. Audit and baseline

- Inspected clean integration branch at reviewed `b611ae3`; fetched origin (no newer integration commits).
- Baseline Laravel: **357 passed, 5,957 assertions**, disposable SQLite.
- Baseline frontend: **113 passed**, ESLint passed, Vite production build passed.
- Existing large-JavaScript-chunk warning retained as a performance concern.
- Working MySQL was not migrated, reset or seeded. Environment files untouched.

## 2. Authentication and profiles

- Removed disconnected Google Login/Register buttons and dead Forgot Password action.
- Kept email/password and verified-email role redirects; no OAuth backend existed to remove.
- Reused Shopper profile API; private, own-account JPEG/PNG/WebP photo upload,
  replacement and removal (2 MB, maximum 4096 px). Existing `profiles.imagesrc`
  stores randomized references; no schema change required.
- Shared `components/shared/Avatar.jsx` uses actual names for staff initials;
  header and profile instances update from current account data.
- Removed unsaved Shopper preference controls and disabled staff global search/cart.
- Account & Security retains the existing password workflow; staff identity permissions unchanged.
- Login/Register layouts now stack on phones.

Phase results and later checkpoints are appended as executed. Human acceptance,
provider acceptance and working-database setup are separate from automated tests.

Checkpoint 2 validation: **49 Laravel tests / 521 assertions** for photo, profile,
staff account, authentication and email verification; **114 frontend tests**,
ESLint and production build passed. Initial photo fixture required GD; replaced
with an actual PNG fixture so no PHP configuration change is required.

