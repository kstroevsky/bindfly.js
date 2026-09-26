# ADR 0003: Flying Lines vertical slice

- Status: Accepted
- Date: 2026-08-31
- Phase: 3 — Flying Lines vertical slice
- Depends on: ADR 0001, ADR 0002

## Context

Phase 3 must prove that one complete experiment can run through Bindfly 2 without importing a legacy runtime abstraction. The canonical plan deliberately calls for a naïve implementation first: a CPU object model, brute-force proximity graph, Canvas2D renderer, standalone studio route and pointer input. Timing infrastructure, typed-array optimization, a spatial index, workers and the schema-generated React studio belong to later phases.

Phase 0 classified legacy Canvas2D Flying Lines as `intentional-fix`. Its visual identity is a moving colored proximity graph on a dark field, with a 100-particle Simple preset and a 250-pixel connection threshold. Its duplicate directed pairs, stringified distances, same-axis velocity coupling, frame-based movement and lifetime, and incorrect boundary test are defects rather than parity requirements.

## Decision

### Experiment composition

`flying-lines` is a stable experiment ID loaded through the explicit registry. Its definition owns the parameter schema, durable state codec, capability declaration, Simple preset and simulation factory. The studio composes the experiment with analysis and rendering; the effect does not import either implementation.

### Deliberately naïve oracle

The first graph analyzer is an O(n²) brute-force oracle. It visits only `sourceIndex < targetIndex`, rejects candidates using squared distance, calculates a numeric square root only for accepted edges, and returns unique edges, per-node degree and connected components. Union-find computes components. This implementation is the correctness reference for the Phase 6 spatial index.

### Simulation corrections

The CPU simulation uses deterministic seeded random input, independent x/y velocity components derived from angle and speed, seconds-based velocity/lifetime values, delta-time stepping, and position/direction-aware boundary reflection. Pointer input is expressed as add, move and remove-nearest domain commands.

The Phase 3 studio temporarily owns `requestAnimationFrame` and clamps a display-frame delta to 50 ms. That makes motion time-based but is not the fixed-step clock promised by Phase 4.

### Rendering and studio

The Canvas2D adapter owns backing-store/DPR resize and draws each unique edge exactly once. The standalone `#/lab/flying-lines` studio route owns composition, parameter controls, live graph metrics, responsive layout and pointer-event translation. It intentionally does not use React; the schema-generated React studio is Phase 8.

## Parity and divergence ledger

| Legacy behavior | Phase 3 decision | Classification |
| --- | --- | --- |
| Dark animated point field with colorful proximity lines | Preserved | Visual parity |
| Simple preset has 100 particles and a 250 px connection threshold | Preserved | Preset parity |
| Canvas fills the available experiment viewport | Preserved with explicit CSS/backing dimensions | Behavioral parity |
| Particle count is interactive | Preserved; stable input state is visible in the studio | Behavioral parity |
| Pair loop draws both A→B and B→A | Draw one undirected edge | Intentional fix |
| Hot loop stringifies distance with `toFixed` | Keep distance numeric | Intentional fix |
| Both velocity axes can share/couple one sampled value | Sample angle and speed to produce independent axes | Intentional fix |
| Motion, life and fade are frame-count based | Express speed/lifetime in seconds and step by `dt` | Intentional fix; fixed-step rigor deferred to Phase 4 |
| Boundary logic compares velocity with margin | Reflect using next position, bounds and velocity direction | Intentional fix |
| Randomness is uncontrolled | Use versioned seeded RNG | Intentional fix |
| Legacy controls compress/clip on mobile | Use a responsive panel above the canvas | Intentional UX fix |
| URL state does not preserve slider changes | Route is stable; full URL state remains Phase 9 | Explicit deferral |
| Worker/OffscreenCanvas is the normal legacy route | Main thread only | Explicit Phase 7 deferral |

## Evidence

- `pnpm run v2:check`: dependency boundaries, strict typecheck, type-aware lint and 41 tests pass.
- `pnpm run v2:build`: production studio bundle succeeds.
- Browser QA at 1280×720 and 390×844: correct page identity, non-empty canvas, live metrics, no horizontal overflow, no console errors or warnings.
- Interaction QA: pause/resume label, particle/radius changes, reset, click-to-add, Shift-click removal and drag-to-move all produced observable expected state.
- `npm run build`: legacy production bundle still succeeds.
- V2 boundary tests reject all imports from the legacy `src` tree.

## Consequences

Positive:

- One end-to-end Bindfly 2 experiment exists without legacy runtime dependencies.
- The brute-force graph is both useful now and a test oracle for later optimization.
- Visual parity and intentional corrections are explicit rather than inferred.

Costs and deferrals:

- O(n²) graph work and object allocation are accepted until Phases 5 and 6.
- The studio owns temporary frame timing until Phase 4.
- Runtime switching, worker disposal/fallback, generated controls and URL reproducibility remain Phases 7–9.

## Rollback

Revert the Phase 3 commit. Phase 2 contracts and their tests remain valid.
