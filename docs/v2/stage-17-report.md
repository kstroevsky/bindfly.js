# Stage 17 — educational and product layer

Stage 17 turns the validated experiment, analyzer and collaboration contracts from Stages 13–16 into user-facing learning and research workflows. It stays in the Studio product layer: simulation, formula, renderer, analysis and authoritative collaboration semantics are unchanged.

The governing product contract is ADR 0021, `docs/adr/0021-stage-17-educational-product-contracts.md`.

## Stage 17.1 correctness hardening

The initial Stage 17 product layer exposed two correctness gaps during execution-path review: the connectivity challenge kept a wrapper-local edit count, and frozen sweeps temporarily mutated the live Studio without isolating other mutations. Stage 17.1 closes those gaps without changing Experiment, Simulation, formula VM, renderer, Rips mathematics or Stage 16 sequencing. It also strengthens sweep provenance, returns sweep Rips execution to the existing analysis Worker path, enforces the versioned mode/anchor invariant, adds deterministic rerun coverage, and corrects the CPU-derived performance label.

## Reproducible parameter sweeps

Studio now exposes bounded sweeps only for numeric parameters declared with `semantic: 'formula-parameter'` and experiments that expose a validated point-cloud source.

The two Stage 17 sweep modes are separate contracts:

- **Frozen formula sweep.** The live simulation must be frozen. Sweep execution owns a Studio mutation transaction: experiment/runtime/renderer changes, parameter and formula changes, Run/Step/Reset and pointer input are locked while samples execute. Every sample hot-updates one declared formula parameter, redraws at the same simulation step and captures a provenance-tagged point cloud. The starting parameter is restored before publication, and the restored capture must match the pre-sweep versioned SHA-256 captured-state fingerprint.
- **Dynamic simulation sweep.** Every sample creates a fresh experiment session from the same canonical experiment configuration, seed and viewport, applies the sample value before execution, advances exactly the declared fixed-step count, captures the point cloud, then disposes the session. Its anchor records step count, fixed-step seconds and the declared determinism tier. It never reuses the running live session as an implicit initial condition.

The initial product budget is nine samples per sweep and 600 fixed steps per dynamic sample. Raising either bound requires measured browser evidence rather than silently increasing interactive workload.

Each result records experiment/state version, canonical base experiment payload, seed, parameter identity and values, point-cloud source, viewport, analysis epsilon, sweep anchor, formula-configuration hash for each captured point cloud, analyzer ID/version, Euclidean CSS-pixel metric and the fact that analysis uses the full point cloud. The frozen anchor additionally stores a SHA-256 fingerprint over a versioned encoding of the captured point IDs/coordinates plus experiment/state/source, step and formula hash. This identifies the captured analysis state; it is deliberately not described as a replayable simulation checkpoint because Studio does not expose a general checkpoint contract for every experiment. Small-multiple previews may display a deterministic subset of points for UI cost, but their captions state the preview fraction and every numeric result is computed from the full captured point cloud.

Stage 17 reuses the validated `rips-complex-2d` analyzer rather than implementing a second topology path. Sweep samples now execute that analyzer through a dedicated `AnalysisWorkerClient`, so exact triangle counting stays off the UI thread and cancellation terminates stale sweep analysis. The Rips algorithm and its exact triangle-count semantics are unchanged; the nine-sample product bound is still a workload bound rather than a latency guarantee. Each sample reports point/edge counts, `β₀`, budget-qualified `β₁`, mean degree and analyzer warnings.

Sweep runs also carry a monotonically increasing run identity. A cancelled run or a run invalidated by controller replacement cannot publish stale results. Dynamic sessions yield periodically during long fixed-step loops, and the UI exposes explicit cancellation. Repeated frozen and dynamic plans are covered by deterministic-result tests.

## Saved experiments

Saved experiments are local-first product records in `localStorage`, bounded to 24 records. A record contains a name, stable local identity/timestamps and the existing canonical `StudioExportDocument`.

Saving does not persist runtime telemetry, drag/hover state, collaboration identity or room credentials. Loading always passes the embedded export back through `parseStudioImportDocument()` and `resolveStudioDurableState()`, so current state validation and migration remain the single persistence path. Corrupt collection data fails closed to an empty local collection rather than being interpreted as experiment state.

