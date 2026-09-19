# ADR 0016: Parametric Originals fixed-step model

- Status: accepted
- Stage: 12 — Formula-backed Bindfly Originals

## Context

Pulse 2023 and Spiral I/II/III combined formula evaluation, mutable animation phase, proximity derivation and Canvas rendering in legacy classes. Their coordinates are now frozen formula records, but executing those formulas requires explicit deterministic timing and ownership rather than recreating the classes.

## Decision

Register four stable Studio experiments: `pulse-2023`, `spiral-1`, `spiral-2` and `spiral-3`. They share a framework-free parametric-original simulation/session implementation while retaining separate definitions, titles, default formulas, legacy routes and durable configuration.

The fixed 120 Hz simulation owns only dynamic phase state: the scalar accumulator, direction flag, per-point accumulator samples and interactive center. One fixed step visits points in stable index order. Pulse preserves its two sequential floating-point updates (`±1`, then `∓0.000005`); the Spiral family preserves its single `0.999995 × direction` update. Display refresh rate never changes this sequence.

Point coordinates are synchronous real-time derivation, not simulation state. The derivation constructs the preserved Pulse or Spiral angle/distance scope, evaluates formula A and B through canonical formula IR, then applies ADR 0015 output interpolation. Formula, weight, radius, color and morph changes are hot updates; point-count changes reset phase state. Invalid formula samples are omitted rather than sent to Canvas as non-finite coordinates.

The existing proximity derivation and Canvas2D renderer consume the resulting point buffer. Main-thread and worker runtimes instantiate the same session. Pointer-down moves the parametric center through a domain input. Legacy `Pulse-*`, `Spiral-*`, `Spiral2-*` and `Spiral3-*` routes migrate through their plugins.

## Consequences

- The old mathematical identity remains formula content with source provenance, while timing and lifecycle use the deterministic V2 runtime.
- All four experiments can edit and morph formulas without restarting their phase trajectory.
- Shared code exists because four concrete consumers use it; experiment identity remains separate at the registry boundary.
- Synchronized side-by-side A/B presentation and visible provenance remain later Stage 12 work.

## Rollback

Remove the four plugin registrations and the parametric-original engine/session modules. Drooping Lines and the Stage 11 formula engine remain independent.
