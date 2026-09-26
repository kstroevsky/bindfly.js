# Stage 11 report: safe formula engine

- Status: Complete
- Date: 2026-09-19
- Stage 10B base: `9dad70d`

## Delivered

- Bounded tokenizer and recursive-descent parser for scalar expressions.
- Immutable discriminated AST with right-associative power and explicit unary precedence.
- Semantic variable/function allowlists and exact function arity validation.
- Canonical version-1 stack IR with sorted variable indices.
- Deterministic switch-based interpreter with no dynamic code generation.
- Required `atan` support alongside `sin`, `cos`, `tan`, `exp`, `log`, `abs`, `sqrt`, `min` and `max`.
- Finite-input/result enforcement and explicit domain failures.
- Frozen source, token, node, depth and operation budgets.
- Versioned scalar-program, 2D-transform and formula-experiment serialization that recompiles source instead of trusting serialized instructions.
- Formula-defined 2D experiment configuration with finite scalar parameters.
- Versioned backend-conformance fixtures, bounded deterministic fuzz coverage and static CSP checks.
- Actual serialized formula execution across an isolated worker-thread boundary.

## Verification

- Full V2 boundary/typecheck/lint/test gate: PASS, 98/98 tests.
- Focused formula and worker tests: PASS, 12/12.
- Parser precedence, all allowlisted functions and `atan`: PASS.
- Unknown grammar/functions/variables/arity rejection: PASS.
- Forged in-memory instruction/operator/function rejection: PASS.
- Numeric domain and non-finite rejection: PASS.
- All five budgets: PASS.
- Program/transform/experiment round trips and future-version rejection: PASS.
- Worker isolation: PASS.
- No `eval()` or dynamic `Function`: PASS.
- V2 and legacy production builds: PASS.
- Existing Chromium Studio suite: PASS, 5/5.

## Exit criterion

Met. A formula-defined transform experiment executes deterministically, crosses a worker boundary, and serializes/reloads its formula and configuration without executing arbitrary JavaScript.

## Explicit deferrals

- Translating Drooping Lines, Pulse and Spiral content to formula IR: Stage 12.
- Formula morphing and synchronized A/B comparison: Stage 12 after interpolation semantics are explicit.
- Vector fields, maps, trajectories and scalar-field experiment types: Stage 14.
- JIT, WASM, WebGL or GPU formula backends: later backend-conformance work.
