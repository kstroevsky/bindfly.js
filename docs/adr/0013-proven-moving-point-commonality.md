# ADR 0013: Extract only proven moving-point commonality

- Status: Accepted
- Date: 2026-09-19
- Stage: 10B — Extract only proven commonality
- Depends on: ADR 0011, ADR 0012

## Decision

Move the physical point-world behavior proven identical by Flying Lines and Drooping Lines into the neutral `effects/moving-points` owner. The shared contract contains only:

- structure-of-arrays point storage and stable numeric IDs;
- seeded initialization, velocity, lifetime and boundary reflection;
- add, move-nearest, move-by-ID and remove-nearest inputs;
- resize clamping, deterministic reset and disposal;
- the four physical parameter definitions consumed by both experiments;
- deep snapshots of the active typed-array ranges.

Both experiment simulations are now typed factory adapters over `createMovingPointSimulation`. Neither experiment-specific module may import the other; a regression test enforces this direction. Their public state/input aliases name the experiment contract while resolving to the neutral implementation types.

The Studio point-input validator and pointer gesture controller are also neutralized because both plugins emitted identical input sequences in the Stage 10B characterization test.

## Evidence

Before extraction, a deterministic characterization ran both experiment definitions with the same seed, physical parameters, 20 fixed steps, add/move/remove inputs, resize and reset. Every active ID, coordinate, velocity and lifetime value matched exactly. A second characterization proved their pointer controllers emitted identical domain inputs for click, shift-click and drag.

CodeGraph identified the temporary Drooping → Flying simulation dependency and the Flying-named point buffer as affecting both experiment trees. The refreshed structural graph places both definitions and both simulation adapters in the same moving-point dependency neighborhood.

## Explicit non-commonality

The following remain experiment-owned:

- Flying proximity derivation and connected-component telemetry;
- Drooping `tan-x` / `atan-y` directed geometry;
- Canvas renderers and color choices;
- sessions, metric descriptors, codecs, presets and legacy migrations;
- renderer/derivation parameters such as connection radius, background and deformation.

No generic line-effect base class, formula abstraction or universal particle framework is introduced.

## Consequences

- Shared APIs have two concrete production consumers.
- Drooping Lines no longer depends on Flying Lines implementation files.
- Fixes to physical point behavior have one owner and parity coverage.
- Stage 11 can build formula infrastructure without inheriting accidental legacy animation hierarchy.

## Rollback

Revert the Stage 10B commit. ADR 0012's typed temporary delegation remains a valid Stage 10A baseline.
