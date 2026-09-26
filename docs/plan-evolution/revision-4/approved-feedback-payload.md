# Approved Stage 13 implementation-refinement payload

Source: user review dated 2026-09-20 after accepting revision 3.

This document is the complete normative projection for revision 4. Unmentioned requirements remain `NO_CHANGE`.

## Execution slices and order

Split Stage 13 into five dependency-ordered slices:

1. **13A — Causality runtime:** Freeze, Step and correct frozen hot updates.
2. **13B — Formula lenses:** one-pass A/B/morph/displacement derivation, Difference, Probe and canonical-IR trace.
3. **13C — Snapshot analysis:** point-cloud snapshots, separate analysis scheduler/worker, structure panel and pinned analysis ε.
4. **13D — Rips topology:** budgeted simplices, graph-cycle diagnostics and validated β₁.
5. **13E — Analysis experience:** Explore/Compare/Analyze presentation ownership, persistence and local perturbation history.

Immediate implementation order is: frozen runtime semantics; explicit single-step protocol; one-pass comparison derivation and Difference; shared scope construction and Probe; canonical VM trace metadata/execution; point-cloud snapshots and separate analysis scheduler; structure panel and pinned ε; graph cycle rank; budgeted Rips triangles; validated H₁/β₁; persistence backend/barcode/diagram; then presentation-state migration into Explore/Compare/Analyze.

## 13A — Frozen-runtime semantics

Distinguish simulation evolution from presentation/derivation invalidation. While frozen, simulation state does not advance, but hot formula/morph changes apply, geometry rederives, Canvas redraws and analysis may recompute at the same simulation step. Parameters declared `reset-simulation` retain reset semantics.

Add a concrete runtime operation that applies currently due hot events and renders without calling `simulation.step(...)`. Add a versioned runtime command `step` and `ExecutionBackend.step(): Promise<void>` rather than simulating a short wall-clock resume. Single Step applies due events at step `N`, calls `simulation.step({ index: N, dtSeconds: fixedStep })` exactly once, increments the clock once and renders once. Main-thread and Worker behavior must produce equal state under the declared tolerance. User-facing controls are Run, Freeze and Step.

## 13B — One-pass formula comparison and Difference

Replace Compare mode's three redundant point derivations with one formula-comparison derivation. Each point evaluates A and B once through `evaluateFormulaTransformComparison2D()` and produces A, B, morph and displacement together. The comparison buffer contains `count: number`, stable IDs plus `ax`, `ay`, `bx`, `by`, `mx`, `my`, `dx`, `dy`, `magnitude` and `validity` typed arrays.

For each valid point:

$$
dx=x_B-x_A
$$

$$
dy=y_B-y_A
$$

$$
\Delta=\sqrt{dx^2+dy^2}
$$

Morph, Formula A, Formula B and Difference visualizations consume the same derived result. Difference supports vector and magnitude views. Robust magnitude normalization uses the 95th percentile and marks outliers separately; one `tan()` singularity must not flatten the rest of the field. If A or B is invalid, show which side failed/domain discontinuity and do not fabricate a displacement vector.

## Probe and trace

Extract one `createParametricFormulaScope(...)` owner for point ID/index, phase state, viewport and parameters; normal derivation and Probe must both call it. Probe returns stable ID, `a`, `angle`, `distance`, `positionX`, `positionY`, `weight`, A/B coordinates and Δ.

Do not build a second AST evaluator. Extend the existing stack-machine execution with an optional trace sink. Normal execution has no trace sink and near-zero trace overhead. The compiler emits a debug table containing instruction index, node ID and source start/end for selected IR sites. Debug metadata is reconstructed from formula source during compilation and is never trusted from imported serialized data.

Worker Probe uses a narrow concrete inspect request and returns one small selected-point payload. It must not stream point buffers to the main thread every frame and must not become an arbitrary RPC system.

## 13C — Two freezes, point-cloud snapshots and scheduler

Keep two distinct operations:

- **Freeze Simulation:** stops phase/particle dynamics while formula changes, morphing, Probe and rendering remain live.
- **Pin Analysis Snapshot / Analyze this frame:** freezes the derived point cloud itself so analysis ε can vary without coordinate changes.

Topology consumes a `PointCloudSnapshot`, not raw Pulse/Flying Lines simulation state. It contains snapshot ID, experiment ID, state version, simulation step, source (`morph`, `formula-a` or `formula-b`), Euclidean metric, CSS-pixel coordinate units, stable IDs, Float64 x/y arrays and formula-configuration hash. The ownership flow is simulation snapshot → geometry/point-cloud snapshot → analysis/topology.

