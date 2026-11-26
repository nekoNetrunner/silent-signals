# Windows validation

The numerical engine, Python fixtures, seven experiment entry points and eleven plotting entry points ran on Windows build 26300, with Python 3.12.14, Node.js 24.22.3, NumPy 2.5.5 and Matplotlib 3.11.2 (Agg). All 26,886 full runs are represented in the seven CSVs. Smoke produced 328 smaller runs. Each of the seven final full result files matched its independent clean rerun byte for byte; the seven smoke files also matched their clean counterparts. The actual SHA-256 values are in analysis/verification.json and smoke/analysis/verification.json.

## Test output

```text
PASS Boolean radio and one-way erasures
PASS independent verifier, edge cases and exhaustive maximality
PASS fixed original-degree greedy grid
PASS LEACH eligibility, integer epoch and rated-energy weighting
PASS Afek inclusive schedule and missed final announcement
PASS published JSX uses two slots, 0.5 initial probability, no floor
PASS loss can defeat confirmation and half-duplex can miss collisions
PASS energy conservation, death inside intervals, silent RX
PASS exact-k expectations enumerated on the path
PASS service, orphan policy, censoring, dead transmitters and local repair
PASS independent Python fixture matches each JS physical slot
2 passed
```

Pytest ran the independent Python grid test and an engine test that executes the eleven named groups above. The grid has 400 vertices, 760 edges, mean degree 3.8 and 182 heads, density 0.455. The observer confirmed independence and domination. Python also reconstructed eight CSV graph snapshots and checked their adjacency hashes and head sets.

The lifetime ledger records total durations in TX, RX and idle. An independent check sums each sensor’s time alive, including fractional-slot death times, and compares that total to the sum of the three mode durations. Per-election cumulative observations in E5/E7 record invalid output even when a later election repairs it. The final empty live graph can be vacuously independent and dominating, so use the election counters, death times and service metrics for interpretation.

## Offline browser

Chromium Headless Shell 151.0.7922.34 opened the simulator directly from file:// on Windows. Acceptance covered all five live protocols at n=100, deterministic reset, comparing two arms, stepping and rewinding, full setup, JSON and CSV downloads, keyboard shortcuts, and replay of an exported Python fixture. The application produced no console errors and no page overflow at 1920 × 1080 or 1280 × 720. System Edge launch did not complete inside this test environment. Browser acceptance used the separate Chromium executable.

To repeat the browser test, install Playwright for Node, install its chromium-headless-shell browser and run `node tests/browser.cjs`. The shared engine is embedded in the shipped HTML. After editing the engine or interface run `python viz/build.py`. Rebuild the independent fixture with `python tests/fixture.py`.

## Exceptions kept in the evidence

Four E2 outputs and two E4 outputs exhausted the finite global schedule. E7 has 18 administratively censored runs with living nodes. These remain in the CSVs and analysis. No hardware field trial was run. The source archive contained prior results and outcome-dependent checks. The corrected configuration used five geometric sizes, 50 seeds for each static stratum, six per main lifetime arm, and three per sensitivity arm. The frozen choices are in DECISIONS.md.

The initial fixture-export invocation encountered a missing output directory. The exporter now creates it before writing. The full suite passed after this correction. A descriptive-only addition to E5 and E7 exported cumulative per-election validity counts and energy mode durations. Those two experiments were then repeated into both final full and smoke trees. The original predeclared estimands and settings were retained.

## Print files

The reader report contains five A4 pages. The research poster is one A1 portrait page, with the measured figures embedded. Both documents were rendered and visually checked. To regenerate them on Windows, install reportlab==4.4.9 in addition to the numerical requirements, then run `python docs/build_print.py` after generating the full results, highlights and figures.
