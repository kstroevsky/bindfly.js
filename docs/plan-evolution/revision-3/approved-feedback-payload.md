# Approved mathematical-experience review payload

Source: user review dated 2026-09-20 after Stage 12 completion.

This document is the complete normative projection of that review for roadmap revision 3. Unmentioned requirements remain `NO_CHANGE`.

## 1. Product acceptance gate

Stage 12 is technically correct but is the language/foundation, not the finished product. From Stage 13 onward, each major stage must enable a new mathematical question the user can ask and answer. Do not substitute gradients, 3D, bloom, shaders, prettier particles or more unrelated animations for explanatory interaction. Do not heavily redesign the aesthetic: the black background, subtle panel, fine colored lines and cyan/pink accents suit the project; change the information hierarchy instead.

## 2. Difference lens

Add an A | Difference | B comparison or optional overlay. For stable point ID `i` on the same simulation state and time:

$$
\Delta_i=\sqrt{(x_{B,i}-x_{A,i})^2+(y_{B,i}-y_{A,i})^2}
$$

Show A→B displacement vectors and encode magnitude so invariant regions, large displacement and structural discontinuities become visible. A and B must not be independent drifting simulations.

## 3. Probe mode

Selecting a point exposes point ID, current declared scope values such as `a`, `angle`, `distance` and `weight`, Formula A coordinates, Formula B coordinates and `Δ`. Expose deterministic intermediate subexpression values such as `tan(distance)`, `exp(a)`, `angle * exp(a)`, `cos(angle * exp(a))` and `atan(a)` through the same safe canonical formula semantics.

## 4. Run, Freeze and Step

Add Run, Freeze and single fixed-step controls. Freeze holds one exact simulation state/snapshot while formulas or analysis scale change. Step advances exactly one fixed simulation step. Do not claim arbitrary historical replay until checkpoints/session state support it.

## 5. Stage 13 visible vertical slice

Rename/reframe Stage 13 as **Analysis engine and first mathematical lens**. Preserve snapshot scheduling, budgets, cancellation, sampling, stale-result rejection and analysis/derivation separation, but immediately consume them with a visible structure panel:

```text
points
edges
components β₀
mean degree
isolated points
```

Freeze the point cloud and sweep `ε`/connection radius over the same snapshot. Then visualize Rips edges and filled triangles. Keep graph cycle rank distinct from topological `β₁`; publish `β₁` only from a validated complex/homology computation. Preserve the persistent-homology backend spike and barcode/diagram validation order.

## 6. Workspace hierarchy

Evolve the Studio incrementally toward Explore, Compare and Analyze workspaces over the same engine. Primary hierarchy becomes Formula, Phenomenon and Analysis. Renderer/runtime controls, performance telemetry, import/export and Git provenance remain available under Advanced/Inspector.

## 7. Original versus controlled variants

Retain exact historical Pulse/Spiral behavior as clearly labeled Original mode. Later add a separate Controlled mode where phase `a` can be frozen or directly controlled; never relabel the controlled variant as exact 2023 behavior.

## 8. Parameterized formulas and sweeps

Later add declared numeric formula coefficients such as `k` through canonical formula scope and schema-generated controls. This is distinct from output interpolation; do not interpolate AST text. Defer automated reproducible small-multiple parameter sweeps and derived plots to the educational/product layer after analyzer contracts and provenance are validated.
