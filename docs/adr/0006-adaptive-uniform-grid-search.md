# ADR 0006: Adaptive uniform-grid proximity search

- Status: Accepted
- Date: 2026-09-01
- Phase: 6 — Spatial indexing
- Depends on: ADR 0005

## Decision

Add a reusable uniform-grid proximity workspace with cell size equal to the connection radius. Each source searches only its 3×3 neighboring cells. Candidate indices are sorted before exact squared-distance rejection, preserving the brute-force oracle's source/target edge order as well as distances, opacity, degrees and component count.

The grid is not universally selected. A deterministic density estimate compares the nine-cell neighborhood area with the occupied point-cloud area. Grid is used only for at least 64 points and a ratio at or below 0.05; dense configurations retain the reusable brute-force workspace. The studio exposes `search grid` or `search brute` in its provenance badge.

## Evidence

Boundary and deterministic randomized tests compare grid and brute force exactly across negative coordinates, cell boundaries, 40 generated clouds, and radii from 0.001 through 2,000. Result buffers are stable across analyses.

Grid improved the 500-particle/radius-50 median by 63.27%, but regressed the default radius-250 case by 352.18%. The adaptive policy therefore retains the sparse win and prevents the measured dense regression. Results are in `docs/v2/phase-6-grid-benchmark.json`.

## Consequences

- Brute force remains both correctness oracle and production dense fallback.
- The selector runs only when simulation parameters rebuild, not every frame.
- Phase 6 changes search strategy, not graph semantics or rendering.
- More sophisticated candidate sorting or grid sizing requires a new measured experiment.

## Rollback

Revert the Phase 6 commit; Phase 5's reusable brute-force path remains intact.
