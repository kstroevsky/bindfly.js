# Stage 10A report: generic composition and Drooping Lines

- Status: Complete
- Date: 2026-09-13
- Stage 9.5 base: `540a03a`
- Session extraction commit: `d88ce91`

## Delivered

- Framework-free typed `ExperimentSession` with one Flying Lines composition shared by main and worker.
- Strongly typed `defineStudioExperiment(...)` construction and deliberate `StudioExperimentPlugin` erasure.
- Heterogeneous registry containing Flying Lines and Drooping Lines.
- Plugin-driven Studio title, parameters, interactions, metrics, execution profiles, durable state, routes and legacy migrations.
- Generic main-thread and worker hosts with experiment-specific code removed and enforced by a regression test.
- Additive Canvas2D main/worker execution profiles.
- Distinct typed snapshot state for analyzer contracts.
- Synchronous derivation contract plus adaptive proximity derivation.
- Drooping Lines simulation, typed `tan-x` / `atan-y` derived geometry, Canvas2D renderer, session, presets and plugin.
- Dynamic physical simulation state separated from Flying Lines rendering/derivation parameters.

## Verification

- V2 dependency boundaries, strict typecheck and lint: PASS.
- V2 unit/contract/integration suite: PASS, 84/84.
- V2 production build: PASS.
- Existing Flying Lines main/worker/state/mobile browser suite: PASS.
- Chromium browser suite: PASS, 5/5, including Drooping Lines main/worker switch, interaction, hot deformation and route restoration.
- Browser console health: PASS; no warnings, errors or page errors in the five flows.
- Desktop/mobile screenshot inspection: PASS after fixing the initially discovered direct Drooping route guard.
- React Doctor changed scope: 82/100, zero errors; one non-blocking effect-chain warning around capability fallback and URL synchronization.

## Exit criterion

Met. Adding Drooping Lines required no special-case branches in `StudioApp`, generic state code, routes or runtime hosts. Main and worker use the same session composition; execution profiles are truthful; real-time derivations and snapshot analysis are distinct.

## Next

Stage 10B compares the two real consumers and extracts only proven moving-particle/point-buffer and interaction commonality. The temporary Drooping → Flying movement dependency must become a neutral shared owner only after that comparison.
