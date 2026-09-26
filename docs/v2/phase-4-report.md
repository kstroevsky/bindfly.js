# Phase 4 report: correct timing and lifecycle

- Status: Complete
- Date: 2026-09-01
- Phase 3 base: `27d0bdf`
- Canonical plan: `docs/bindfly_2_implementation_plan.md`
- Canonical plan SHA-256: `8a2bda7188e5d5fd571b5eee533f6759944cb9cd325320d9077651aa520e79b6`

## Delivered

- Validated experiment timing contract with fixed step, deterministic tier and state tolerance.
- Fixed-step accumulator clock with simulation speed, interpolation alpha, deterministic indices and capped/observable overload drops.
- Runtime-owned animation loop with exact frame cancellation, timestamp rebasing, pause/resume, immediate deterministic reset render, resize, disposal and failure state.
- Ordered input/parameter queue with recorded target steps and sequence numbers.
- Flying Lines resize behavior that preserves IDs/state and clamps into new bounds.
- Studio integration with 120 Hz policy, live step counter and cumulative dropped-step telemetry.
- Reproducible simulation timing benchmark and raw samples.

## Frozen Flying Lines policy

| Field | Value |
| --- | --- |
| State version | 1 |
| Fixed step | 1/120 s (8.333 ms) |
| Catch-up cap | 8 steps/frame |
| Overload policy | Drop excess wall-derived whole-step time; report it; keep executed step indices contiguous |
| Deterministic tier | `same-build-cpu` |
| State tolerance | `1e-9` |

## Verification evidence

| Requirement | Evidence |
| --- | --- |
| Refresh-rate independence | Exact Flying Lines state after 240 steps at 30/60/120/144 Hz schedules |
| Pause/resume | 30 seconds of paused wall time emitted zero steps; browser step counter remained 52 → 52 across a pause wait |
| No resume jump | First resumed frame rebases its timestamp; unit lifecycle test keeps the prior step index |
| Catch-up saturation | 100 ms delta with a two-step cap reports eight dropped steps; studio cumulative counter is visible and became nonzero under browser-induced stalls |
| Recorded inputs/patches | Input at step 0 and parameter patch at step 1 applied before their named steps in sequence order |
| Replay | Same seed/event log is exact across common display schedules and repeated same-build runs |
| rAF ownership | Exact pending ID is cancelled on pause and dispose; disposal callback runs once |
| Failure lifecycle | Throwing simulation callback transitions to `failed`, schedules no new frame and reports the error |
| Reset | Reset clears clock/events/overload, restores seeded state and renders step 0 while paused |
| Resize | Particle IDs preserved; positions clamped; mobile breakpoint survives desktop→mobile resize without overflow |

## Rendered QA

- Desktop 1280×720: non-empty deterministic canvas; step/frame/drop metrics live; no horizontal overflow; no console errors/warnings in a fresh tab.
- Parameter patch while running: particle count changed to 20 at a scheduled step.
- Stationary pointer flow: 20 → 21 → 20 for scheduled add then Shift-click remove.
- Paused reset: step 0, 100 points, 0 dropped, Resume label, and immediate redraw.
- Mobile 390×844: 390 px canvas, no horizontal overflow, document height exactly 844 px, no console errors/warnings.

## Benchmark

`tooling/benchmark-flying-lines-timing.mjs` measured the simulation step only after 1,000 warm-up steps and across twenty 1,000-step batches:

| Particles | Median batch | Median step |
| ---: | ---: | ---: |
| 100 | 0.904354 ms | 0.000904 ms |
| 500 | 1.732708 ms | 0.001733 ms |

Raw samples and environment metadata: `docs/v2/phase-4-timing-benchmark.json`.

## Checks

| Check | Result |
| --- | --- |
| `pnpm run v2:boundaries` | PASS |
| `pnpm run v2:typecheck` | PASS |
| `pnpm run v2:lint` | PASS |
| `pnpm run v2:test` | PASS, 52/52 |
| `pnpm run v2:check` | PASS |
| `pnpm run v2:build` | PASS |
| `npm run build` | PASS |
| V2 imports from legacy `src` | Forbidden and tested |

## Exit criterion

Met. Display refresh schedules no longer materially alter Flying Lines; the tested result is exact. Pause/resume has no time jump, overload is visible, scheduled changes land on recorded steps, replay matches the declared tier, and frame/resize/reset/disposal ownership resides in the runtime loop rather than the effect or studio.

## Next

Phase 5 should convert Flying Lines to a typed-array data model, define stable entity-ID/buffer-growth/removal semantics, remove per-step allocations, and benchmark the same frozen workload before and after the change.
