# ADR 0019: Formula comparison buffer validity

- Status: accepted
- Stage: 13B — Formula lenses

## Context

Stage 12 comparison recomputes morphed, Formula A and Formula B point clouds independently. Stage 13 needs one reusable derivation that evaluates both formulas once per stable point and preserves side-specific domain failures for Difference and Probe.

The comparison result is dense in stable point order so a point remains inspectable even when one formula is invalid. Numeric slots for an invalid side must never be mistaken for geometry.

## Decision

`FormulaComparisonPointBuffer.validity` is version 1 and uses this frozen `Uint8Array` encoding:

```text
0 = both invalid / no valid displacement
1 = both valid
2 = Formula A invalid, Formula B valid
3 = Formula A valid, Formula B invalid
```

Zero is intentionally the safest default for newly allocated typed storage. Every consumer checks `validity` before reading numeric coordinate, displacement or magnitude slots.

Invalid numeric slots are initialized and rewritten as `NaN`. `NaN` is missing-value storage, not a validity flag: consumers branch on `validity` first and never send invalid slots to proximity analysis or rendering. A displacement vector and magnitude exist only for validity `1`.

For validity `2`, B coordinates may be read but A, morph, displacement and magnitude slots are missing. For validity `3`, A coordinates may be read but B, morph, displacement and magnitude slots are missing. For validity `0`, all coordinate and displacement slots are missing.

The derivation evaluates A and B exactly once per point against one canonical formula scope. Compact Formula A, Formula B and morph point views may copy valid coordinates from this buffer for existing proximity/rendering contracts, but they never reevaluate formulas.

## Consequences

- Side-specific domain discontinuities survive derivation and can be shown by Difference/Probe.
- The zero-initialized validity array fails closed if a row is not written.
- Existing proximity code continues to receive compact finite point buffers.
- ADR 0017 remains valid for synchronized comparison, but its accepted duplicate formula-derivation cost is superseded by this one-pass data product.

## Rollback

Restore the Stage 12 independent endpoint derivations and remove the Difference/Probe consumers. Do not reinterpret persisted validity bytes under another meaning; a future encoding change requires a new version.
