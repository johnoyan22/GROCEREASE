# Browser-only fixtures

`public-map.html` / `public-map.jsx` mount the actual landing page with explicit
provider-stub identifiers. `support/google-maps-stub.js` supplies the fake SDK;
these tests never contact or authenticate to Google. This HTML entry is not a
production application route and is not included in the Vite application build.

`report-download.pdf` is a real Dompdf-rendered, disposable-test order-summary
fixture produced by `AdviserOrdersDocumentsTest` (optional `ADVISER_PDF_QA=1`
output). It contains synthetic test records, not a working customer's data.
Browser checks verify download behavior and query scope with this fixture;
Laravel independently generates actual role-scoped PDFs and compares the real
table/PDF datasets and totals. No new PDF engine is used.