## Guided lessons, explanations and challenges

The lesson catalog is capability-gated and declarative. Studio exposes only lessons whose required experiment contracts exist:

- **Freeze and Step** explains one-fixed-step causality and completes only after a single explicit step while frozen.
- **Formula causality** explains synchronized frozen perturbations and completes from the existing formula perturbation trail.
- **Connectivity at scale** explains the pinned Euclidean Rips graph and completes only from validated analysis evidence where `β₀ = 1`.
- **Parameter sweep** explains frozen versus dynamic causal semantics and completes only after a provenance-tagged sweep result exists.

This keeps educational language downstream of validated runtime/analyzer facts. The product does not infer “hole”, persistence or chaotic behavior from appearance alone.

## Collaborative mathematical game

The first collaborative game is `connect-within-edits-v1`: participants try to obtain one connected component (`β₀ = 1`) with at least two points using no more than five newly accepted authoritative edits.

`ConnectivityCollaborativeGame` wraps `SharedExperimentClient` directly. A shared-room host supplies one `gameStartSequence`; every participant derives the score from `lastAppliedSequence - gameStartSequence`. Bob's accepted edit therefore spends Alice's budget too, a duplicate retry leaves the sequence unchanged, and constructing a new wrapper cannot reset the challenge. `complete` is false once the shared authoritative delta exceeds five, even if the graph is connected afterward. A two-browser acceptance fixture verifies that independent clients observe the same authoritative edit count.

The ordinary Studio currently presents the collaboration-capable experiment's game rule as educational/product text. The playable `ConnectivityCollaborativeGame` primitive/factory is exported for a shared-room host; Stage 17 does not claim that the ordinary single-user Studio itself creates or joins a playable game room.

## Performance evidence

The Studio performance surface now includes renderer/runtime identity, effective DPR, **Est. max FPS**, analysis duration and an explicit analysis-buffer memory estimate. **Est. max FPS** is `1000 / frame work ms`, so it represents theoretical CPU frame capacity rather than observed browser presentation FPS. The memory estimate is the sum of the actual typed point-cloud, edge and triangle buffers used by the current analysis result; it is not a browser-process memory claim. Existing experiment telemetry continues to provide point/edge counts and available Stage 15 simulation/derivation/upload/render/GPU timings.

All of this telemetry remains local-only and excludes formulas/state payloads, URLs, actor IDs and collaboration credentials.

## Product behavior and browser coverage

The Stage 17 Studio UI adds:

- guided lesson/challenge cards with visible completion state and explanatory text;
- frozen and dynamic sweep controls, reproducibility metadata and accessible small multiples;
- local Save/Load/Delete experiment controls using the canonical state path;
- the shared connectivity-game rule on collaboration-capable experiments;
- extended performance evidence without changing mathematical execution.

The browser fixtures prove that a frozen sweep locks live mutation, ignores pointer mutation attempts, restores its coefficient/captured-state fingerprint before publication and can be cancelled without a stale result; a dynamic sweep reruns a declared fixed-step count with timing/determinism provenance; two real collaboration clients observe the same shared game edit budget; saved experiments restore canonical state after a local mutation; guided challenge completion follows live evidence; and the existing Stage 13/15/16 workflows continue to operate.

## Verification

Final local verification on 2026-09-26:

- `pnpm run v2:check`: dependency boundaries, TypeScript and ESLint clean; **235/235 tests passed**;
- `pnpm run v2:e2e`: **20/20 Chromium Studio E2E tests passed** without retry;
- `pnpm run v2:e2e:stage16-cross-browser`: **6/6** collaboration game/recovery tests passed across Chromium, Firefox and WebKit;
- `pnpm run v2:build`: passed;
- `pnpm run build`: passed;
- `git diff --check`: passed.

Stage 17, including the Stage 17.1 correctness hardening, therefore meets its exit criterion: Bindfly exposes concrete mathematical questions that users can investigate through controlled causality, topology-at-scale, reproducible parameter experiments, saved research states and an authoritative collaborative challenge primitive, rather than presenting the engine as an isolated animation/runtime demonstration.
