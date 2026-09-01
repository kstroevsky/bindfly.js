# ADR 0008: Schema-driven React studio

- Status: Accepted
- Date: 2026-09-01
- Phase: 8 — Studio architecture
- Depends on: ADR 0002, ADR 0007

## Decision

The studio shell is React, while simulations, renderers, analysis and execution backends remain framework-free. `StudioController` adapts main/worker execution to React callbacks; React owns durable user choices and visible presentation only. Canvas frames, readiness, pointer-drag state and telemetry remain outside component state or in refs.

Parameter controls are generated from `ParameterSchema`. Number, boolean, string and enum definitions map to labeled native controls. Units and invalidation behavior are visible and included in accessible descriptions. Normalization occurs before a patch reaches the controller. Adding a supported parameter kind or a new parameter does not require Flying Lines-specific UI code.

The shell exposes experiment, renderer and runtime pickers; pause/reset; performance metrics; and an inspector with experiment version, timing tier, analysis provenance and worker capability reason. Unsupported options are disabled with an accessible reason. Runtime selection preserves the Phase 7 query convention; ephemeral readiness, drag and telemetry state is not serialized.

The existing visual direction is retained. This phase is an architectural UI refactor, not a redesign, so no generated visual concept or new asset system is introduced.

## Consequences

- React is isolated to `apps/studio`; engine boundary tests continue to forbid React imports.
- The worker/main canvas is remounted by React key when runtime changes.
- All six Flying Lines parameters, including lifetime, margin and background, are now exposed.
- The sidebar becomes scrollable when content exceeds short viewports.

## Rollback

Revert the Phase 8 commit to restore the Phase 7 imperative studio entry.
