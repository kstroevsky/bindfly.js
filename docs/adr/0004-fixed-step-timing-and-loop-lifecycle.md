# ADR 0004: Fixed-step timing and loop lifecycle

- Status: Accepted
- Date: 2026-09-01
- Phase: 4 — Correct timing/lifecycle
- Depends on: ADR 0002, ADR 0003

## Context

Phase 3 made Flying Lines movement delta-time based, but the studio still owned a variable-delta `requestAnimationFrame` loop. That did not establish refresh-rate independence, exact event boundaries, overload behavior or a reusable lifecycle. The canonical plan requires a fixed timestep, deterministic step index, bounded catch-up, pause/resume without a wall-time jump, correct animation-frame cancellation, scheduled inputs/parameter patches, resize/disposal ownership and an explicit deterministic tier.

The experiment timestep cannot be selected only by convention. It must be benchmarked and frozen with the experiment state version after replay evidence exists.

## Decision

### Experiment timing contract

Every experiment definition declares:

- `fixedStepSeconds`;
- `deterministicTier`;
- `stateTolerance`.

Definitions reject non-positive/non-finite timesteps and negative/non-finite tolerances. These fields are part of the meaning of the experiment's `stateVersion`.

Flying Lines state version 1 freezes:

```text
fixed step          1 / 120 second
deterministic tier  same-build-cpu
state tolerance     1e-9
```

The same-build replay fixtures are exact. The nonzero tolerance is the declared future main-thread/worker CPU comparison threshold, not permission for same-build replay drift.

### Fixed-step clock

`FixedStepClock` owns the accumulator, simulation speed, deterministic step index, pause state and maximum catch-up count. Display deltas only feed the accumulator; emitted simulation steps always use the experiment's fixed duration.

The runtime uses an explicit bounded-drop policy. A frame runs at most eight catch-up steps (66.67 ms of Flying Lines simulation work). Any additional whole-step wall-derived time is discarded and reported as `droppedStepCount`/`droppedSeconds`; fractional accumulator time is retained for interpolation. Executed step indices remain contiguous, so recorded future events are delayed rather than silently skipped. The studio exposes cumulative dropped steps.

### Loop lifecycle

`FixedStepLoop` owns the exact animation-frame ID, timestamp rebasing, frame scheduling, pause/resume, reset, resize, disposal and failure transition. It:

- cancels the stored frame ID on pause/dispose;
- clears the previous timestamp on start/resume/reset, preventing time jumps;
- renders immediately after reset, including while paused;
- disposes callbacks exactly once;
- enters `failed` and stops scheduling if a callback throws;
- rejects reset, resize and scheduling outside ready/running/paused states.

The studio no longer owns animation-loop timing.

### Recorded step boundaries

Inputs and parameter patches receive a sequence number and target simulation step. The loop applies them in target-step/sequence order immediately before that step. The applied event log is inspectable and reset deterministically. Pointer input and studio parameter changes now use this queue.

### Resize behavior

The simulation contract now includes `resize(viewport)`. Flying Lines preserves particle identity and motion, updates its viewport and clamps particles into the new legal bounds. Canvas backing-store resize and simulation resize occur through the loop lifecycle rather than reconstructing the experiment on every viewport change.

## Timing evidence

The reproducible benchmark and raw samples are in `docs/v2/phase-4-timing-benchmark.json`; the runner is `tooling/benchmark-flying-lines-timing.mjs`.

On Node 22.22.0 / Apple M1 Max, simulation-step-only median time was:

| Particles | Median step |
| ---: | ---: |
| 100 | 0.000904 ms |
| 500 | 0.001733 ms |

This supports the 8.333 ms fixed step for the current object simulation with substantial simulation-only headroom. It does not include the O(n²) graph analyzer or Canvas rendering; their optimization remains Phases 5 and 6.

Automated replay of the same seed and recorded add/move inputs produced exact state after 240 steps at 30, 60, 120 and 144 Hz display schedules.

## Consequences

Positive:

- Display refresh no longer defines the mathematical simulation rate.
- Pause/resume, reset, scheduled changes and overload have explicit observable semantics.
- Main-thread and future worker loops can share the clock/event contract.
- Resize no longer resets seeded state.

Costs:

- Severe stalls slow simulated time because excess wall-derived time is explicitly dropped.
- Rendering currently shows current state; interpolation alpha is available but Flying Lines does not yet interpolate between snapshots.
- Parameter invalidation currently rebuilds the Flying Lines simulation at its recorded boundary; schema-driven hot-update/rebuild handling remains Phase 8.

## Non-goals

- Typed arrays and allocation removal (Phase 5).
- Spatial indexing (Phase 6).
- ExecutionBackend/main-worker runtime switching and OffscreenCanvas (Phase 7).
- Generated React controls and generalized invalidation policy (Phase 8).

## Rollback

Revert the Phase 4 commit. Phase 3 remains runnable with its studio-owned variable-delta loop.
