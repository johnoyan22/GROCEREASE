# Selective AI integration and acceptance

Date: 9 November 2026 (Asia/Manila). Base: `feature/multi-store-foundation`
at `c64f2c976025c19489004383cd6b733aaa74dfa6`. Source: Habel's
`habel-ai-order-prep` at `e3e4e31a810c93560d43904268a56a2488c5638a`.
Integration branch: `feature/ai-integration`.

Implementation is ready for review. Manual browser acceptance and real Gemini
acceptance are **pending**; this is not an accepted/released module and no
module-role point is awarded. See [the compatibility audit](ai-compatibility-audit.md)
for the file-by-file reuse/adaptation/rejection decisions and source discovery.

## Result and rules

Habel's text/image interpretation and recommendation UI are selectively adapted
to the foundation. The engine reads `products.product_name` through inventory
owned by the selected store, uses `store_inventory.selling_price`, and calculates
availability as `hard_stock_qty - soft_stock_qty`. The inventory's active status
is the foundation's product activation mechanism; products have no independent
status column. Both product and inventory ownership must match an active store.

The existing Browse store choice now also binds the signed-in session through
`PUT /api/shopper/selected-store`. AI requests have an explicit store path and
must match that account's session selection. Query/body ownership overrides
are rejected. A different tab selecting another store produces a reviewable
409 conflict instead of cross-store inventory. The shared cart retains its
existing confirmation before clearing items on a store switch.

`useShopperCart` remains the single cart owner. AI's safe add callback validates
the recommendation with the backend, resolves the actual current inventory row,
checks expected price/stock version, total desired quantity, active status,
category policy and current limits, and uses the existing `changeCartQuantity`.
It rejects responses if the cart/store/account changed while waiting. The real
header count, My Cart and account-keyed session persistence share that update.
The check does not reserve stock. Checkout's existing price/stock review and
transactional reservation remain authoritative.

Settings have one unique row per store, with server-owned `updated_by`, timestamp,
and a separate append-only audit of before/after values. `StoreStaffAccess`
resolves approved Supervisors and active assignments inside transactions. A
stale expected store causes 409 after reassignment. Admin platform controls,
Supervisor pickup settings, stock approval, delegation, preparation, payment,
claiming and order records were not replaced.

### Purchase dataset and ranking

Eligible orders must belong to the selected store, have status and claim status
`completed`, payment status `paid`, reservation status `fulfilled`, a non-null
completion time, no cancellation/unclaimed time, a physical handover record,
and payment evidence accepted by the foundation's `PaymentEvidence` service.
History additionally requires `orders.shopper_user_id` to match the current
Shopper. Units come from `order_items.store_inventory_id`, joined to inventory
and actual product categories in the same store. Pending, unpaid, canceled,
No-Show and unresolved expired orders cannot contribute purchase signals.

* Popularity: eligible fulfilled units per inventory item, divided by the largest
  fulfilled-unit count in this store. No eligible activity means zero popularity.
* Purchase history: 3 points for a previously bought item, plus 2 points for a
  previously bought category; with no own history use real store popularity.
* Hybrid: history score + normalized popularity + 1.5 for a category in the
  validated current cart. Products already in the cart are omitted from the
  recommendation grid.
* Ties: product name, then inventory ID. The available-inventory fallback has an
  honest availability reason and never pretends that someone purchased it.
* Local queries match real names/categories, including documented spaghetti,
  breakfast and snack keyword associations. Affordable queries prioritize price;
  other local matches use the configured ranking. Valid Gemini picks retain the
  provider's relevance order. Integer-centavo budget checks limit the estimated
  subtotal. One unit per match is a starting point; headcount is context, not a
  serving-size or nutrition claim. Checkout determines the final quote.
* Alternatives: active available items of the same actual category and selected
  store, ordered by absolute current price difference, then inventory ID. They
  respect category settings and quantity limits, and never modify an order.

### Provider, uploads and cache

`GEMINI_API_KEY`, `GEMINI_MODEL` and optional `GEMINI_TIMEOUT` remain backend-only.
They are optional; the existing `.env` is preserved. A safe presence check found
no key and no model configured. No real Gemini request was sent.

