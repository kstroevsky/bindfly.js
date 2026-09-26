# 57. Accepted Milestone B review and revised execution roadmap

Milestone B is **substantially successful and architecturally accepted with stabilization conditions**. The engine/runtime/performance foundation is proven; the multi-experiment product architecture is not yet proven. PR #33 must not expand into a broad legacy migration or another architectural rewrite.

The immediate sequence is:

1. complete Stage 9.5 as bounded correctness/contract stabilization in PR #33;
2. merge PR #33 after its automatic gates and milestone summary are ready;
3. create a fresh PR for Stage 10A, using Drooping Lines as experiment #2;
4. extract commonality only in Stage 10B after both experiments prove it.

## Stage 9.5 — Stabilize PR #33

Fix actual `hot-update` behavior so render/derivation-only changes do not reset the deterministic particle world. Make worker telemetry match main-thread telemetry, including maintaining and reporting dropped steps. Correct capability metadata, ensure Stage 9.5 stores capability support as a boolean separate from its display reason, and runtime-validate worker payloads after envelope validation.

Add CI on every PR for V2 boundaries, typecheck, lint, tests and both V2/legacy production builds. Add a small browser suite for main/worker startup, switching, parameter changes, point interaction, URL restoration/import and a mobile smoke viewport; performance artifacts remain informational on shared CI hardware and do not use fragile absolute thresholds.

Document known deferred architecture issues and the complete-graph output boundary. Add a concise Milestone B / PR #33 summary with explicit deferrals. Do not extract the session/plugin architecture inside PR #33.

Preserve the benchmark-driven adaptive proximity selector already proven in Milestone B: use the uniform grid only for sufficiently sparse neighborhoods and fall back to the brute-force semantic oracle for dense, large-radius workloads where the grid is slower.

**Exit criterion:** PR #33 has no knowingly false parameter/capability behavior, worker inputs are validated, main/worker telemetry fields agree, deterministic correctness gates are automatic, and the remaining architecture work is explicit.

## Stage 10A — Generic composition and Drooping Lines

Introduce a framework-free experiment-session boundary:

```text
ExperimentDefinition
        │
        ▼
ExperimentSession
 ├─ canonical parameters
 ├─ Simulation
 ├─ real-time Derivations
 ├─ Renderer
 ├─ interaction → domain input
 ├─ telemetry
 └─ snapshot adapter
        │
        ▼
ExecutionBackend
 ├─ MainThread
 └─ Worker
```

Main and worker runtimes determine **where** a session executes; they must not duplicate **what** the experiment does.

The session owns canonical parameters and routes relevant subsets to their consumers. Simulation primarily owns dynamic physical state; connection radius belongs to the proximity derivation and background belongs to rendering. A formula, derivation or rendering patch must not become simulation state merely because the first implementation stored it there.

Add a deliberately type-erased heterogeneous Studio registry boundary:

```text
StudioExperimentPlugin
 ├─ metadata
 ├─ parameter schema
 ├─ durable-state codec
 ├─ available execution profiles
 ├─ session factory
 ├─ interaction adapter
 └─ metric/inspector descriptors
```

Strong schema/state/input types remain inside each plugin. `StudioApp`, generic state, routes and runtime hosts consume erased plugins by stable ID and must not import Flying Lines types or special-case experiment branches.

Use a strongly typed `defineStudioExperiment(...)` helper inside each plugin, then erase only the resulting plugin at the `StudioExperimentPlugin` registry boundary. Do not require experiment modules themselves to use untyped casts.

Replace independent `renderers[]` × `runtimes[]` capability lists with additive execution profiles such as `{ rendererId: 'canvas2d', runtimeId: 'worker' }`. Support for a new backend profile must not require changing simulation code.

Stage 9.5 only corrects current metadata to report implemented worker support and stores capability support as a boolean separate from its display reason. The execution-profile redesign remains deferred to this stage.

Separate synchronous frame-critical `Derivation<Input, Output>` computations from asynchronous, budgeted `AnalyzerDefinition` snapshot work. The proximity graph is a derivation because drawing requires it every frame. Persistent homology, Lyapunov and similar work remain analysis-scheduler consumers.

The old 10 Hz graph example applies to scheduled graph statistics/inspection, not the per-frame proximity-edge derivation required by rendering. Analysis cadence remains independent; derivation cadence follows its declared frame consumer.

Correct snapshot typing before topology: connect a distinct `SnapshotState` generic to analyzers or remove analyzers from `ExperimentDefinition` until the first real asynchronous analyzer supplies concrete requirements. `snapshotState(): unknown` must not remain the apparent analyzer contract.

The current `ExperimentDefinition.analyzers` field is provisional until that Stage 10A decision; do not expand it into topology APIs beforehand.

Migrate **Drooping Lines** as experiment #2. Preserve its moving-particle and distance relationships while treating the endpoint transformation—such as `x′ = tan(x)` or `y′ = atan(y)`—as derived geometry unless evidence requires another owner.

Stage 10A represents that transformation as a typed, experiment-specific derived-geometry operator: neither a raw legacy-class port nor the general formula engine. Stage 12 later translates the proven transform contract into canonical formula IR, avoiding a throwaway hardcoded V2 migration.

**Exit criterion:** adding Drooping Lines requires no special-case branches in `StudioApp`, generic state code, routes or runtime hosts; main and worker use the same session composition; execution profiles are truthful; real-time derivations and snapshot analysis are distinct.

