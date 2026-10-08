# Uncertainty Budget Calculator Made Simple

A browser-only (no backend) single-page app that guides you through building a measurement
uncertainty budget per **JCGM 100:2008 (GUM)**, **NIST TN 1297** and **ISO/IEC 17025:2017 §7.6**
(with ILAC P14 / EA-4/02 practice), and exports an audit-ready report.

## Run it

```bash
npm install
npm test            # unit tests for the math (vitest)
npm run build       # type-check + production build -> dist/
npm run preview     # serve dist/ at http://127.0.0.1:4173
npm run dev         # development server with hot reload
node scripts/screenshots.mjs   # smoke test (fails on console errors) + screenshots (needs preview running)
npx vite-node scripts/make-samples.ts   # regenerate samples/ reports for the worked examples
```

`dist/` is a fully static site (relative asset paths), so it can be hosted on GitHub Pages,
Netlify, an intranet share, or opened from any static web server.

## Features

- **5-step wizard**: (1) measurand and optional model `Y = f(X1..XN)`; (2) uncertainty sources with
  one-click typical components; (3) data entry per component with a distribution helper explaining
  when to use each distribution and where to find the data; (4) budget review, coverage, correlation;
  (5) results, reporting statement and export.
- **Distributions / evaluations**: normal (U with k), normal (U at a confidence level, with optional ν →
  Student-t divisor), standard uncertainty, rectangular (√3), triangular (√6), U-shaped/arcsine (√2),
  digital resolution (r/√12), Type A from pasted readings (s/√m, ν = n−1), Type A pooled.
- **Inputs in absolute, % or ppm** of a reference value; full-width or half-width limits.
- **Sensitivity coefficients** entered manually or computed as numerical partial derivatives of the
  model (central differences with Richardson extrapolation) via a safe expression parser (no `eval`).
- **Degrees of freedom**: Type A n−1 / pooled; Type B ∞, explicit, or from relative reliability
  (GUM G.4.2, ν = ½(Δu/u)⁻²); Welch–Satterthwaite νeff.
- **Combined uncertainty** by RSS with optional correlation coefficients (GUM 5.2.2).
- **Coverage factor** from the exact inverse Student t-distribution at any confidence level
  (default 95.45 %, which gives k = 2.000 exactly at ν = ∞), truncating νeff (GUM G.6.4) or using
  fractional ν; or fixed k.
- **Reporting** to two significant digits (GUM 7.2.6), nearest or round-up, with the result rounded
  to the same decimal place and a certificate-style statement.
- **Warnings** an assessor would raise (dominant non-normal term, c = 0 terms, small νeff with fixed k,
  correlation caveats).
- **Calculators**: mean / s / s/√n, t-factor, divisors, Welch–Satterthwaite, manufacturer spec
  ±(% rdg + % range + digits), resolution half-interval, % / ppm / ppb conversion, SI prefixes,
  GUM rounding, Type B ν from reliability, pooled standard deviation.
- **Save / load** in browser localStorage (autosave of the working budget + named library),
  **JSON import/export**, **CSV export**, **printable HTML report** (print → PDF) with every component,
  source, distribution, divisor, u(xi), ci, ci·u(xi), ν, % contribution, uc, νeff, k, U, method and references.
- Responsive layout for phone and desktop.

## Code layout

```
src/lib/stats.ts         special functions: lnGamma, incomplete beta/gamma, erf, normal & Student-t CDF/inverse
src/lib/expr.ts          safe model parser/evaluator + numerical partial derivatives
src/lib/uncertainty.ts   engine: Type A/B, divisors, W-S, combination, coverage, GUM 7.2.6 rounding, computeBudget()
src/lib/types.ts         data model (Budget, Component, results)
src/lib/budget.ts        defaults, JSON normalisation for import
src/lib/examples.ts      GUM H.1, EA-4/02 S2, illustrative caliper budget
src/lib/guidance.ts      plain-language help text, sources, checklist, references
src/lib/report.ts        CSV and standalone HTML report
src/lib/__tests__/       vitest unit tests (worked examples)
src/components/          React UI (wizard, editor, table, results, calculators)
scripts/                 screenshots/smoke test, sample generation
samples/                 generated reports for the worked examples
```

## Verification (see `src/lib/__tests__`)

| Check | Published | App |
|---|---|---|
| GUM Table G.2 / TN 1297 Table B.1 (168 cells: ν = 1…50, 100, ∞ × 6 levels) | 2–3 decimals | 167 of 168 match; the one miss is a printing slip in both tables (ν = 35, p = 90 %: printed 1.70, exact 1.6896) |
| GUM 4.4.3 (20 temperature readings) | x̄ = 100.145, s = 1.489, s/√n = 0.333 °C | identical |
| GUM G.4.1 example | νeff = 19.0, t95 = 2.09, U95 = 2.2 % | 19.04 with GUM's rounded 1.03 %; 18.999 unrounded; U95 = 2.2 % both ways |
| GUM G.4.2 | 25 % → ν = 8 | 8 (also 10 % → 50, 50 % → 2 as used in H.1) |
| GUM H.1 sub-budget u(d) | 9.7 nm, νeff = 25.6 | 9.7 nm, 25.6 |
| GUM H.1 end gauge (full model, numerical ci) | uc² = 1002 nm², uc = 32 nm, νeff = 16.7 → 16, k = 2.92, U99 = 93 nm | 1002.3 nm², 31.66 nm, 16.74 → 16, 2.9208; U = 92.47 nm → **92 nm** (nearest) / 93 nm (round-up). GUM's 93 = 2.92 × rounded 32 nm |
| EA-4/02 M:2022 S2 (10 kg) | u = 29.2 mg, U = 58 mg (from rounded table values) | 29.24 mg / 58 mg from table values; raw inputs give 29.26 mg → U = 58.5 → 59 mg |
| GUM 7.2.6 rounding examples | 10.47 → 11 (up), 28.05 → 28, y = 10.058 Ω | identical |
| NIST TN 1297 B.2 | νeff = 8 → k95 = 2.3 | 2.306 |

## Not yet done / simplifications

- First-order (linear) propagation only; no second-order terms (GUM 5.1.2 note) and no Monte Carlo (JCGM 101).
- Welch–Satterthwaite with correlated inputs is flagged as approximate; no multivariate outputs.
- Unit handling is user-managed (free-text units; ci converts to the output unit) – no dimensional analysis.
- Single measurand per budget; no CMC/range tables, no multi-point budgets yet.
- Data stays in the browser (localStorage) unless exported.