Habel's Gemini REST structured-JSON approach is retained, with bounded connection
and total timeouts, sanitized error logs and strict integer catalog-ID filtering.
Missing configuration, timeout, quota, invalid JSON and unusable IDs produce an
explicit local keyword fallback for text. Images require the provider and return
an actionable unavailable/no-match response when appropriate. Provider text is
never trusted for catalog prices, stock, payment state or cart contents. The
catalog is read again after provider latency, including current settings.
Gemini receives at most 300 eligible catalog rows and may return at most 12
validated picks per interpretation. Local keyword matching searches the eligible
catalog; its limited associations are shopping hints, not a complete meal plan.

Uploads require actual JPEG/PNG/WebP MIME and image validation, at most 4 MiB,
dimensions at most 6000×6000, and explicit provider consent. The UI explains that
the image goes to Gemini. PHP's temporary upload is read once; the application
does not permanently store or log the photo. System instructions treat photo
and note instructions as untrusted content. Only matched real catalog products
are presented; unverified nutritional claims are not rendered.

No text/image/recommendation results are cached. Responses use private/no-store;
store/catalog changes remount the AI view and abort/ignore obsolete work. The
only AI cache is a 60-second provider quota cooldown, keyed by a hash of provider
key/model identity, with no images, catalog results, shopper IDs or private text.

## API contract

All Shopper endpoints require Sanctum session authentication, active account,
Shopper role and verified email. All store AI operations also require the
session-bound selection. Paths below include `/api`.

| Method | Endpoint | Purpose and limit per signed-in user |
| --- | --- | --- |
| PUT | `/shopper/selected-store` | Bind active store; 60/minute. Does not depend on AI schema. |
| GET | `/shopper/stores/{store}/ai-recommendations` | Grid; optional `cart_inventory_ids[]`; 60/minute. |
| POST | `/shopper/stores/{store}/ai-recommendations/ask` | Query, 2–500 characters; 15/minute. |
| POST | `/shopper/stores/{store}/ai-recommendations/image` | Multipart `image`, optional `note`, `provider_consent`; 5/minute. |
| GET | `/shopper/stores/{store}/ai-recommendations/alternatives/{item}` | `{item}` is a store inventory ID; 60/minute. |
| POST | `/shopper/stores/{store}/ai-recommendations/items/{item}/cart-check` | `quantity`, `expected_price`, `stock_version`; 30/minute. |
| GET | `/supervisor/ai-recommendation/settings` | Assigned-store settings, real categories, dataset rule and recent audit metadata. |
| PUT | `/supervisor/ai-recommendation/settings` | Six supported settings plus `expected_store_id`; 20/minute; ownership/actor cannot be overridden. |

Supervisor routes require Sanctum, active account, Supervisor role, Admin staff
approval and an active assigned store. AI endpoints never perform checkout,
reserve stock, delegate workers, substitute an ordered item or set order status.

## Migration and preservation

The exact new migration is
`backend/laravel/database/migrations/2026_11_09_000017_create_store_ai_recommendation_settings.php`.
It creates only:

* `store_ai_recommendation_settings`: unique `store_id → stores.store_id`,
  `updated_by → users.id`, recommendation fields and timestamps.
* `ai_recommendation_setting_audits`: `store_id → stores.store_id`,
  `changed_by → users.id`, JSON before/after settings and creation timestamp.

Habel's singleton migration was inspected but is absent from the foundation and
was not imported or edited. No historical foundation migration was changed.
No product/order/payment/stock table is recreated, altered, reseeded or reset.

Both focused preservation tests passed in guarded, disposable SQLite databases:

1. A real completed order, payment evidence, claimant verification and handover,
   plus a separate genuine COP strike, are created through foundation workflows.
   Every existing table's column metadata and rows are snapshotted. Applying the
   exact AI migration preserves every snapshot and starts both new tables empty.
   Rolling it back preserves every original row again. This covers users, stock,
   prices, order/payment references, staff, workers, COP records and store hours.
2. The AI migration also runs with unrelated `000015` and `000016` absent, leaves
   them absent, preserves inventory exactly, and leaves COP quoting usable.

The normal working database was not migrated. The browser/HTTP fixture also
explicitly skips `000015` and `000016`. Applying the AI migration to a working
database remains subject to the user's separate approval. After that approval,
review a private backup and use only the explicit AI `--path`, never an
unqualified migrate, reset, fresh or seed command.

## Executed checks

Run backend commands from `backend/laravel`, frontend commands from `frontend`.

