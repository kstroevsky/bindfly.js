# ADR 0017: Synchronized formula comparison

- Status: accepted
- Stage: 12 — Formula-backed Bindfly Originals

## Context

ADR 0015 defines formula morphing as output interpolation but deliberately leaves the side-by-side presentation for a later slice. A valid comparison must not create independent simulations whose timing, inputs or random histories can diverge.

## Decision

Every formula-backed experiment exposes the durable hot parameter `formulaView` with values `morph` and `compare`. `morph` preserves the existing single-view interpolation. `compare` evaluates formula A at morph endpoint `0` and formula B at endpoint `1` from the same live simulation state, simulation step, viewport scope, point IDs and interaction history.

Comparison duplicates only synchronous derived buffers and proximity work. It never creates a second simulation or clock. The Canvas renderer draws both full-scope results into labeled half-width panes using the same uniform scale and vertical offset. Formula coordinates and evaluation scope are not changed to fit a pane; only the final rendering transform changes. This preserves a meaningful A/B comparison rather than comparing formulas under different coordinate systems.

The additional A/B buffers are updated only while `formulaView = compare`. Telemetry continues to describe the morphed canonical view so switching presentation does not redefine the existing metrics contract.

## Consequences

- A and B remain synchronized on main-thread and Worker runtimes.
- Formula View is serialized by the existing parameter/state pipeline and requires no Studio experiment-specific branch.
- Compare mode intentionally performs additional formula and proximity work; Morph mode retains the prior cost.
- The morph slider remains editable in Compare mode because it is still part of the durable configuration, but the two displayed panes always show exact endpoints.

## Rollback

Remove the `compare` enum value and comparison renderer/session buffers. The canonical morph view and ADR 0015 interpolation remain unchanged.
