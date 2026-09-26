# Milestone B / PR #33 summary

Milestone B proves the Bindfly 2 engine/runtime/performance foundation with a complete Flying Lines vertical slice. It is substantially successful, but it does not yet prove a heterogeneous multi-experiment product architecture.

## Delivered

- A `src-v2` strangler tree isolated from legacy `src`, with enforceable dependency and React boundaries.
- Typed simulation, experiment, parameter, renderer, RNG, state, runtime and analysis contracts.
- Flying Lines as simulation → proximity derivation → renderer → runtime → Studio.
- Fixed 120 Hz stepping, deterministic event ordering, explicit overload handling, pause/reset/dispose separation and refresh-rate-independent replay.
- Structure-of-arrays particle storage, stable IDs, reusable buffers and an adaptive brute/grid proximity backend selected from measured workloads.
- Main-thread and worker execution with parity tests and OffscreenCanvas capability fallback.
- A schema-driven React Studio with pointer interaction, metrics and runtime switching.
- Versioned canonical URL/JSON configuration state, strict parsing, migrations, Unicode-safe encoding and an explicit URL budget.
- Stage 9.5 fixes for declared hot-update semantics, worker dropped-step telemetry, truthful capabilities, worker payload validation and automated CI/browser smoke gates.

## Why `src-v2` exists

`src-v2` is an intentional strangler boundary, not a second production application that silently misses legacy changes. The legacy app remains under `src`; the new Studio entry point compiles `apps/studio` with `src-v2`. The separation prevents new engine code from importing legacy classes while behavior is migrated and verified incrementally. Run `pnpm run v2:start` for the Bindfly 2 Studio and the existing legacy command for the old app.

## Explicit deferrals

- Shared main/worker experiment composition and the heterogeneous Studio plugin registry.
- Drooping Lines as the second experiment and the first real architecture pressure test.
- Execution profiles replacing the renderer/runtime Cartesian capability lists.
- A dedicated synchronous derivation contract distinct from budgeted snapshot analysis.
- Correctly typed analyzer snapshots before persistent homology or Lyapunov work.
- Formula parsing/IR/interpreter, formula-backed Originals, topology, dynamical systems, WebGL2/WebGPU, multiplayer and education/product layers.
- A scalable edge-output representation above the current 500-particle complete-graph allocation boundary.

## Merge gates

- `pnpm run v2:check`
- `pnpm run v2:build`
- `pnpm run build`
- `pnpm run v2:e2e`

Performance comparisons are recorded separately and do not use fragile absolute CI thresholds.

## Next PR

Start Stage 10A in a fresh PR: extract `ExperimentSession`, introduce the heterogeneous `StudioExperimentPlugin` boundary and add Drooping Lines without special-case branches in the generic Studio, state, route or runtime hosts.
