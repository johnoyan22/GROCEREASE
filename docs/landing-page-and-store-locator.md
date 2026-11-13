# Landing page and Google Maps locator

Date: 2026-11-13. This follow-up restores the original **Smart Grocery Shopping,
Made Easy** grocery hero, adjacent **Shop Near You** panel and original five
category labels. It retains responsive navigation, genuine links and honest
store content. The additional marketing sections introduced in the earlier
refinement are removed. Existing `herobg.png` and GrocerEase branding are reused.

## Is Google Maps appropriate without supermarket data?

Yes, as a map for the stores registered in GrocerEase. It cannot establish that
a supermarket participates in the system, maintains an accurate catalog, accepts
pickup orders or has products in stock. Those facts must come from authorized
GrocerEase records and partner verification.

Before public use, verify each store's actual name, pickup address, coordinates,
participation and catalog/pickup readiness. Keep demonstration or uncertain
records **unverified**. Do not publish real supermarket names with invented
inventory or imply a partnership that the team has not established.

The implementation uses only active stores with Admin-verified coordinates and
an address matching the address that was verified. Changing a store's address
removes it from locator results until reverified. Stale address verification
submissions return a conflict. It does not import Google's nearby-grocery results.

## Implemented behavior

- Public read-only `/api/public/store-locations` returns only store ID, name,
  address and verified coordinates. No staff, Shopper or inventory records.
- Google map loads only after **Choose a map pin**. Click the map, drag the
  chosen pin, or move the map with the keyboard and use its center. Confirm the
  selected area before nearby results change; Cancel keeps the previous area.
- **Use my location** requests browser permission only after clicking it.
- Nearby registered stores are sorted by distance within 5, 10, 25 or 50 km.
  Distances are explicitly approximate straight-line distances, not driving
  distances or travel times. Confirming a moved pin recalculates the results.
- A verified pickup-area selector and registered-store/address search offer a
  manual alternative without geocoding. Verified stores are browsable before
  choosing an area or configuring Google Maps; distances are not guessed.
- Marker/card selection is synchronized. **View Available Products** opens a
  paginated, searchable preview below the hero without Login. Products/photos
  recheck public participation and sellability. Guests see Login/Register actions;
  carts, Checkout and personalized AI remain authenticated.
- Directions open the selected store's coordinates in Google Maps. The user's
  chosen pin is sent to Google only when loading/interacting with the map or
  following the directions link; it is never sent to the GrocerEase API or saved
  to the account, cookies or local storage by this locator.
- Inactive, unverified and address-changed stores are excluded. No false nearest
  store, distance, opening time or stock claim is shown when data is absent.
- Missing Maps configuration, setup, denied location permission and provider
  failure have honest fallbacks. Existing shopping and store management continue.
- Admin → Store Management → **Map location** saves coordinates, explicit public
  verification and a mandatory source/review note with actor/before/after audit.
  Saving coordinates does not alter store details, inventory or orders.
- Admin address edits revoke and audit public verification. Restoring an older
  address does not republish it. An authenticated Shopper's public store choice
  reaches the existing explicit cart-switch workflow without adding products.

“Active and verified” is a participation/location filter, not “open now” or a
promise that a specific product/pickup slot is available. Check these in the
selected store's existing catalog and pickup workflow.

## Pending database approval

New additive migration:
`2026_11_13_000021_create_verified_store_locations.php`.

It creates exactly **two empty tables**:

| Table | Purpose |
| --- | --- |
| `store_locations` | One location per existing store: latitude/longitude, address verified, verifier/time and creation/update dates. Foreign keys reference existing stores/users; deleting referenced records is restricted. |
| `store_location_audits` | Store, acting Admin, before/after location snapshots, mandatory verification note and time. |

It modifies **no existing table or value**, guesses no coordinates, performs no
geocoding/backfill and publishes no existing store automatically. It was tested
only in disposable databases. **It has not been applied to the working database.**
Obtain explicit approval before applying this exact path, following the backup
and preservation process in `adviser-database-review.md`. Existing pending
migrations 15/16/18–20 remain separate; do not run unrestricted `migrate`.

## Authorized Google Maps setup

No Google key, billing account or live provider test was configured here. When
the team decides to activate the map:

1. Create/select the team's Google Cloud project. Review current pricing,
   approve billing and enable **Maps JavaScript API**. No Places, Geocoding or
   Routes API is needed by this implementation.
2. Create a browser API key. Restrict it to the intended development/production
   website referrers and to **Maps JavaScript API**. Apply appropriate quotas and
   billing monitoring. A browser key is visible to visitors by design; do not
   reuse a Gemini or server credential.
3. Create a JavaScript map ID in Google Maps Management for advanced markers.
   Use the team's own map ID for deployment, not an example/demo ID.
4. In the existing private frontend environment set these names to authorized
   values; preserve the rest of the environment. Do not put values in Git/chat:

```text
VITE_GOOGLE_MAPS_API_KEY
VITE_GOOGLE_MAPS_MAP_ID
```

5. Restart Vite, or rebuild/redeploy for a production Vite build. These are
   build-time browser configuration values. The code uses Google's quarterly
   Maps JavaScript channel and advanced markers.
6. After separately approved migration 21, an Admin verifies actual store pins
   through Store Management. Leave demo stores unpublished. Verify Google key
   restrictions, map loading, click/drag/keyboard pins, two-store distances,
   location denial, directions, address changes and inactive-store exclusion.

Google's official references:
[API setup and billing](https://developers.google.com/maps/documentation/javascript/get-api-key),
[API-key restrictions](https://developers.google.com/maps/api-security-best-practices),
[map IDs and advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start),
[draggable pins](https://developers.google.com/maps/documentation/javascript/advanced-markers/draggable-markers),
[directions links without an API key](https://developers.google.com/maps/documentation/urls/get-started).

For a capstone demo before partner data is verified, use clearly identified test
fixtures in a disposable environment. Keep the public locator unavailable/empty
until real participating stores and map configuration are approved. A Google
Maps directions link is a simpler interim option for a verified address; a
static embedded screenshot cannot implement the selected-pin/nearest-store flow.

## Assets and acceptance

Five original AI-generated category photographs are bundled locally as optimized
WebP assets under `frontend/src/assets/categories/`. They are illustrative and do
not populate product catalogs. Exact prompts and paths: `category-image-prompts.md`.

Automated checks cover registered-store filtering, Admin permissions/audits,
stale-address conflict, additive migration preservation, distance/radius ordering,
privacy, provider-stub map click/drag/center behavior and responsive real-browser
geolocation/results. **Provider stubs and browser geolocation fixtures do not
prove real Google Maps acceptance.** Record authorized provider/physical-device
results in the manual checklist after setup. Current full verification results
are recorded in the follow-up changelog.

Public catalog/report follow-up: **398 Laravel tests / 6,971 assertions**,
**137 frontend tests**, lint/build and **44 Chrome cases** pass. The browser SDK
is a labeled provider stub, not a live Maps test. See
`public-catalog-and-report-exports.md` for endpoints, visibility, authentication
boundaries, actual verification and remaining acceptance.
