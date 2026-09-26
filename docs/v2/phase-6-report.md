# Phase 6 report: adaptive spatial indexing

- Status: Complete
- Date: 2026-09-01
- Phase 5 base: `3fc6b92`

## Delivered

- Reusable open-addressed uniform grid with linked point buckets.
- Exact ordered graph output matching the brute-force oracle.
- Deterministic sparse/dense backend selector.
- Studio provenance badge showing active search backend.
- Counterbalanced benchmark across particle counts and radii.

## Verification

| Check | Result |
| --- | --- |
| Deterministic/randomized grid-oracle parity | PASS |
| Negative coordinates and cell boundaries | PASS |
| Result-buffer reuse | PASS |
| V2 tests | PASS, 60/60 |
| V2 production build | PASS |
| Legacy production build | PASS |

## Benchmark decision

Sparse radius-50 workloads improved by 60–69%. Radius-250 workloads regressed by 105–352%, so unconditional grid adoption was rejected. The retained adaptive selector uses grid only where the measured neighborhood-area ratio predicts the sparse regime; default Flying Lines remains on brute force.

## Exit criterion

Met. Uniform-grid spatial hashing is implemented and verified against the brute-force oracle, while the production selector prevents known measured regressions.

## Next

Phase 7 should implement main-thread and worker execution backends, OffscreenCanvas transfer, protocol ordering, fallback and disposal without changing experiment code.