The scheduler owns request identity, budget, cancellation, supersession, snapshot identity, deterministic sampling and provenance. Every result carries snapshot ID, analysis request ID, analyzer ID/version, parameters, duration, input/sample counts and warnings. The UI accepts only the active request. Expensive analyzers run in a separate analysis Worker or worker pool, not the simulation/rendering Worker.

For 500 points, copying a snapshot is inexpensive. Optimize snapshot transport later only after measurement.

The Structure panel displays points, edges, components β₀, mean degree, isolated points, analysis ε, Euclidean metric and snapshot step/provenance. Mean degree is `2E/N`. Sampled analysis must visibly say how many points were sampled and must not label sampled β₀ as β₀ of the full data set.

Analysis ε is separate from the experiment's running visual `connectionRadius`; changing analysis ε acts only on the pinned point cloud.

## 13D — Rips safety, graph cycles and β₁

Enumerate each triangle once by intersecting sorted adjacency sets for ordered edge `(u,v)` and taking common neighbor `w > v`; do not use a cubic triple loop. At 500 fully connected points, triangle count is exactly:

$$
{500\choose3}=20,708,500.
$$

Triangle visualization requires explicit measured budgets, reduced/LOD behavior and visible refusal/warnings. Any example thresholds such as 50k or 500k are illustrative only and must be benchmarked before freezing; topology computation and visualization need not materialize identical triangle arrays.

Expose graph cycle rank separately:

$$
\text{cycle rank}=E-V+\beta_0.
$$

For a finite simplicial complex over \(\mathbb F_2\):

$$
\beta_1=E-V+\beta_0-\operatorname{rank}\partial_2.
$$

Do not label graph cycles as β₁. Validate H₀/H₁ against an established topology library using one point, two points, triangle boundary, filled triangle, square, circle sample and figure eight before exposing β₁.

Persistence is computed once per pinned snapshot up to a chosen ε maximum. ε cursor changes filter existing intervals/complex births rather than recomputing persistent homology. Edge birth is `distance(u,v)` and triangle birth is the maximum of its three edge distances.

## 13E — Presentation ownership and history

`formulaView`, workspace, selected lens and analysis-panel state are Studio presentation state, not experiment parameters. Keep formula morph value as mathematical `ExperimentConfiguration`. Move presentation fields into `StudioConfiguration` with migration for existing URLs/configuration.

Explore/Compare/Analyze reorganizes ownership, not only CSS and not separate engines.

After Difference, Probe and Freeze work, add a short local formula-perturbation history. Each node stores formula configuration, simulation snapshot ID and metrics so the user can jump back and compare discoveries. It is not full Git history; later saved experiments/lessons may build on it.

## Controlled phase and parameterized formulas

Do not modify exact Original simulation semantics. Stage 14 Controlled mode initially defines:

$$
a_i=a_{controlled}
$$

for every point and labels the result `Controlled phase · mathematical variant`, never Pulse 2023. Uniform/gradient/original-distribution-plus-offset variants are later extensions. A possible later mode is `a_i = a_0 + k i`.

Custom formula parameters are declared symbols with stable ID, default, minimum, maximum and step; the supplied example uses named coefficients `k` and `b`. The compiler allowlist is the union of system scope and declared formula parameters. Reject collisions with functions such as `sin`, system variables such as `angle`, and duplicate parameters. Do not hardcode anonymous `p1`, `p2`, `p3`.

## Parameter sweeps and sensitivity

Stage 17 distinguishes:

- **Formula sweep on a frozen state:** same simulation step/point inputs/seed; vary a declared formula parameter and optionally plot validated β₀, β₁ or mean displacement.
- **Dynamic simulation sweep:** same initial state/seed/step count; rerun each parameter value with its different reproducibility and cost semantics.

Keep these modes separate.

Local finite-difference sensitivity is explicitly deferred beyond Stage 13:

$$
S_k(i)\approx\frac{|F(k+\delta)_i-F(k-\delta)_i|}{2\delta}.
$$

It may later reuse frozen state, declared formula parameters and the comparison buffer.

## Later-stage order

Stages 14–17 remain ordered as accepted: mathematical systems; renderer independence/WebGL2; simplest deterministic shared point interaction before collaborative formula editing; then guided educational experiences.
