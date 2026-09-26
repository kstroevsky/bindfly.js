# Stage 17 — educational and product layer

Stage 17 turns the validated experiment, analyzer and collaboration contracts from Stages 13–16 into user-facing learning and research workflows. It stays in the Studio product layer: simulation, formula, renderer, analysis and authoritative collaboration semantics are unchanged.

The governing product contract is ADR 0021, `docs/adr/0021-stage-17-educational-product-contracts.md`.

## Reproducible parameter sweeps

Studio now exposes bounded sweeps only for numeric parameters declared with `semantic: 'formula-parameter'` and experiments that expose a validated point-cloud source.

The two Stage 17 sweep modes are separate contracts:

- **Frozen formula sweep.** The live simulation must be frozen. Every sample hot-updates one declared formula parameter, redraws at the same simulation step, captures the same point-input state through a provenance-tagged point-cloud snapshot, and restores the original parameter afterward. The sweep fails if a sample reports another simulation step.
- **Dynamic simulation sweep.** Every sample creates a fresh experiment session from the same canonical experiment configuration, seed and viewport, applies the sample value before execution, advances exactly the declared fixed-step count, captures the point cloud, then disposes the session. It never reuses the running live session as an implicit initial condition.

The initial product budget is nine samples per sweep and 600 fixed steps per dynamic sample. Raising either bound requires measured browser evidence rather than silently increasing interactive workload.

Each result records experiment/state version, canonical base experiment payload, seed, parameter identity and values, point-cloud source, viewport, analysis epsilon, sweep anchor, formula-configuration hash for each captured point cloud, analyzer ID/version, Euclidean CSS-pixel metric and the fact that analysis uses the full point cloud. Small-multiple previews may display a deterministic subset of points for UI cost, but their captions state the preview fraction and every numeric result is computed from the full captured point cloud.

Stage 17 reuses the validated `rips-complex-2d` analyzer rather than implementing a second topology path. Each sample reports point/edge counts, `β₀`, budget-qualified `β₁`, mean degree and analyzer warnings. The visual grid is therefore accompanied by inspectable numerical/provenance evidence.

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

`ConnectivityCollaborativeGame` wraps `SharedExperimentClient` directly. It counts only successful non-duplicate authoritative submissions, so an ambiguous-ack retry that Stage 16 resolves as `duplicate=true` does not consume another game edit. Game status reads the shared experiment session's rendered metrics; the game adds no sequence, checkpoint, reconciliation or transport state of its own. The factory is exported from the Studio public entry point for shared-room hosts.

## Performance evidence

The Studio performance surface now includes renderer/runtime identity, effective DPR, frame-derived throughput, analysis duration and an explicit analysis-buffer memory estimate. The memory estimate is the sum of the actual typed point-cloud, edge and triangle buffers used by the current analysis result; it is not a browser-process memory claim. Existing experiment telemetry continues to provide point/edge counts and available Stage 15 simulation/derivation/upload/render/GPU timings.

All of this telemetry remains local-only and excludes formulas/state payloads, URLs, actor IDs and collaboration credentials.

## Product behavior and browser coverage

The Stage 17 Studio UI adds:

- guided lesson/challenge cards with visible completion state and explanatory text;
- frozen and dynamic sweep controls, reproducibility metadata and accessible small multiples;
- local Save/Load/Delete experiment controls using the canonical state path;
- the shared connectivity-game rule on collaboration-capable experiments;
- extended performance evidence without changing mathematical execution.

The browser fixtures prove that a frozen sweep preserves the live step and restores its coefficient, a dynamic sweep reruns a declared fixed-step count, saved experiments restore canonical state after a local mutation, guided challenge completion follows live evidence, and the existing Stage 13/15/16 workflows continue to operate.

## Verification

Final local verification on 2026-09-26:

- `pnpm run v2:check`: dependency boundaries, TypeScript and ESLint clean; **230/230 tests passed**;
- `pnpm run v2:e2e`: **18/18 Chromium Studio E2E tests passed** without retry;
- `pnpm run v2:e2e:stage16-cross-browser`: **3/3** collaboration recovery projects passed in Chromium, Firefox and WebKit;
- `pnpm run v2:build`: passed;
- `pnpm run build`: passed;
- `git diff --check`: passed.

Stage 17 therefore meets its exit criterion: Bindfly exposes concrete mathematical questions that users can investigate through controlled causality, topology-at-scale, reproducible parameter experiments, saved research states and an authoritative collaborative challenge, rather than presenting the engine as an isolated animation/runtime demonstration.