## Stage 10B — Extract only proven commonality

Compare Flying Lines and Drooping Lines, then extract shared moving-particle/point-buffer behavior only where both experiments genuinely consume it. Experiment-specific mathematics remains experiment-specific.

**Exit criterion:** shared abstractions have at least two real consumers, and no common API exists only because Flying Lines happened to need it first.

## Stage 11 — Formula engine

Implement parser → AST → semantic validation → canonical IR → deterministic JS interpreter, with no `eval()` or arbitrary JavaScript. Start with transforms and scalar expressions and preserve the security, budget, isolation, CSP, fuzzing, migration and backend-conformance requirements from the old Phase 11 backlog.

Add canonical inverse tangent as the allowlisted `atan` operation in the parser, AST, IR and interpreter before translating Drooping Lines; this extends the preserved Phase 11 function list specifically for the accepted `y′ = atan(y)` transform.

**Exit criterion:** a formula-defined experiment executes deterministically and serializes its formula/configuration.

## Stage 12 — Formula-backed Bindfly Originals

Move the Stage 10A Drooping typed transform, Pulse and the Spiral family into the mathematical formula model where appropriate. Add formula morphing and synchronized A/B comparison only after interpolation semantics are explicit.

**Exit criterion:** approved legacy “weird mathematics” is editable, reproducible laboratory content with frozen formula/source provenance rather than legacy animation structure.

## Stage 13 — Analysis runtime and topology

Add snapshot-analysis scheduling, budgets, cancellation, sampling and stale-result rejection separately from real-time derivations. Build β₀/Rips visualization first, then perform the approved persistent-homology backend spike and add barcode/diagram UI only after validation.

**Exit criterion:** the same frozen point cloud can be explored geometrically and topologically without tying topology to the render loop, and scientific provenance/failure states remain visible.

## Stage 14 — Dynamical-systems laboratory

Implement dimensional vector fields, discrete maps, trajectories, RK4 and scalar fields; later add equilibria, stability, Lyapunov, basins and bifurcations through optional analyzers.

**Exit criterion:** formula families are explicit mathematical experiment types rather than arbitrary expression strings.

## Stage 15 — Rendering and performance laboratory

Add a WebGL2 renderer for existing simulations and fair backend comparison before considering optional WebGPU/GPU compute. Preserve frozen workload, precision/tolerance, disposal and context-loss requirements.

**Exit criterion:** one experiment/seed runs through multiple rendering backends with measured, workload-equivalent timing.

## Stage 16 — Shared experiments and multiplayer

Extend reproducibility from configuration to initial state plus ordered event log plus optional checkpoint. Implement authoritative WebSocket events, sequence numbers, snapshots/checksums, resynchronization and the separate privacy/security/operations review.

**Exit criterion:** two clients can add/move points and deterministically observe the same mathematical system after forced divergence/recovery tests.

## Stage 17 — Educational and product layer

Add guided lessons, parameter sweeps, saved experiments, explanations, topology/dynamics challenges and collaborative mathematical games only after their engine/analyzer contracts are validated.

**Exit criterion:** Bindfly is a coherent learning/research tool rather than only an engine demonstration.

## Durable-state terminology

Use three exhaustive ownership groups:

```text
ExperimentConfiguration
    seed
    formulas
    parameters
    initial conditions

StudioConfiguration
    experiment id/version
    active analyzers
    renderer/runtime choice
    camera/view

SessionState
    current dynamic state
    current step
    interaction/event history
```

Phase 9 currently persists the implemented subset of `ExperimentConfiguration` plus renderer/runtime choice. Formula, initial-condition, analyzer and camera/view fields become durable when their features exist. Later replay and collaboration persist experiment + studio configuration, initial state, ordered event log and optional checkpoint. Do not call configuration-only URLs complete live-session replay.

## Complete-graph output scaling boundary

Current proximity workspaces reserve the complete undirected graph:

$$
E_{\max}=\frac{n(n-1)}{2}
$$

This is accepted only under the current 500-particle ceiling. Raising the ceiling requires an explicit edge-output strategy—edge budgets, streaming/chunked generation, sparse adjacency, renderer-consumed batches, sampling/LOD or GPU generation. Spatial indexing improves search; it does not remove worst-case edge-output complexity.

## Explicit non-goals for the next PR

Do not start WebGPU, WASM, physical npm-package extraction, test-runner replacement, persistent homology, a Webpack-to-Vite migration or Float32/GPU state. Keep the Float64 CPU deterministic tier until a separately declared backend/tolerance contract justifies another representation.

## Preserved backlog mapping

The old detailed phases remain normative technical backlog under this mapping:

| Preserved old backlog | Revised execution stage |
| --- | --- |
| Phase 10 legacy migration | Stages 10A/10B for Drooping Lines; Stage 12 for formula-backed originals |
| Phase 11 formula AST | Stage 11 |
| Phases 12–14 formula families, classics and morphing | Stages 11, 12 and 14 |
| Phase 15 graph analysis | Stage 13 derivation/analysis separation and graph-analysis work |
| Phases 16–19 topology and dynamics analysis | Stages 13 and 14 |
| Phases 20–22 WebGL, comparison and WebGPU | Stage 15 |
| Phases 23–25 multiplayer | Stage 16 |
| Product/education sections 34, 37 and 38 | Stage 17 |

Where an old hard stop is stricter than the revised stage text, the stricter safety, validation, privacy or scientific-evidence requirement remains in force.
