# ADR 0015: Formula-backed Originals and output morphing

- Status: accepted
- Stage: 12 — Formula-backed Bindfly Originals

## Context

Stage 11 supplied a bounded formula language, canonical IR and deterministic interpreter. Stage 12 must translate the proven Drooping Lines transform and the approved Pulse/Spiral mathematics without preserving their legacy animation classes. Formula morphing and synchronized A/B comparison may start only after interpolation semantics are explicit.

## Decision

Bindfly Originals are versioned formula records. Each record freezes its display identity, variable allowlist, exact x/y source strings, legacy source path, Git blob identity and the behavior from which the formula was captured. The first catalog contains Drooping tangent-x, Drooping inverse-tangent-y, Pulse 2023 and Spiral I/II/III. Runtime modules never import the legacy source tree.

Formula morphing is output interpolation. For a shared scope `s` and morph amount `t` in `[0, 1]`:

```text
A = evaluate(formulaA, s)
B = evaluate(formulaB, s)
morphed.x = (1 - t) * A.x + t * B.x
morphed.y = (1 - t) * A.y + t * B.y
```

Formula text, AST nodes and IR instructions are never interpolated. Both branches use the same input scope and are evaluated in deterministic A-then-B order. A non-finite or domain-invalid branch invalidates that sample; Drooping geometry omits the source point and records the invalid count. This keeps unsafe numeric output out of render buffers without substituting an invented coordinate.

Drooping Lines owns four editable hot parameters (`formulaAX`, `formulaAY`, `formulaBX`, `formulaBY`) and `formulaMorph`. Formulas compile atomically before a parameter patch is committed. Configuration import and worker/main parameter boundaries apply the same validation. State version 2 migrates the former `tan-x` preset to `formulaMorph = 0` and `atan-y` to `formulaMorph = 1` while installing the frozen original source strings.

## Consequences

- `t = 0` and `t = 1` reproduce the two Stage 10A Drooping transforms exactly; intermediate values are defined and reproducible.
- The formula catalog preserves Pulse/Spiral identity before their execution sessions are built.
- Formula editing changes derived geometry, not physical moving-point state, so hot updates do not reset the deterministic world.
- ADR 0017 consumes the A/B contract for synchronized side-by-side presentation without changing the interpolation semantics defined here.
- The original formulas remain intentionally unusual; no textbook replacement or numerical cleanup is authorized.

## Rollback

Revert the Stage 12 formula-backed Drooping slice and continue reading state version 1. The frozen catalog remains independently removable because no legacy module depends on it.
