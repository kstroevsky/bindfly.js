# ADR 0021: Stage 17 educational and product contracts

- Status: accepted
- Stage: 17 — Educational and product layer

## Context

Stages 13–16 established validated point-cloud/Rips analysis, declared formula parameters, workload-equivalent renderer telemetry, versioned Studio state, and authoritative shared experiments. Stage 17 turns those contracts into learning and research workflows without adding a second mathematical implementation.

The product must distinguish a formula sweep over one frozen simulation state from a dynamic sweep that reruns deterministic simulation. It must also keep saved experiments migratable, keep educational claims tied to validated analyzers, and build collaborative games on the Stage 16 authoritative client instead of inventing a separate multiplayer state model.

## Decision

Stage 17 is a Studio-owned product layer over existing engine contracts. It does not add a new engine module or stage-numbered runtime API.

Parameter sweeps use declared numeric parameters whose schema semantic is `formula-parameter`. The initial product budget is at most nine samples per sweep. A dynamic sweep may execute at most 600 fixed steps per sample. Raising either budget requires measured browser evidence. Both sweep modes use the existing Euclidean CSS-pixel point-cloud contract and the validated `rips-complex-2d` analyzer. Rips work is dispatched through the existing analysis Worker client, so exact triangle enumeration does not run on the Studio UI thread. Results always record analyzer ID/version, full-point-cloud approximation metadata, experiment/state version, canonical experiment payload, seed, parameter values, point-cloud source, epsilon and viewport.

The two sweep modes have distinct provenance:

- `frozen-formula` runs only while the Studio simulation is frozen. Sweep execution is a Studio transaction: experiment/runtime/renderer changes, parameter/formula changes, Run/Step/Reset and pointer mutation are blocked until restoration completes. It applies one hot formula-parameter patch at a time, captures each point cloud at the same named simulation snapshot/step, restores the starting parameter, and verifies a versioned SHA-256 fingerprint of the captured analysis state before publishing the result. The fingerprint covers captured point IDs/coordinates, experiment/state/source identity, simulation step and formula-configuration hash. It is a reproducibility fingerprint of the captured analysis state, not a replayable simulation checkpoint.
- `dynamic-simulation` creates a fresh session for every sample from the same canonical experiment configuration, seed and viewport, applies the sample parameter before execution, runs exactly the declared fixed-step count, renders once to materialize derived geometry, captures the point cloud and disposes the session. The anchor records the fixed-step duration and declared determinism tier in addition to the step count. It never reuses the live session as its initial condition.

Sweep runs carry a monotonically increasing Studio run identity and an abort signal. A cancelled or superseded run cannot publish a result into a replacement session. Dynamic stepping yields periodically to the browser; cancelling a frozen run still waits for parameter/state restoration before the mutation lock is released.

Sweep small multiples render from the captured point-cloud samples. Numeric claims are taken from analyzer output, never inferred from appearance. `β₁` is shown only when the existing Rips budget reports it as computed.

Saved experiments are local-first, versioned product records that contain the existing canonical Studio export document. Loading a saved item always re-enters through the same state parser/migration path as imported JSON. Saved records do not contain runtime telemetry, hover/drag state, collaboration credentials or live session checkpoints.

Guided lessons and challenges are declarative, versioned Studio content. Completion predicates may use only validated runtime/analyzer facts. The first topology challenge uses connected-component `β₀`; the first dynamics lesson uses explicit Freeze/Step semantics. Labels such as “persistent”, “hole” or “chaotic” are used only when their validated analyzer contract exists.

Collaborative mathematical games wrap `SharedExperimentClient`. The first game receives one shared authoritative start sequence from its room host and derives its edit count as `lastAppliedSequence - gameStartSequence`; therefore edits accepted from any participant consume the same room budget, duplicate retries do not, and recreating a local wrapper cannot reset the score. Completion requires the shared rendered state to have at least two points and `β₀ = 1` while the authoritative edit delta is at most five. If concurrent traffic advances the room beyond five accepted edits, the challenge is a loss even if the graph later becomes connected. The wrapper adds no event ordering, checkpoint or reconciliation state; Stage 16 remains authoritative.

Performance telemetry stays local-only. Stage 17 presents renderer/runtime, DPR, frame and stage timing, analysis duration and explicit typed-buffer memory estimates where the relevant buffers are available. The value derived as `1000 / CPU frame work ms` is labeled **Est. max FPS**; it is CPU frame capacity, not observed `requestAnimationFrame` presentation FPS. No formula/state contents, URLs, actor IDs or room credentials are emitted as telemetry.

## Consequences

- Formula and dynamic sweeps are reproducible and cannot be confused in UI/export metadata.
- Educational claims reuse analyzer versions and warnings already validated in Stage 13.
- Saved work inherits current/future state migrations instead of creating a second persistence codec.
- Collaborative games can evolve independently of transport while retaining authoritative ordering and recovery.
- Stage 17 remains additive product code; simulation, formula, renderer, analysis and collaboration semantics stay unchanged.

## Rollback

Remove the Stage 17 Studio product modules and UI surfaces. Existing versioned URLs/JSON, analyzers, formula parameters, renderer telemetry and collaboration clients remain valid because this ADR does not change their wire or mathematical contracts.
