# AI compatibility audit — 9 November 2026

The initial working tree was clean on `feature/multi-store-foundation` at
`c64f2c976025c19489004383cd6b733aaa74dfa6`. `git fetch --all --prune`
confirmed that origin's foundation is unchanged and Habel's source is still
`e3e4e31a810c93560d43904268a56a2488c5638a` (1 November). The integration
branch starts at the foundation commit. No merge or cherry-pick is used.

Source discovery: the fetched origin branches, GitHub repositories visible for
the source author `jphabel`, a `habel grocerease` repository search, and the
connected installation's GrocerEase search revealed no newer AI repository.
This is bounded by accessible repositories; unpublished/private work outside
that access cannot be verified. No teammate was contacted.

| Source file/component | Decision and compatibility work |
| --- | --- |
| ShopperAiRecommendationController.php | Adapt all four AI operations; require authenticated, verified Shopper and session-selected active store. |
| SupervisorAiRecommendationController.php | Adapt validation and payload; resolve approved Supervisor's assignment with StoreStaffAccess. |
| GeminiClient.php | Reuse REST/structured JSON approach; bound timeouts, sanitize error handling, use configured cache instead of hardcoded file storage. |
| QueryParser.php | Reuse budget/headcount parsing; extend documented grocery keywords. Headcount must not imply unverified serving sizes. |
| QueryUnderstanding.php | Reuse catalog-constrained picks; validate types/IDs and fail to explicit keyword fallback; avoid result caching. |
| ImageUnderstanding.php | Reuse temporary upload and catalog-constrained picks; require consent, validate images, never cache images/results. |
| RecommendationEngine.php | Rewrite data access for store_inventory, actual product fields and completed paid fulfilled purchases; retain ranking concepts. |
| AiRecommendationSetting.php | Adapt to one row per store plus append-only setting audit records; reject global singleton. |
| config/habel_ai.php | Reuse backend-only environment configuration; no model/key assumed. |
| routes/habel.php | Adapt to current selected-store routes, existing auth/role/verification middleware and operation rate limits. AI only. |
| 2026_10_19_020000_create_ai_recommendation_settings_table.php | Reject global migration; it is absent from foundation. Add a new store-owned schema migration; do not edit any historical migration. |
| ShopperAIrecommendations.jsx | Adapt real recommendation/text/image UI, add alternatives and safe shared-cart callback, cancel stale requests on store/account changes. |
| services/habelApi.js | Adapt session/CSRF conventions and explicit store paths, preserve abort/error behavior; no preparation APIs. |
| All non-AI source files | Reject: older auth, dashboard, cart, checkout/payment, preparation, delegation, configuration, inventory and unrelated models/migrations. |

The foundation's catalog and cart identify store inventory records, store prices,
hard minus soft availability and per-order limits. Product activation is the
inventory `status` (products have no separate status column). Both inventory
and product ownership must match the selected active store. The existing
account-keyed useShopperCart instance remains the cart owner. AI additions must
fetch a fresh catalog, resolve the actual inventory record and validate before
updating it; Checkout remains responsible for its existing quote/review and
transactional stock validation.

The foundation currently selects stores in browser cart state only. A small
authenticated selected-store session endpoint will bind AI operations to that
choice, and AI routes will reject conflicting paths/parameters. Normal catalog
reads retain their current semantics. Multiple tabs share this session context;
a changed context requires a refresh rather than silently reading another store.

PickupController completes purchases only after payment evidence, claimant
verification and physical handover, setting status/claim_status `completed`,
reservation_status `fulfilled` and completed_at. AI purchase signals will also
require those states and exclude cancellation/unclaimed records. History is
scoped to the signed-in Shopper and selected store. Popularity is fulfilled
units in that store, with no invented activity when none exists.

Baseline (before implementation): frontend `npm test` = 99 passed, 3 failed
(Checkout tests use an elapsed October pickup date); `npm run build` passed
with the existing chunk-size warning. Backend full suite is recorded in the
acceptance report: 337 tests and 5,436 assertions passed. Test-date repair is test-only. No working
database migration, seed, reset or configuration replacement is authorized.
