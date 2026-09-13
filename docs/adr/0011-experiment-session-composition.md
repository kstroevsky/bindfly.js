# ADR 0011: Experiment sessions own executable composition

- Status: Accepted
- Date: 2026-09-13
- Stage: 10A — Generic composition and Drooping Lines
- Depends on: ADR 0003, ADR 0004, ADR 0007, ADR 0010

## Decision

Introduce a framework-free `ExperimentSession<Schema, Input, Snapshot, Telemetry>` boundary in the Studio execution layer. A session owns canonical parameters, simulation, synchronous derivations, rendering, domain input, telemetry, snapshot adaptation, resize/reset and disposal for one experiment instance.

Main-thread and worker runtime hosts own only scheduling, transport, lifecycle and execution location. Both hosts delegate Flying Lines behavior to the same `createFlyingLinesSession` composition. Experiment-specific construction, proximity backend selection, invalidation routing and telemetry must not be reimplemented by a runtime host.

The session reports dropped fixed steps through an explicit method because overload detection belongs to the runtime clock while cumulative experiment telemetry belongs to the session. The Flying Lines snapshot adapter is a named typed function reused by both the experiment capability and session.

This is the first Stage 10A slice. It does not yet define the deliberately erased heterogeneous plugin registry, generic worker payload, generic durable Studio state or Drooping Lines session. Those require this session seam and remain mandatory before Stage 10A is complete.

## Evidence

CodeGraph showed `createMainStudioController` directly owning 23 experiment-specific callees and only one caller, `StudioApp`. The extracted engine graph identified `FixedStepLoop` as the highest-degree cross-community node. Moving experiment composition behind the session keeps that runtime bridge generic instead of expanding its domain knowledge.

## Consequences

- Main and worker now execute identical Flying Lines composition code.
- Hot-update/reset behavior and adaptive proximity selection have one owner.
- A typed session can become the internal product of `defineStudioExperiment(...)` in the next slice.
- Drooping Lines can supply different derivation/rendering behavior without branching runtime hosts.

## Rollback

Revert the Stage 10A session-extraction commit. The stabilized Stage 9.5 controller and worker compositions remain behaviorally valid but duplicated.