| Check | Baseline | Final |
| --- | --- | --- |
| `php vendor/bin/phpunit --do-not-cache-result` | 337 tests / 5,436 assertions passed | 357 tests / 5,957 assertions passed |
| `php vendor/bin/phpunit --do-not-cache-result --filter AiRecommendation` | Not present | 20 tests / 521 assertions passed, including both preservation tests |
| `npm test` | 99 passed, 3 failed from expired October Checkout fixture dates | 113 passed, 0 failed |
| `npm run build` | Passed | Passed; existing large-bundle warning remains |
| Scoped ESLint (command below) | Not recorded | Passed |
| `node tests/ai-http-smoke.mjs` | Not present | Passed against actual isolated Laravel HTTP server, with sessions and CSRF enabled |
| Manual browser tests | Not executed | Blocked: browser access host unavailable; native pipe unavailable; no usable browser/app surface |
| Real Gemini text/image tests | Not executed | Blocked: backend key and model absent; no real-provider success claim |

The optional MariaDB transaction smoke script was not run; database regression
and migration-preservation evidence here is from isolated SQLite. No result is
claimed for a live MariaDB integration environment.

Scoped lint command:

```powershell
npx --no-install eslint src/components/Shoppers/ShopperAIrecommendations.jsx src/components/Supervisor/SupervisorAiSettings.jsx src/components/Supervisor/SupervisorSystemConfiguration.jsx src/hooks/useShopperCart.js src/pages/shopper/ShopperDashboard.jsx src/services/habelApi.js src/services/api.js
```

The full existing regression suite covers authentication/registration, email
verification, pickup scheduling, stock updates/approval, COP quoting/checkout and
cancellation, order tracking, preparation/delegation, PIN/QR verification,
cashier confirmation, physical handover, receipts, COP restrictions and provider
guards. It passed with the AI changes. This is automated regression evidence,
not a claim of new manual browser testing for those workflows.

The three pre-existing Checkout UI test failures were corrected by choosing a
future Philippine-local date in the test fixture. Checkout production code was
not changed. Additional component tests exercise real shared-cart wiring with
mock HTTP responses; actual HTTP checks separately verify cookie/CSRF behavior,
store isolation, local budgets, alternatives, current cart checks, image-service
unavailability, assigned-store settings persistence/audit and identical pickup
settings before/after AI configuration.

## Manual acceptance still required

Use a disposable environment, not a live store/account. A guarded fixture script
is provided at `backend/laravel/tests/ai-browser-sandbox.php`. It requires
`APP_ENV=ai_acceptance`, `DB_CONNECTION=sqlite`, an empty absolute
`storage/app/ai-acceptance.sqlite`, and refuses other targets. It uses test-only
accounts `ai-shopper@example.test` and `ai-supervisor@example.test`, password
`SandboxPass123!`. These are synthetic fixtures, not existing user credentials.

For the sandbox, set a test-only APP_KEY, file sessions, array mail, synchronous
queue and disabled provider configuration in the process environment; never
overwrite `.env`. Start Laravel at `http://127.0.0.1:8180`, set frontend
`VITE_API_URL=http://127.0.0.1:8180/api`, and start Vite at
`http://127.0.0.1:5173`. Use `SESSION_DOMAIN=127.0.0.1`, a distinct
`SESSION_COOKIE=grocerease_ai_acceptance_session`, and
`SANCTUM_STATEFUL_DOMAINS=127.0.0.1:5173`. Runtime APP_ENV must remain
`ai_acceptance`, not `testing`, so HTTP CSRF protection is exercised. Do not
replace an already-running server on those ports. The fixture/database is
ignored by Git; servers used for this run are stopped afterward.

Shopper checklist (all unchecked items require manual verification):

- [ ] Login as a verified fixture Shopper. Before selecting a store, AI explains
  the requirement and opens the existing Browse selector.
- [ ] Select Store A. Confirm grid names/prices/availability and no Store B items.
- [ ] Ask “Ingredients for spaghetti under ₱500”, “Breakfast for 4 people” and
  “Affordable snacks”. Check truthful matches, fallback label and estimate text.
- [ ] Add a grid/query/alternative item. Check Header, My Cart, current prices,
  quantity limit, duplicate-row prevention and persistence after refresh.
- [ ] Switch stores through the existing clear-cart confirmation; verify old AI
  results disappear, Store B prices apply and slow requests cannot restore A.
- [ ] Log out/in as another Shopper; confirm no inherited cart/history/results.
- [ ] Change price/stock/status/limit in the disposable dataset. A stale AI add
  fails safely; refreshed results show the actual catalog. Checkout still needs
  its ordinary review and stock validation.
