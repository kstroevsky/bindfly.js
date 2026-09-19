# Stage 12 progress: formula-backed Bindfly Originals

Stage 12 is in progress on the current integration branch. This report records the first bounded slice; it does not mark the stage complete.

## Implemented

- Added a versioned Bindfly Originals formula catalog for Drooping tangent-x, Drooping inverse-tangent-y, Pulse 2023 and Spiral I/II/III.
- Frozen each entry's exact formula source, variable allowlist, legacy path, Git blob and captured behavior.
- Defined deterministic A/B output interpolation in ADR 0015 and implemented it in the formula runtime.
- Replaced Drooping's hardcoded transform enum with editable A/B x/y formula parameters and a hot `formulaMorph` parameter.
- Compiled formula changes atomically and reused the same compiled programs on main-thread and worker sessions.
- Migrated Drooping durable state from version 1 to version 2 without changing the meaning of either original preset.
- Rejected malformed formula source at UI, worker/session and imported-state boundaries.
- Preserved the moving-point simulation and render backend unchanged.

## Verification status

- V2 boundaries, typecheck, lint and 102 tests: PASS.
- Formula endpoint/midpoint semantics: PASS through unit tests.
- Independent legacy formula parity for Pulse/Spiral catalog entries: PASS through direct `Math` expectations.
- Drooping state migration and untrusted import rejection: PASS through codec tests.
- Production V2 build: PASS.
- Chromium browser suite: PASS, 5/5, including Drooping formula morphing and main/worker switching.
- Desktop and mobile rendered smoke checks: PASS with visible controls/canvas and no console or page errors.
- React Doctor changed-scope scan: 83/100 with one pre-existing effect-chain warning in `studio-app.tsx`; this slice changed only the Stage label on that component and introduced no new React diagnostic.

## Remaining Stage 12 work

- Build formula-backed Pulse and Spiral execution sessions from the frozen catalog.
- Add the synchronized side-by-side A/B Studio presentation using identical seed, state, step and scope.
- Expose provenance in the experiment inspector/export rather than only in the engine catalog and documentation.
- Complete browser comparison, hot-edit and restoration tests for the remaining Originals.
