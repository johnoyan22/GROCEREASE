# Dependency audit record

Checked 2026-11-13 against the committed dependency inputs on
`feature/adviser-improvements`. Audit results are time-specific, not a guarantee
that a dependency has no undisclosed defect.

## Backend

Dompdf 3.1.6 provides real invoice/report PDFs. Existing Symfony packages were
patched within their compatible constraints: http-foundation/http-kernel,
routing and yaml to 7.4.23; mime to 7.4.22. Laravel's major version and payment/
Gemini adapters were not replaced.

Final `composer audit --locked --format=json` exited 0 with empty advisories
and abandoned-package lists. The complete Laravel suite passed after the patch
updates: **381 tests / 6,527 assertions**.

## Frontend

The initial audit found 12 affected package entries, including four high-severity
entries. A compatible `npm audit fix --ignore-scripts` updated the lockfile
without forcing a major-version change. Examples: Vite 8.2.1 → 8.3.8,
ESLint 10.8.1 → 10.14.0, Rolldown 1.2.3 → 1.2.19,
PostCSS 8.5.26 → 8.5.32, Zod 4.4.3 → 4.6.7. Package manifest ranges remain intact.

Final results:

- `npm audit --omit=dev --json`: **0 vulnerabilities**, exit 0.
- `npm audit --json`: **7 moderate affected package entries**, exit 1;
  zero low, high or critical entries. These are development-tool dependencies,
  centered on minimatch and propagated through ESLint and its plugins.
- ESLint, **125 frontend tests**, production build and **29 real Chrome cases**
  passed with the updated lockfile.

The root advisory is
[minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249),
reported by npm for versions `>=7.0.0 <11.0.1`. Affected entries in the final
audit are `minimatch`, `@eslint/config-array`, `@eslint-community/eslint-utils`,
`@eslint/js`, `eslint`, `eslint-plugin-react-hooks` and
`eslint-plugin-react-refresh`. Seven package entries do not mean seven unrelated
root vulnerabilities.

No `--force`, breaking ESLint downgrade or unverified major transitive override
was applied. The remaining task is a separate compatible lint-toolchain update
when upstream constraints allow the patched minimatch version, followed by
lint/tests/build/browser verification. Re-run both audits before deployment;
registry metadata can change the propagated package count without a lockfile change.

The production audit is clean; the full development audit is intentionally
reported as having remaining findings.
