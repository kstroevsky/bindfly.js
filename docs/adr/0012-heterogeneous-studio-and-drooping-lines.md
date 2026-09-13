# ADR 0012: Heterogeneous Studio plugins and Drooping Lines

- Status: Accepted
- Date: 2026-09-13
- Stage: 10A — Generic composition and Drooping Lines
- Depends on: ADR 0011

## Decision

The Studio registry stores deliberately erased `StudioExperimentPlugin` values keyed by stable experiment ID. Each experiment is built through the generic `defineStudioExperiment(...)` helper, which preserves its schema, state, input, snapshot and telemetry types internally and performs validation at the erasure boundary.

A plugin owns display metadata, parameter schema/defaults, durable-state translation, execution profiles, session creation, input validation, interaction mapping, legacy URL migration and metric descriptors. `StudioApp`, durable-state code and main/worker runtime hosts select these capabilities through the plugin interface and contain no Flying Lines or Drooping Lines branches. A regression test enforces that boundary.

Concrete backend compatibility is an additive list of `{ rendererId, runtimeId }` execution profiles. Both current experiments declare Canvas2D main-thread and worker profiles. The generic worker validates the protocol envelope, validates transport-owned initialization/viewport fields, loads the plugin by experiment ID, then delegates input and parameter validation to that plugin.

`ExperimentDefinition` now carries a distinct typed snapshot state into analyzer definitions. Synchronous frame-critical work uses `Derivation<Input, Output>`; the adaptive proximity computation is the first explicit derivation. Snapshot analyzers remain asynchronous and are not used as render-loop derivations.

Drooping Lines is experiment #2. Its simulation exposes moving particles, while its derivation applies the preserved legacy transformations:

```text
tan-x:  source = (tan(x_i), y_i)
atan-y: source = (x_i, atan(y_i))
target: original (x_j, y_j)
```

The derived geometry retains directed source/target relationships and opacity from transformed distance. It is a typed experiment-specific operator, not formula IR. Formula translation remains Stage 12 work.

## Deliberate temporary dependency

Drooping Lines currently delegates particle movement to the proven Flying Lines movement implementation without exposing Flying Lines state through its public contract. This makes the second consumer concrete without prematurely naming a shared abstraction. Stage 10B must compare both consumers and extract only the demonstrated moving-particle behavior into a neutral owner.

## Consequences

- Adding a registered experiment no longer requires branches in the Studio shell, durable state or runtime hosts.
- Main and worker run the same per-experiment session composition.
- Renderer/runtime compatibility is truthful and non-Cartesian.
- Background, connection radius and Drooping deformation are session-owned hot parameters; Flying Lines simulation state now contains only dynamic particles.
- Configuration URLs and imports select and validate arbitrary registered plugins.

## Rollback

Revert the Stage 10A plugin/Drooping commit, then revert ADR 0011's session extraction if necessary. Stage 9.5 remains the stable single-experiment baseline.
