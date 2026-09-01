# ADR 0007: Main/worker runtime boundary

- Status: Accepted
- Date: 2026-09-01
- Phase: 7 — Worker runtime
- Depends on: ADR 0002, ADR 0004, ADR 0005, ADR 0006

## Decision

Bindfly exposes `MainThreadRuntime` and `WorkerRuntime` through the existing `ExecutionBackend` contract. Experiment, simulation, analysis and renderer code is shared; the studio worker entry composes those modules without adding worker branches to the experiment.

Runtime protocol version 1 commands carry monotonic sequence and request IDs. Worker initialization transfers OffscreenCanvas, builds the same seeded Flying Lines composition, resizes it, and answers with an explicit ready event. Later commands are serialized and acknowledged. Remote failures use structured code/message/recoverable payloads; transport errors fail the runtime, reject pending requests, remove listeners and terminate the worker.

Canvas transfer is irreversible. Capability failure before transfer falls back in place. Initialization/runtime failure after transfer and user runtime switching navigate to the same route with the selected runtime, producing a fresh canvas remount. Runtime switching intentionally restarts the same preset and seed; live state migration is deferred until versioned URL/snapshot state exists.

Worker parameter input is coalesced once per display frame before ordered transport. Resize, input, pause/resume and dispose remain ordered commands. Worker telemetry reports points, edges, components, step, frame time and search backend.

## Evidence

- Main and worker CPU compositions replay the same 240 fixed steps and recorded input with maximum state difference 0, below the declared `1e-9` tolerance.
- Transport tests prove sequence order, ready/ack behavior, structured initialization failure, listener cleanup and termination.
- Browser QA proves the emitted worker bundle, OffscreenCanvas rendering, telemetry and main-runtime remount.

## Consequences

- The production build emits a separate worker asset.
- Worker rendering does not send particle buffers back to the main thread.
- Worker pointer dragging uses the domain-level `move-nearest` input because main-thread code cannot inspect worker-owned particles.
- Runtime switches reset deterministic state rather than migrating live state.

## Rollback

Revert the Phase 7 commit. The Phase 6 main-thread studio remains complete.
