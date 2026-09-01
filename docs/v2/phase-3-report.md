# Phase 3 report: Flying Lines vertical slice

- Status: Complete
- Date: 2026-08-31
- Phase 2 base: `2d4b9eb`
- Canonical plan: `docs/bindfly_2_implementation_plan.md`
- Canonical plan SHA-256: `8a2bda7188e5d5fd571b5eee533f6759944cb9cd325320d9077651aa520e79b6`

## Delivered

- Stable `flying-lines` experiment definition, Simple preset, parameter schema, durable state codec and explicit registry loader.
- Deterministic CPU particle simulation with add/move/remove-nearest input and correct seconds-based movement, independent axes and boundary handling.
- Brute-force proximity graph returning unique undirected edges, numeric distances/opacities, node degrees and connected components.
- Canvas2D renderer with explicit CSS/backing-store dimensions and DPR transform.
- Standalone studio at `#/lab/flying-lines` with responsive controls, pause/reset, live point/edge/component/frame metrics and pointer input.
- Separate Webpack build and development entry for Bindfly 2; legacy application entry remains unchanged.
- Unit/integration coverage for graph invariants, deterministic simulation, delta-time stepping, pointer commands, registry/codec integration and unique-edge rendering.

## Visual and behavioral review

Compared with `docs/legacy/screenshots/flying-lines-simple-desktop.jpg` and the Phase 0 legacy manifest:

- Preserved: dark field, colorful distance-weighted line network, 100-particle Simple preset, 250 px connection radius, full experiment canvas and interactive particle count.
- Intentionally fixed: duplicate directed edges, string distances, coupled axes, frame-count movement/lifetime, uncontrolled randomness and the boundary-direction defect.
- Intentionally improved: live graph observability, explicit seeded identity and a mobile layout without clipped controls.
- Deferred: legacy preset breadth, URL state serialization, fixed-step scheduling, typed arrays, spatial hashing, worker execution and generated React controls.

The complete decision ledger is in `docs/adr/0003-flying-lines-vertical-slice.md`.

## Rendered QA

| Flow | Result |
| --- | --- |
| Desktop 1280×720 route/title/DOM/canvas | PASS |
| Default state | 100 points, live edges, β₀ and frame metric |
| Pause | Button changed to Resume; no runtime error |
| Parameters | 20 particles and radius 80 yielded 20 points, 3 edges and 17 components in the paused deterministic state |
| Add/remove | Point count changed 20 → 21 → 20 |
| Drag | Added point dragged to a new location and successfully removed at its destination |
| Mobile 390×844 | PASS; 390 px canvas, no horizontal overflow, panel and canvas fit one viewport |
| Mobile control | Particle change to 12 and pause both reflected in UI/state |
| Console | No errors or warnings on desktop or mobile |

## Verification

| Check | Result |
| --- | --- |
| `pnpm run v2:boundaries` | PASS |
| `pnpm run v2:typecheck` | PASS |
| `pnpm run v2:lint` | PASS |
| `pnpm run v2:test` | PASS, 41/41 |
| `pnpm run v2:check` | PASS |
| `pnpm run v2:build` | PASS |
| `npm run build` | PASS |
| V2 imports from legacy `src` | Forbidden and tested |

## Exit criterion

Met. Flying Lines runs as a complete Bindfly 2 effect through the new definition, simulation, analyzer, renderer and studio composition. The reviewed parity/divergence ledger is explicit, and no V2 code imports a legacy runtime abstraction.

## Next

Phase 4 should replace the studio-owned variable-delta loop with the fixed-step clock and lifecycle semantics already reserved by the core contracts. It must prove refresh-rate independence, pause/resume without time jumps, observable catch-up saturation, scheduled parameter/input steps and same-build replay at the declared deterministic tier.
