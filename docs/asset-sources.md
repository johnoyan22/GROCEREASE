# UI asset sources

- `frontend/src/assets/images/Logo.png`: existing project brand asset, reused
  under the user's instruction to preserve GrocerEase branding. No new claim
  about its original authorship/licensing is made.
- `frontend/src/components/public/GroceryIllustration.jsx`: original vector
  grocery-bag illustration authored for this project in this branch. It depicts
  illustrative produce, bread and a carton without trademarks, prices or stock claims.
- Public category artwork now uses five original photographs generated through
  the built-in image-generation tool, bundled as WebP under
  `frontend/src/assets/categories/`. Exact prompts/paths are recorded in
  `category-image-prompts.md`. They are illustrative, not actual inventory photos.
  Lucide remains the project's existing UI-icon dependency (ISC license).
- Product and Shopper photos are team uploads. Upload forms require team-owned
  or licensed catalog photographs. The application does not scrape, hotlink or
  provide copyrighted brand photographs. Retain any upload license/attribution
  evidence with the team's asset records when applicable.
- Existing `herobg.png` is reused to restore the user's original landing hero.
  Its illustrative groceries imply no stock/price claim. Original authorship/
  licensing is not newly asserted; retain the team's provenance records.
- Existing `map.png` remains unused. A configured interactive Google Maps locator
  replaces the old static screenshot; actual pins come only from verified active
  GrocerEase stores. Google attribution stays within the provider-rendered map.
- `GroceryIllustration.jsx` remains in the repository but is no longer used on the
  restored landing page. No existing asset was deleted.
