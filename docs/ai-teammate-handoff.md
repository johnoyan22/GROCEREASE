# Gemini teammate handoff

Branch: `feature/adviser-improvements`, based on reviewed AI integration `b611ae3`.
Date: 2026-11-13 (Asia/Manila). **Real Gemini text/image testing remains pending.**
No API key was requested, invented, stored or tested during this development.

## Preserved integration

- `backend/laravel/routes/habel.php`: selected-store and recommendation/settings routes.
- `app/Services/AiRecommendation/GeminiClient.php`: existing Gemini REST adapter,
  model listing, timeout and provider quota cooldown.
- `QueryUnderstanding.php`, `QueryParser.php`, `ImageUnderstanding.php`: text/
  image interpretation and explicit local-text fallback.
- `RecommendationEngine.php`: actual store-owned inventory, paid/fulfilled
  historical signals, alternatives and quantity/price/stock checks.
- `ShopperAiRecommendationController.php`, `SupervisorAiRecommendationController.php`,
  `AiRecommendationSetting.php`: session/store authorization and audited settings.
- `frontend/src/components/Shoppers/ShopperAIrecommendations.jsx`,
  `components/Supervisor/SupervisorAiSettings.jsx`, `services/habelApi.js` and the
  existing `useShopperCart` callback remain the real UI/cart integration.

Do not merge the full Habel branch again or overwrite the multi-store logic.
Never substitute provider-created products/prices for catalog rows. Cart actions
still do not reserve stock; Checkout is the only atomic reservation path.

Adviser additions are narrow: actual catalog photo/unit presentation; sellable
availability excludes expired/quarantined tracked batches; category renames keep
AI category filters and their audit synchronized. Ranking/provider architecture
and the shared-cart ownership model are preserved.

## Database prerequisite

`2026_11_09_000017_create_store_ai_recommendation_settings.php` is unchanged and
must remain available. Read-only working migration status confirmed **it is
already applied locally** on 2026-11-13. Other environments may differ: inspect
status first; obtain approval before applying it to any working database. It
creates `store_ai_recommendation_settings` and `ai_recommendation_setting_audits`.
Missing setup returns a friendly unavailable message without disabling Browse,
cart or other Supervisor features. Adviser migrations 18–20 have separate review
in `adviser-database-review.md`; do not apply all pending migrations blindly.

## Authorized Gemini setup

Configuration source: `backend/laravel/config/habel_ai.php`.
Environment variable names (values belong only in the existing private environment):

```text
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_TIMEOUT
```

There is no frontend Gemini key. Preserve `.env`; do not replace it with a
sample or commit secrets. The existing adapter uses the Google Gemini v1beta
endpoint and a 3-second connection timeout; total timeout defaults to 12 seconds
and is bounded to 1–20 seconds by the adapter.

Use the authorized key to list eligible models through the existing method:

```text
cd backend/laravel
php artisan tinker
app(\App\Services\AiRecommendation\GeminiClient::class)->models();
```

This contacts the real provider. Run it only as the authorized teammate. Choose
an ID actually returned for `generateContent`, confirm that model/key supports
the intended image input, then set `GEMINI_MODEL` to that returned ID. No model
ID is hardcoded in this handoff. `isConfigured()` checks presence/syntax only;
it is not an acceptance test. Clear stale configuration using the team's normal
deployment process if configuration caching is enabled. Never print the key.

## Text acceptance

1. Sign in as a verified Shopper. Select an active supermarket in Browse.
2. Confirm product prices, integer units and sellable stock against that store.
3. Open AI Recommendations; test a plain product request, budget request,
   category request, no-match request and one with products the store lacks.
4. With no key/invalid setup, verify an honest local keyword fallback. With the
   real key, confirm the UI reports Gemini understanding only after real success.
5. Test timeout/quota/provider errors without leaking credentials or prompts.
6. Add a suggestion and an alternative explicitly. Verify My Cart/header counts,
   store isolation, combined quantities and unchanged stock before Checkout.
7. Change price/availability/category policy while a response is pending. A stale
   suggestion must be rejected or reviewed; it cannot silently change an order.
8. Switch stores and accounts; verify old recommendations/cart drafts never
   reappear across contexts. Test another tab changing the session-selected store.

## Image and consent acceptance

1. Use only authorized, non-sensitive team images. Open Upload Image in the same
   selected store. Check the disclosure that the image goes to Gemini.
2. Attempt submission without consent; it must fail. Then explicitly consent.
3. Test real JPEG/PNG/WebP, at most 4 MB and 6000×6000. Test oversized files,
   unsupported type, executable disguised as an image and invalid image content.
4. Test known catalog groceries, ambiguous images and non-grocery/no-match images.
   Only real eligible catalog inventory IDs may be returned, with current prices,
   whole-unit quantities, limits and stock. No invented brand/catalog item.
5. Provider-unavailable image requests must say unavailable rather than claiming
   recognition. Check cancellation/store switching during an upload and stale responses.
6. Confirm images are not persisted by the AI upload flow or logged with prompts.
   This is separate from optional Worker catalog-photo storage.
7. Review suggested products before adding. Neither recognition nor Add to Cart
   confirms payment, places an order or reserves goods.

## Supervisor settings acceptance

1. Use an approved Supervisor assigned to active Store A. Open System Configuration
   → AI Recommendation Management. Confirm the store name and real category list.
2. Save enabled state, maximum 1–12, ranking basis, included/excluded categories
   and alternatives setting. Refresh and sign in again; values/audit must persist.
3. Rename/archive a category through Store categories. Existing product links,
   AI category policy and purchase history must remain coherent.
4. Reject conflicting inclusion/exclusion, invalid store IDs, foreign inventory,
   unauthorized Worker writes and stale settings after staff reassignment.
5. Repeat in Store B; Store A's configuration/data must remain isolated.

## Automated checks and pending work

```text
cd backend/laravel
php artisan test --filter=AiRecommendation
php artisan test --filter=AdviserCatalogStockTest
cd ../../frontend
npm test
npm run test:responsive
```

Existing `AiRecommendationTest` and `AiRecommendationMigrationTest` use
disposable SQLite/provider HTTP fakes. Frontend `ai-api.test.mjs` and
`shopper-workspace.test.mjs` cover store binding, consent multipart upload,
cart integration, stale responses and settings persistence. Browser fixtures
exercise responsive AI presentation. **None proves real Gemini acceptance.**

Pending: authorized key/model eligibility; actual provider text/image quality,
quota/latency behavior; human consent/privacy review; live partner catalog and
full manual acceptance. Record model ID, date, authorized tester, prompts/images
used under team policy and actual pass/fail evidence without recording secrets.
