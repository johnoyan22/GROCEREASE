# Responsive UI verification

Date: 2026-11-13 (Asia/Manila). Automated real-browser tests use local Chrome,
with labeled API fixtures. Backend/database correctness is tested separately in
Laravel SQLite. These checks are not human acceptance or physical-device tests.

## Visual system and corrected issues

- Shared Tailwind v4 tokens: primary `#006E00`, hover `#005400`, dark green
  `#14532D`, page `#F8FAF9`, sans-serif Inter/system stack. No remote font request.
- Replaced serif headings and tiny 8–11 px labels; secondary text uses readable
  contrast; visible focus outlines; 44 px buttons/input touch targets.
- Shopper shell uses a compact wrapping header, scrollable content and native
  focus-trapped navigation drawer. Cart quantity decrement/input/increment and
  totals remain visible. Forms stack on phones; Checkout has native dialog focus,
  Escape/cancel protection and explicit price review.
- Staff retain desktop sidebars. Admin and Supervisor gain native phone drawers;
  existing Inventory Worker responsive navigation stays in place. Wide tables
  scroll inside their containers. No page-wide overflow is intentionally hidden.
- Landing page removes fake nearby store/distance/hours and dead search/actions.
  Guest Start Shopping opens Login; authenticated Shoppers open their dashboard.
  Local original vector artwork is labeled illustrative; actual product photos
  appear only from catalog uploads. See `asset-sources.md`.
- Removed fake-priced dashboard cards, replacing them with selected-store catalog
  products and the shared cart. Admin role counts now use real dashboard data;
  disconnected role-edit controls and unsaved notification preferences removed.
- Route-level code splitting removes the prior Vite large-chunk warning.

## Browser coverage

| Experience | Viewports | Checks | Actual status |
| --- | --- | --- | --- |
| Shopper Dashboard, Browse, AI, Cart, Checkout review, Orders/QR, Pickup Information, Notifications, Profile/Edit, Account & Security | 320, 375, 390, 430, 768, 1024, 1440 px wide | Render, navigation, root/main overflow, cart quantity, explicit quote review, native dialog Escape, readable QR/PIN, profile cancel | Running; final result appended below |
| Public landing, Login, Registration | Same seven widths | Valid guest CTA, responsive layout, preserved auth forms | Running |
| Inventory Worker Dashboard, Products/Add dialog, Stock/Receiving, Notifications, Profile | 1366×768, 1440×900, 1920×1080; 768×1024, 390×844 | Desktop/table containment, mobile access, SKU read-only/category select, avatar, native product modal | Running |
| Supervisor Dashboard, Products, Stock Approvals/Receiving, System Configuration/Categories/AI, Profile, Notifications | Same five staff viewports | Desktop layout, smaller-screen containment, store workflow presentation | Running |
| Admin Dashboard, Reports/Seller Configuration, Role Permissions, Profile | Same five staff viewports | Desktop layout, mobile drawer/layout, no fake settings | Running |

Run `cd frontend; npm run test:responsive`. The config uses installed Windows
Chrome when available, or `GROCEREASE_BROWSER_PATH`; elsewhere install Playwright
Chromium using its standard setup. Fixtures never write the working database or
contact Gemini/PayMongo. Screenshots/results live under ignored `tmp/`.

Human screen-reader checks, physical phones, touch keyboards and real partner
records require the manual acceptance checklist after approved database setup.

Final browser run: **29 passed, 0 failed, 0 skipped** (61.5 seconds). All listed
widths/screens passed the automated overflow and interaction checks. The first
attempt exposed selector casing and incomplete pickup-setting fixtures; both
were corrected, then all 29 cases passed together. In the sandbox the dedicated
Vite preview was managed separately using `GROCEREASE_EXTERNAL_PREVIEW=1` to
avoid a Windows child-process teardown hang; application test behavior is unchanged.
Screenshots visually inspected: 375 px cart and landing, 390 px Checkout,
1440 px landing, and 1366 px Inventory Worker/Supervisor/Admin dashboards.

Frontend component/API suite: **124 passed**; ESLint and Vite build passed.
The main production bundle is approximately 239 kB, versus approximately 637 kB
at baseline; the previous large-chunk warning is gone.

## Focused folder organization

Before:

```text
components/admin/StorePickupSettings.jsx        # shared workspace + Admin wrapper
components/Supervisor/SupervisorSystemConfiguration.jsx  # imported from Admin
components/Shoppers/registerForm.jsx
components/Shoppers/registerHero.jsx
pages/shopper/Register.jsx
```

After:

```text
components/shared/PickupSettingsWorkspace.jsx   # one shared implementation
components/admin/StorePickupSettings.jsx        # read-only Admin dialog wrapper
components/Supervisor/SupervisorPickupSettings.jsx       # editable Supervisor wrapper
components/Supervisor/SupervisorSystemConfiguration.jsx
components/shared/{Avatar,ProductImage,NavigationDrawer,PdfExportButton}.jsx
components/auth/{RegisterForm,RegisterHero}.jsx
pages/auth/RegisterPage.jsx
```

React URLs and backend API paths remain intact. Existing role directories and
their casing are retained; business-critical components were not broadly moved
or duplicated. Supervisor store editing does not move to Admin.
