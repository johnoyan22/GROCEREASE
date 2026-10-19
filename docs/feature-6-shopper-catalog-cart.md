# Feature 6: Shopper store catalog and cart

Implemented October 19, 2026. Automated checks passed; user browser acceptance is pending.
This feature uses the existing store/product/inventory schema. No new migration is required.

## Behavior

Verified Shoppers use GET `/api/shopper/stores` and GET `/api/shopper/stores/{store}/products`.
Only active stores and active, correctly owned store inventory are returned. A product with no available
units is shown with its actual availability; adding it is disabled. Internal physical/reserved counts
are not exposed to Shopper catalog clients. Available stock, price and per-order limit are returned.

`ShopperBrowseProducts.jsx` replaces the mock category catalog, fake prices and local fixed fee.
It provides store selection, search, category filtering, price sorting, product details, current
availability/limits, cart quantity editing and removal. Store switching with items requires confirmation
before clearing the cart. It never combines products from two stores.

The cart persists in browser session storage under the authenticated user's ID and survives tab changes.
Only inventory IDs, quantities and store selection are saved. Stored prices, totals and payment statuses
are discarded. Catalog reads supply current prices. Obsolete/missing products and quantities exceeding
new stock/limits are marked for review. Cart totals use integer centavos with unsafe-number checks.
Storage failure leaves the in-memory cart usable. Browser storage remains an untrusted convenience;
Laravel must revalidate everything during checkout.

Scheduled COP Checkout is now connected through ShopperCheckout.jsx and the real Order API. The approved transaction migrations are applied; Admin must configure actual store hours before Checkout can operate. Laravel revalidates prices, limits, available units and pickup schedule; service fees remain zero pending partner approval. See feature-7-to-10-transactions.md. Adding/removing a cart item never changes stock.

## Evidence

- `ShopperCatalogTest`: 5 tests passed, 69 assertions.
- `shopper-cart.test.mjs`: 8 tests passed.
- Focused ESLint passed for the Shopper component/dashboard and cart/API services.

Tests cover selected-store isolation, real prices, available stock, limits, inactive products/stores,
verification/role restrictions, no stock changes on reads, integer totals, stale catalog data,
mixed-store prevention and corrupt/untrusted saved cart data. These do not claim browser interaction testing.

## Browser acceptance

1. As Store A/B staff, prepare active test products with stock through Feature 5 approval and different prices.
   Supervisor A sets a per-order limit on A's product. Do not seed or edit quantities directly.
2. Sign in as an email-verified Shopper. Open Browse Products from the dashboard.
3. Choose Store A. Confirm only A's products and prices appear. Search/filter/sort, then expand Product details.
4. Add a product. Increase/decrease quantity, remove it and re-add it. Check displayed integer-money subtotal.
   Confirm quantity cannot exceed available stock or the Supervisor's limit.
5. Open another dashboard tab and return to Browse. Refresh the browser. The saved cart should remain.
6. Choose Store B with items present. Keep current store: cart and Store A remain. Choose again and confirm:
   the A cart clears, B's catalog loads, and its price applies. No mixed-store cart is retained.
7. In a staff session, change a price or deactivate the selected product. Refresh Shopper products.
   Prices update; unavailable cart items must be removed. No hidden product is imported from another store.
8. Sign in as another Shopper in the same browser after logging out. The first Shopper's cart must not appear.
9. Signed-out requests return 401; unverified Shoppers and non-Shopper roles receive 403.
10. Check staff stock before/after cart changes. Physical and reserved counts are unchanged.

Unrelated dashboard totals, AI screens, payment settings and unrelated prototypes are not evidence for this feature.
