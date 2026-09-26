# Phase 5 report: performance data model

- Status: Complete
- Date: 2026-09-01
- Phase 4 base: `eaf80ed`

## Delivered

- Float64 structure-of-arrays particle state with Uint32 stable IDs.
- Power-of-two growth, monotonic IDs, stable-order removal and active-range snapshots.
- Allocation-free steady-state simulation steps and deterministic resets.
- Reusable typed brute-force graph workspace; allocating analyzer retained as oracle.
- Direct typed-buffer Canvas2D rendering with cached colors.
- Reused studio graph/result/view objects.
- Controlled baseline/candidate benchmark with exact behavioral hashes.

## Verification

| Check | Result |
| --- | --- |
| V2 tests | PASS, 56/56 |
| Exact 30/60/120/144 Hz replay | PASS |
| Object-oracle vs typed graph | PASS |
| Steady-state simulation buffer identity | PASS |
| Stable ID/growth/removal semantics | PASS |
| Snapshot isolation | PASS |
| V2 production build | PASS |
| Desktop rendered QA | PASS; 20 → 21 → 20 add/remove; no console errors |
| Mobile 390×844 | PASS; no overflow; document height 844; no console errors |

## Benchmark verdict

Representative median frame improvements were 53.32% (100), 57.11% (300), and 50.66% (500). All guardrail hashes are identical. Because 500-particle variance is high, the statistical direction is not overstated; the adoption decision rests on the measured representative improvement, exact parity and elimination of steady-state result-buffer replacement.

## Exit criterion

Met: behavior remains exact under the declared same-build tier, the live path uses reusable typed buffers, and the measured representative workload improved without a guardrail regression.

## Next

Phase 6 should implement uniform-grid spatial hashing while retaining the allocating brute-force analyzer as its semantic oracle.
