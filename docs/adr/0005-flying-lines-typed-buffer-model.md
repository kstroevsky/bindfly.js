# ADR 0005: Flying Lines typed-buffer model

- Status: Accepted
- Date: 2026-09-01
- Phase: 5 — Performance data model
- Depends on: ADR 0003, ADR 0004

## Decision

Flying Lines now stores particles as a structure of typed arrays: `Uint32Array` IDs and `Float64Array` position, velocity and lifetime fields. Float64 preserves the Phase 4 numerical contract; array position is never entity identity.

Capacity starts at a power of two and doubles only on input-driven growth, up to the declared 500-particle experiment limit. IDs are monotonic until deterministic reset. Removal shifts active ranges left, preserving deterministic iteration order. Reset and steady-state steps reuse allocated arrays; explicit snapshots copy only active ranges.

The live brute-force graph path uses a preallocated workspace containing typed edge indices, distances, opacities, degrees and union-find storage. It mutates one stable result object. The allocating object analyzer remains the Phase 6 correctness oracle.

The Canvas2D renderer consumes particle/edge buffers directly, caches source colors, and uses `globalAlpha` rather than constructing per-edge HSLA strings. The studio reuses its render-view and graph objects.

## Evidence and adoption

The retained representative benchmark improved median simulation-plus-graph time by 53.32%, 57.11% and 50.66% at 100, 300 and 500 particles. Exact guardrail hashes match the Phase 4 object model at every workload, and steady-state result-buffer replacement is zero. Raw samples are in `docs/v2/phase-5-data-model-benchmark.json`.

The 500-particle samples have substantial run-to-run variance, so no confidence interval or universal speedup claim is made. The change is retained because the point estimate clears the predeclared threshold, correctness is exact, allocation mechanism evidence moved as predicted, and the representation is required for later worker/GPU transfer.

## Consequences

- Typed buffers are now part of Flying Lines state-version-1 snapshot semantics.
- Rare add-point growth allocates and copies; steady-state stepping does not replace buffers.
- Stable-order removal is O(n), acceptable for user input and preferable to changing deterministic order.
- The O(n²) neighbor algorithm remains; Phase 6 changes only its search strategy and must compare against the object oracle.

## Rollback

Revert the Phase 5 commit to restore the Phase 4 object state and allocating live graph path.
