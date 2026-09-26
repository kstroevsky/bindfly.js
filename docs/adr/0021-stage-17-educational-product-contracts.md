# ADR 0021: Stage 17 educational and product contracts

- Status: accepted
- Stage: 17 — Educational and product layer

## Context

Stages 13–16 established validated point-cloud/Rips analysis, declared formula parameters, workload-equivalent renderer telemetry, versioned Studio state, and authoritative shared experiments. Stage 17 turns those contracts into learning and research workflows without adding a second mathematical implementation.

The product must distinguish a formula sweep over one frozen simulation state from a dynamic sweep that reruns deterministic simulation. It must also keep saved experiments migratable, keep educational claims tied to validated analyzers, and build collaborative games on the Stage 16 authoritative client instead of inventing a separate multiplayer state model.

## Decision

Stage 17 is a Studio-owned product layer over existing engine contracts. It does not add a new engine module or stage-numbered runtime API.

Parameter sweeps use declared numeric parameters whose schema semantic is `formula-parameter`. The initial product budget is at most nine samples per sweep. A dynamic sweep may execute at most 600 fixed steps per sample. Raising either budget requires measured browser evidence. Both sweep modes use the existing Euclidean CSS-pixel point-cloud contract and the validated `rips-complex-2d` analyzer. Results always record analyzer ID/version, full-point-cloud approximation metadata, experiment/state version, canonical experiment payload, seed, parameter values, point-cloud source, epsilon and viewport.

The two sweep modes have distinct provenance:

- `frozen-formula` runs only while the Studio simulation is frozen. It applies one hot formula-parameter patch at a time, captures each point cloud at the same named simulation snapshot/step, and restores the starting parameter after the sweep. A step change invalidates the sweep.
- `dynamic-simulation` creates a fresh session for every sample from the same canonical experiment configuration, seed and viewport, applies the sample parameter before execution, runs exactly the declared fixed-step count, renders once to materialize derived geometry, captures the point cloud and disposes the session. It never reuses the live session as its initial condition.

Sweep small multiples render from the captured point-cloud samples. Numeric claims are taken from analyzer output, never inferred from appearance. `β₁` is shown only when the existing Rips budget reports it as computed.

Saved experiments are local-first, versioned product records that contain the existing canonical Studio export document. Loading a saved item always re-enters through the same state parser/migration path as imported JSON. Saved records do not contain runtime telemetry, hover/drag state, collaboration credentials or live session checkpoints.

Guided lessons and challenges are declarative, versioned Studio content. Completion predicates may use only validated runtime/analyzer facts. The first topology challenge uses connected-component `β₀`; the first dynamics lesson uses explicit Freeze/Step semantics. Labels such as “persistent”, “hole” or “chaotic” are used only when their validated analyzer contract exists.

Collaborative mathematical games wrap `SharedExperimentClient`. Game rules count accepted authoritative submissions and evaluate objectives from the shared session's rendered/validated metrics. The first game asks a room to connect the point set within a bounded number of accepted edits. The wrapper adds no event ordering, checkpoint or reconciliation state; Stage 16 remains authoritative.

Performance telemetry stays local-only. Stage 17 presents renderer/runtime, DPR, frame and stage timing, analysis duration and explicit typed-buffer memory estimates where the relevant buffers are available. No formula/state contents, URLs, actor IDs or room credentials are emitted as telemetry.

## Consequences

- Formula and dynamic sweeps are reproducible and cannot be confused in UI/export metadata.
- Educational claims reuse analyzer versions and warnings already validated in Stage 13.
- Saved work inherits current/future state migrations instead of creating a second persistence codec.
- Collaborative games can evolve independently of transport while retaining authoritative ordering and recovery.
- Stage 17 remains additive product code; simulation, formula, renderer, analysis and collaboration semantics stay unchanged.

## Rollback

Remove the Stage 17 Studio product modules and UI surfaces. Existing versioned URLs/JSON, analyzers, formula parameters, renderer telemetry and collaboration clients remain valid because this ADR does not change their wire or mathematical contracts.