- [ ] Review alternatives: same category/store, genuine price, no order changes.
- [ ] Try unsupported/oversize/invalid uploads and decline provider consent.
  Verify errors and rate limiting. With no provider, valid uploads show the
  unavailable message and text matching remains usable.
- [ ] With separately configured Gemini credentials, test an approved non-private
  grocery photo, non-grocery photo, no matches, timeout and quota. Confirm no
  invented products, private image storage or photo-instruction following.

Supervisor checklist:

- [ ] Open System Configuration as the approved assigned Supervisor; verify the
  existing pickup-hours screen remains present and retains its values.
- [ ] Save and refresh each recommendation setting: enabled, maximum count,
  basis, included/excluded real categories, and alternatives.
- [ ] Confirm dataset explanation, update actor/time and change-audit metadata.
- [ ] Confirm overlapping/unknown categories and invalid counts are rejected.
- [ ] Another store's Supervisor sees only that store's settings. Unapproved,
  unassigned, inactive-store, Shopper, Inventory Worker and Admin accounts cannot
  use this Supervisor endpoint. Admin platform controls remain separate.
- [ ] Reassign the Supervisor while its form is open; stale saving must fail and
  require refreshing the assigned-store screen.
- [ ] Recheck pickup scheduling, stock approval and existing fulfillment flow.

Official module alignment:

| Official requirement | Implemented evidence | Acceptance status |
| --- | --- | --- |
| Shopper — Receive Product Recommendations | Grid, query, image flow, store/history guards and shared cart; API/component/HTTP tests | Manual and real-image provider acceptance pending |
| Shopper — View Alternative Product Suggestions | Same-store/category alternatives and guarded explicit add; API/component/HTTP tests | Manual browser acceptance pending |
| Supervisor — Manage Recommendation Basis / Dataset | Store settings, real category selection, documented completed-purchase rules, ownership and audit; API/component/HTTP tests | Manual browser acceptance pending |

No additional module points or adviser-phase features are introduced. The next
phase must wait for acceptance of this branch. No foundation merge, force-push,
Habel branch deletion or adviser branch creation is part of this delivery.

## Changed files

| File | Change |
| --- | --- |
| `backend/laravel/.env.example` | Modified |
| `backend/laravel/app/Http/Controllers/Api/ShopperAiRecommendationController.php` | New |
| `backend/laravel/app/Http/Controllers/Api/SupervisorAiRecommendationController.php` | New |
| `backend/laravel/app/Models/AiRecommendationSetting.php` | New |
| `backend/laravel/app/Services/AiRecommendation/GeminiClient.php` | New |
| `backend/laravel/app/Services/AiRecommendation/ImageUnderstanding.php` | New |
| `backend/laravel/app/Services/AiRecommendation/QueryParser.php` | New |
| `backend/laravel/app/Services/AiRecommendation/QueryUnderstanding.php` | New |
| `backend/laravel/app/Services/AiRecommendation/RecommendationEngine.php` | New |
| `backend/laravel/app/Services/AiRecommendation/SelectedStore.php` | New |
| `backend/laravel/config/habel_ai.php` | New |
| `backend/laravel/database/migrations/2026_11_09_000017_create_store_ai_recommendation_settings.php` | New |
| `backend/laravel/routes/api.php` | Modified |
| `backend/laravel/routes/habel.php` | New |
| `backend/laravel/tests/ai-browser-sandbox.php` | New |
| `backend/laravel/tests/Feature/AiRecommendationMigrationTest.php` | New |
| `backend/laravel/tests/Feature/AiRecommendationTest.php` | New |
| `docs/ai-compatibility-audit.md` | New |
| `docs/ai-integration-acceptance.md` | New |
| `docs/ai-integration-pr.md` | New |
| `frontend/src/components/Shoppers/ShopperAIrecommendations.jsx` | Modified |
| `frontend/src/components/Supervisor/SupervisorAiSettings.jsx` | New |
| `frontend/src/components/Supervisor/SupervisorSystemConfiguration.jsx` | Modified |
| `frontend/src/hooks/useShopperCart.js` | Modified |
| `frontend/src/pages/shopper/ShopperDashboard.jsx` | Modified |
| `frontend/src/services/api.js` | Modified |
| `frontend/src/services/habelApi.js` | New |
| `frontend/tests/ai-api.test.mjs` | New |
| `frontend/tests/ai-http-smoke.mjs` | New |
| `frontend/tests/shopper-workspace.test.mjs` | Modified |
