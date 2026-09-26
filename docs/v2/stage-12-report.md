# Stage 12 report: formula-backed Bindfly Originals

Stage 12 is complete on the current integration branch.

## Implemented

- Added a versioned Bindfly Originals formula catalog for Drooping tangent-x, Drooping inverse-tangent-y, Pulse 2023 and Spiral I/II/III.
- Frozen each entry's exact formula source, variable allowlist, legacy path, Git blob and captured behavior.
- Defined deterministic A/B output interpolation in ADR 0015 and implemented it in the formula runtime.
- Replaced Drooping's hardcoded transform enum with editable A/B x/y formula parameters and a hot `formulaMorph` parameter.
- Compiled formula changes atomically and reused the same compiled programs on main-thread and worker sessions.
- Migrated Drooping durable state from version 1 to version 2 without changing the meaning of either original preset.
- Rejected malformed formula source at UI, worker/session and imported-state boundaries.
- Preserved the moving-point simulation and render backend unchanged.
- Added draft-based, full-width formula editors so incomplete expressions remain editable until Enter/Apply, with per-formula restoration to the frozen default.
- Constrained the desktop Studio to the viewport so its sidebar scrolls independently, and deferred ResizeObserver writes to animation frames to prevent the development runtime overlay during parameter resets.
- Added executable `pulse-2023`, `spiral-1`, `spiral-2` and `spiral-3` experiments backed by their frozen formula records.
- Added a shared deterministic parametric phase simulation, formula-derived point buffer, proximity derivation and Canvas session used identically by main-thread and worker runtimes.
- Preserved Pulse's two-operation accumulator update separately from the Spiral family's single-operation update, and migrated the recorded legacy routes through plugin-owned adapters.
- Added durable Morph/Compare presentation for every formula-backed experiment. Compare mode derives exact A/B endpoints from one simulation state and renders labeled panes on both main-thread and Worker runtimes.
- Added immutable plugin provenance, a visible Inspector record and a versioned JSON export manifest containing the original ID, format version, legacy path, Git blob and captured behavior. Import rejects forged provenance while retaining compatibility with raw configuration JSON.

## Verification status

- V2 boundaries, typecheck, lint and 108 tests: PASS.
- Formula endpoint/midpoint semantics: PASS through unit tests.
- Independent legacy formula parity for Pulse/Spiral catalog entries: PASS through direct `Math` expectations.
- Drooping state migration and untrusted import rejection: PASS through codec tests.
- Production V2 build: PASS.
- Chromium browser suite: PASS, 7/7, including Drooping formula editing, all four parametric Originals, synchronized comparison, provenance inspection/export and main/worker switching.
- Desktop and mobile rendered smoke checks: PASS with visible controls/canvas and no console or page errors.
- React Doctor changed-scope scan: 84/100 with one pre-existing effect-chain warning in `studio-app.tsx`; the Stage 12 UI work introduced no new React diagnostic.

## Exit criterion

Met. The approved legacy Drooping, Pulse and Spiral mathematics is editable and reproducible through bounded formula IR rather than legacy animation classes. Exact source provenance is frozen, mechanically checked, visible and exported. Formula morphing and synchronized A/B comparison use explicit output-interpolation semantics.

## Next stage

Stage 13 adds snapshot-analysis scheduling, budgets, cancellation, sampling and stale-result rejection before topology analyzers are attached to the live Studio.
