# Revision 2 semantic verification

- Base plan SHA-256: `8a2bda7188e5d5fd571b5eee533f6759944cb9cd325320d9077651aa520e79b6`
- Candidate SHA-256: `a1e4d827fdf7fc351c3a651c83ec6fc7619e169c6298bc30d62f9c1f818c5ce0`
- Delta SHA-256: `3bde65f091802908e7aa7a2ad8caf1f73d391eb17fa4adba318ceb2f86df424c`
- Base ledger SHA-256: `e1a4b4384fd5a8768a88a97ad1c39efcef9e7634c974d5dac3c7ab3f34eb16cb`
- Target ledger SHA-256: `92c1b5b14e8879c5a9b8e575d3f8f015fa31a173adde6c3d1f0ed7192563bb8e`

## Delta pass

PASS. All eleven manifest records are implemented exactly once. Existing requirements use `AMEND` or `SUPERSEDE`; genuinely new requirements use `ADD`. They cover the revised roadmap/PR sequence, Stage 9.5 stabilization, adaptive proximity selection, experiment/analysis amendments, new session/plugin/profile/derivation/snapshot boundaries, complete-edge scaling, durable-state amendments and additions, and explicit non-goals.

## Preservation pass

PASS. Existing Phases 0–9 remain operationally unchanged. Old Phases 10–25 remain byte-for-byte as technical backlog, while `ROAD-001` alone is recorded as superseded after Phase 9 by `ROAD-002`. `TARGET-001` records the old Flying Lines milestone as completed and points current authority to `ROAD-002`. No active or deferred target requirement depends on the superseded record.

The target ledger contains 88 active, 38 deferred and 1 superseded requirement. The eight new Stage 10B–17 records preserve each stage's deliverables, ordering/preconditions and exit criterion rather than compressing them into roadmap prose.

## Exact-contract pass

PASS. New exact tokens come from the approved review payload: Stage `9.5`, `10A`, `10B`, Stages `11`–`17`, PR `#33`, the `500`-particle ceiling, `E_max=n(n-1)/2`, the retained Float64 CPU tier, the typed `defineStudioExperiment(...)` helper and the `atan` operation required by Drooping Lines. Worker telemetry parity explicitly means maintaining and reporting dropped steps. No unapproved performance threshold or backend commitment is introduced.

## Negative-control pass

PASS. WebGPU, WASM, physical package extraction, test-runner replacement, persistent homology implementation, Vite migration and Float32/GPU state remain deferred. Stage 9.5 explicitly forbids extracting the session/plugin architecture inside PR #33. The execution-profile redesign remains Stage 10A work.

## Cross-interface pass

PASS.

- `StudioExperimentPlugin` produces metadata/schema/codec/profiles/session/interaction/metrics consumed by generic Studio, state, routes and runtime hosts.
- `ExperimentSession` owns canonical parameters, simulation, derivations, rendering, interactions, telemetry and snapshot adaptation; execution backends only select location.
- Parameters route to dynamic simulation, proximity derivation or renderer ownership and apply their declared invalidation mode.
- Real-time derivations feed frames; immutable snapshots feed separately scheduled analyzers.
- Experiment and Studio configuration later combine with initial state, ordered event log and optional checkpoint for replay/collaboration.
- `ROAD-002` identifies `ROAD-001` as its superseded provenance; current milestone authority depends on `ROAD-002`.
- The accepted adaptive proximity selector keeps brute force as the semantic/dense-workload fallback and uses the grid only for measured sparse benefit.
- Stage 10A's typed experiment helper produces plugin-specific values before erasure at the registry, and Stage 11 provides `atan` through parser, AST, IR and interpreter before Stage 12 translation.
- CI produces deterministic gates while performance remains informational on shared runners.
- Worker payload validation is explicitly ordered after envelope validation; execution profiles remain additive without simulation changes; the Drooping typed-transform preservation and Stage 12 formula-IR handoff are structured in the ledger.

## Standalone pass

PASS. The candidate retains the complete base plan and adds an explicit authoritative amendment with executable stage exit criteria, ordering, failure/defer actions and interface diagrams. Amended ledger records retain their original source location and add an explicit Section 57 amendment location/anchor. A new implementer can identify the exact Stage 9.5 telemetry field, capability rule, validation boundary and adaptive proximity rule without relying on the chat review.

## Disposition

Semantic verification: PASS. Independent forward verification: PASS. Revision may be promoted as the accepted canonical amendment.
