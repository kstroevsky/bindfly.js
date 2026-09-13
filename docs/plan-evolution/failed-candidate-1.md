# Bindfly 2 Implementation Plan — Candidate

> Status: candidate under verification, not yet accepted/canonical. Preservation base: `docs/initial_plan.md`, SHA-256 `0815d8a1a1e895c43e9345f5f8ba291cac81fbda6791a1f230165df815c67a37`. Normative keywords such as **must**, **must not**, **required**, **exit criterion**, and ❌ define implementation constraints; code and numeric blocks explicitly labeled illustrative are not frozen defaults.

## Source request

1. Good ideas. Double-check them and even improve them.
2. Do I understand correctly that, for the implementation of these ideas, firstly we should:

- refactor the architecture (including performance problems)
- refactor and modify the rendering logic and features structure and hierarchy
- implement the features we discussed

1. Then write a well-detailed plan for all of it, so I can give this plan to Codex. The new architecture should be scalable and changeable, so we won't be constrained against implementation new future ideas.

# Plan

Yes. After double-checking both the existing code and the mathematical/computational direction, I would keep the concept—but change the implementation sequence slightly.

The biggest improvement is: **do not do a giant “refactor everything, then build features” rewrite.** Establish the new architecture, migrate one representative effect end-to-end, prove that architecture works, and then migrate the rest. Otherwise you can easily spend months designing abstractions before discovering that topology, workers, WebGL, formula evaluation, or multiplayer need a different boundary.

There is also a useful technical confirmation behind the direction. `OffscreenCanvas` and worker `requestAnimationFrame()` are now widely available, so worker-first Canvas is a sound baseline rather than an exotic optimization. ([MDN Web Docs][1]) WebGPU, however, is still not Baseline, so it should remain an optional backend rather than a foundational requirement. ([MDN Web Docs][2]) Three.js's `WebGPURenderer` can fall back to WebGL2, but Three still calls it experimental. ([Three.js][3])

And the topology concept is mathematically legitimate: your proximity-line system is essentially the 1-skeleton from which a Vietoris–Rips complex is constructed. But full Rips complexes can grow extremely quickly, so topology needs its own computational-budget architecture rather than being recomputed naïvely every animation frame. GUDHI explicitly recommends sparse approximations and edge-collapse strategies for larger inputs. ([GUDHI library][4])

# 1. The corrected implementation sequence

Your proposed sequence:

> architecture refactor → rendering/features refactor → new features

is directionally right.

I would make it:

**0. Characterize and freeze the old project**

↓
**1. Define the new domain model and architectural boundaries**

↓
**2. Implement one complete vertical slice (`FlyingLines`)**

↓
**3. Build the new performance/runtime infrastructure**

↓
**4. Migrate the useful old effects into the new model**

↓
**5. Turn Bindfly from an animation gallery into a mathematical laboratory**

↓
**6. Add dynamical-systems analysis**

↓
**7. Add computational topology**

↓
**8. Add multiplayer/shared experiments**

↓
**9. Add advanced GPU computation and research backends**

That ordering gives every architectural abstraction a concrete reason to exist.

---

# 2. Product definition

I would now define Bindfly roughly as:

> **Bindfly is an interactive laboratory for exploring how simple mathematical rules generate complex geometry, dynamics and topology, with interchangeable simulation, analysis and rendering backends.**

There are four conceptual layers:

```text
RULES
formulas / parameters / initial conditions
          ↓

SIMULATION
particles / vector fields / maps / scalar fields
          ↓

ANALYSIS
geometry / graphs / dynamics / topology
          ↓

REPRESENTATION
Canvas2D / WebGL / WebGPU / plots / diagrams
```

And then a fifth cross-cutting layer:

```text
INTERACTION
click / drag / perturb / parameter morph / multiplayer
```

This distinction is extremely important.

**Rendering is not simulation.
Simulation is not mathematical analysis.
Analysis is not UI.
Multiplayer is not simulation.**

Your old project mixes several of these responsibilities. For example, `FlyingLines` contains particle updates, neighbor detection, Canvas rendering and its animation loop in one class.

Bindfly 2 should separate them.

---

# 3. Architectural principles for Codex

I would give Codex these as non-negotiable rules.

### A. Prefer domain abstractions over TypeScript tricks

The old project has clever types such as `TAsyncImportedClass`, `TConstructorOf`, `TClassesNamespace`, etc., while the actual animation implementations remain unchecked JS.

The new rule:

> Types should describe real runtime concepts and make invalid states impossible. Do not introduce generic machinery solely to infer something that can be stated explicitly.

### B. Engine code must not depend on React

React owns:

- panels;
- forms;
- lesson UI;
- routing;
- inspectors;
- accessibility;
- overlays.

React must **not** own:

- simulation clocks;
- particle arrays;
- rendering loops;
- persistent-homology computation;
- WebGL scenes;
- worker state.

### C. No renderer owns the simulation

The clock drives simulation.

Simulation creates state.

Renderer reads state.

```text
Clock
  ↓
Simulation.step()
  ↓
State
 ├────────→ Renderer.render()
 └────────→ Analyzer.analyze()
```

### D. All randomness must be deterministic when desired

Every experiment should support:

```ts
seed: string | number
```

Never scatter uncontrolled `Math.random()` through the engine as the old implementation does.

This is essential for:

- reproducible scientific experiments;
- benchmark comparisons;
- test fixtures;
- saved URLs;
- multiplayer;
- comparing formulas.

### E. Rendering backends are adapters

Canvas2D, WebGL2 and WebGPU are **implementations**, not domain concepts.

### F. Mathematical analyzers are plugins

Persistent homology should not infect the basic particle engine.

Neither should Lyapunov analysis, graph statistics, or bifurcation detection.

---

# 4. Proposed repository structure

Use a pnpm workspace as the migration envelope, but deliberately avoid turning every directory into an npm package. Begin with enforceable logical modules and extract a physical package only after there are at least two real consumers, a worker/build boundary, or a separately testable/deployable artifact. This keeps the dependency direction below without recreating the old project's abstraction-first failure.

Start with meaningful runtime/dependency boundaries:

```text
bindfly/
├─ apps/
│  └─ studio/
│
├─ packages/
│  ├─ core/
│  │  ├─ simulation/
│  │  ├─ clock/
│  │  ├─ random/
│  │  ├─ spatial/
│  │  ├─ experiment/
│  │  └─ state/
│  │
│  ├─ formula/
│  │  ├─ parser/
│  │  ├─ ast/
│  │  ├─ validation/
│  │  ├─ interpreter/
│  │  └─ compiler/
│  │
│  ├─ effects/
│  │  ├─ flying-lines/
│  │  ├─ pulse/
│  │  ├─ spiral/
│  │  └─ classics/
│  │
│  ├─ rendering/
│  │  ├─ canvas2d/
│  │  ├─ webgl/
│  │  └─ webgpu/
│  │
│  ├─ runtime/
│  │  ├─ main-thread/
│  │  ├─ worker/
│  │  └─ protocol/
│  │
│  ├─ analysis/
│  │  ├─ graph/
│  │  ├─ dynamics/
│  │  ├─ topology/
│  │  └─ statistics/
│  │
│  ├─ collaboration/
│  │
│  └─ benchmarks/
│
├─ tooling/
└─ docs/
```

I would **not** create packages such as `utils`, `helpers`, `shared`, `types`.

Those names tend to become architectural garbage drawers.

A type belongs beside the domain concept that owns it.

During migration, retain the legacy application as a separately addressable route/build target. The new modules must not import legacy React hooks, `CanvasAnimation`, `IProperty`, the legacy animation loader namespace, or the legacy worker protocol. Enforce that rule with lint/import-boundary tests before moving code.

---

# 5. The central domain object: Experiment

The central abstraction should no longer be `CanvasAnimation`.

It should be something closer to:

```ts
interface ExperimentDefinition<
  Params,
  State,
  Input,
  SerializedState
> {
  id: string
  stateVersion: number

  parameters: ParameterSchema<Params>

  stateCodec: ExperimentStateCodec<SerializedState>

  createSimulation(
    environment: SimulationEnvironment,
    params: Params
  ): Simulation<State, Input>

  capabilities: ExperimentCapabilities<State>

  analyzers?: AnalysisDefinition<State>[]

  presets?: ExperimentPreset<Params>[]
}
```

And:

```ts
interface Simulation<State, Input> {
  readonly state: State

  step(frame: SimulationStep): void

  applyInput(input: Input): void

  reset(): void

  dispose(): void
}
```

That creates a clean answer to:

> What is Flying Lines?

It is **not a React page**.

It is not a Canvas class.

It is an experiment definition.

`id` is a stable domain identifier, not a JavaScript function/class name. `stateVersion` versions serialized experiment state, while application/build versions remain separate metadata. A registry maps explicit IDs to lazy module loaders, routes, codecs, capabilities and display metadata; adding an experiment must not require editing router branches or worker switch statements.

---

# 6. The state model

For particle-heavy simulations, move away from:

```ts
[
  {
    x,
    y,
    velocityX,
    velocityY,
    life,
    ...
  },
  ...
]
```

toward a structure-of-arrays representation:

```ts
interface ParticleBuffer {
  count: number
  capacity: number

  id: Uint32Array
  x: Float32Array
  y: Float32Array

  vx: Float32Array
  vy: Float32Array

  life: Float32Array
  flags: Uint8Array
}
```

That provides:

- less object allocation;
- much better memory locality;
- easier transfer to Web Workers;
- easier upload to GPU buffers;
- easier future WASM integration;
- deterministic iteration;
- easier SIMD/GPU migration.

Object-based simulations can still exist where appropriate.

Do **not** require every simulation to use particles.

Do not freeze `Float32Array` as the scientific precision contract merely because it is convenient for GPUs. Each experiment must declare its numeric precision and tolerance policy. Stable entity IDs, deterministic iteration order, buffer growth/removal behavior and snapshot encoding are part of the state contract; array position must not silently become entity identity.

---

# 7. Clock architecture

This deserves its own subsystem.

The old code uses animation frames as implicit simulation time. That means a 120 Hz display changes dynamics relative to 60 Hz. Worker rAF documentation explicitly warns against this and recommends using the provided timestamp/delta. ([MDN Web Docs][5])

I would go further and use a fixed simulation timestep.

Something like:

```text
render frames:
     ↓
accumulator
     ↓
fixed simulation steps
     ↓
render interpolated/current state
```

For illustration only:

```ts
simulationDt = experiment.timing.fixedStepSeconds
```

with:

- accumulator;
- maximum catch-up steps;
- pause/resume;
- simulation speed;
- deterministic step index.

This makes:

```text
30 Hz
60 Hz
120 Hz
144 Hz
```

produce the same mathematical simulation.

It also makes multiplayer much easier.

Phase 4 must benchmark and then freeze the default step per experiment/state version; `1 / 120` is not a universal approved default. Parameter and input changes are applied at named simulation-step boundaries. Catch-up work is capped, overload is reported, and the runtime chooses an explicit slow-down/drop-render policy rather than silently dropping simulation steps.

Determinism has tiers: CPU replay for the same engine/build must be reproducible; main-thread and worker CPU results must agree within the experiment's declared tolerance; cross-browser transcendental math and GPU execution are not assumed bitwise-identical. Saved states and collaboration therefore include versioned snapshots and canonical checksums in addition to seeds and event logs.

---

# 8. Formula engine: probably the most important new subsystem

Do **not** implement arbitrary formulas through `eval()`.

Bindfly should have a real mathematical expression representation.

Pipeline:

```text
Formula text
   ↓
Parser
   ↓
AST
   ↓
Semantic validation
   ↓
Canonical IR
   ↓
Execution backend
```

Initially:

```text
AST → JS evaluator
```

Eventually:

```text
            ┌→ JavaScript
AST / IR ───┼→ WASM
            ├→ WGSL
            └→ Three.js TSL
```

That is why the AST—not JavaScript source—is the canonical representation.

Do not commit to a hand-written parser before an ADR spike compares maintained parsers and licenses against the required grammar. Whichever parser is selected, Bindfly owns a small allowlisted AST/IR: no property access, dynamic names, loops, assignment, imports, user-defined calls, or ambient globals. Enforce source-length, token, AST-node, depth and operation budgets; execute formulas in a worker; reject non-finite outputs and domain errors with source locations; and remain compatible with a strict Content Security Policy without `eval()` or `new Function()`.

Each formula declares family, input/output dimension, allowed variables, parameter schema, numeric precision and failure policy. The canonical serialized AST is versioned and migrated just like experiment state. Parsing, validation, interpretation and future compilation must share conformance fixtures so a WGSL/WASM backend cannot silently change formula semantics.

---

# 9. Formula families

This is an improvement over my previous proposal.

Treat formula semantics explicitly.

## `VectorField`

```text
(state[dimension], t, params)
              ↓
derivative[dimension]
```

Useful for:

- ODEs;
- phase portraits;
- attractors;
- flow fields;
- trajectories.

---

## `DiscreteMap`

```text
(stateₙ[dimension], params)
              ↓
stateₙ₊₁[dimension]
```

Useful for:

- strange attractors;
- Hénon map;
- logistic-like systems;
- iterative generative structures.

---

## `Transform`

```text
(point[inputDimension], params)
              ↓
point[outputDimension]
```

Useful for:

- geometric deformation;
- topology intuition;
- coordinate transforms.

---

## `ScalarField`

```text
(x, y)
  ↓
z
```

Useful for:

- contours;
- level sets;
- potential fields;
- height maps;
- later cubical topology.

---

## `Metric` and `Relationship`

```text
(pointA, pointB)
       ↓
distance
```

This one is particularly interesting for topology.

The exact same points could be analyzed using:

```text
Euclidean
Manhattan
Chebyshev
weighted
anisotropic
custom metric
```

and the resulting proximity complex changes.

That can teach the idea of metric spaces beautifully.

Do not call every custom distance-like formula a metric. A `Metric` must be finite and declare or validate the properties required by its consumers; an arbitrary `Relationship` may be asymmetric or non-metric and cannot be fed to Rips topology. Neighbor search is capability-based: Euclidean, Manhattan and Chebyshev implementations may provide bounded spatial indexes, while an arbitrary valid metric uses a proven index adapter or the brute-force oracle. The uniform grid is never selected merely because the formula returns a number.

---

## Eventually: `InteractionLaw`

```text
particle A
particle B
environment
     ↓
force / influence
```

That lets users build flocking, attraction/repulsion, gravity-like systems, cellular interactions, etc.

---

# 10. Parameter system

Your old `properties.json` and `CanvasHandlersConfig` already hint at this architecture.

Replace both with one parameter schema.

For example:

```ts
parameters: {
  particleCount: number({
    default: 500,
    min: 1,
    max: 100_000,
    step: 1
  }),

  connectionRadius: number({
    default: 100,
    min: 0,
    max: 1000
  }),

  background: color({
    default: "#000000"
  }),

  clickable: boolean({
    default: true
  })
}
```

From this one declaration derive:

- TS parameter type;
- UI;
- defaults;
- runtime validation;
- URL encoding;
- serialization;
- presets;
- worker messages;
- multiplayer state;
- documentation.

No duplicated visibility matrices.

Each parameter also declares a stable ID, units, serialization behavior, runtime mutability, and invalidation mode (`hot-update`, `reset-simulation`, or `rebuild-runtime`). Validation and normalization run at every boundary—URL/import, preset, UI, worker and collaboration—not only in React. Formula-morph parameters additionally declare interpolation rules; booleans, enums and singular numeric domains must not be blindly interpolated.

---

# 11. Rendering architecture

Start with three explicit levels.

## Renderer 1 — Canvas2D

This is your correctness baseline.

It should remain because Canvas2D is often simpler than WebGL for dense flat immediate-mode workloads, and workers/OffscreenCanvas are now a practical option. ([MDN Web Docs][6])

Contract:

```ts
interface Renderer<State> {
  resize(viewport: Viewport): void

  render(
    state: Readonly<State>,
    frame: RenderFrame
  ): void

  dispose(): void
}
```

Use:

- explicit DPR handling;
- explicit world → screen transform;
- no global `window.onresize`;
- `ResizeObserver`;
- `PointerEvent`;
- main-thread HTML/SVG overlays for labels and accessible controls.

---

# 12. Canvas performance refactor

For `FlyingLines`, the old bottleneck is essentially:

$$
O(n^2)
$$

distance comparisons per frame.

Implement a uniform spatial hash.

```text
world
┌───┬───┬───┬───┐
│ • │   │•• │   │
├───┼───┼───┼───┤
│   │ • │ • │ • │
├───┼───┼───┼───┤
...
```

For each point, compare only against its own and neighboring cells.

Also:

- compare each pair once;
- use squared distances for rejection;
- avoid `.toFixed()` in hot loops;
- avoid allocating arrays/objects every frame;
- precompute invariants;
- batch draw operations where possible;
- cull invisible geometry.

This is a much more valuable optimization than the old micro-optimizations.

---

# 13. Worker architecture

Workers should become first-class execution runtimes.

Not:

```text
try worker
catch anything
silently fall back
```

as the current `useCanvas` effectively does.

Instead:

```ts
interface ExecutionBackend {
  initialize(...)
  start()
  pause()
  applyInput(...)
  updateParameters(...)
  dispose()
}
```

Implement:

```text
MainThreadBackend
WorkerBackend
```

The same simulation contract runs under either.

---

# 14. Worker protocol

Replace the current giant `ICanvasWorkerProps` interface.

Use a discriminated union:

```ts
type RuntimeCommand =
  | {
      type: "initialize"
      experiment: SerializedExperiment
    }
  | {
      type: "resize"
      viewport: Viewport
    }
  | {
      type: "input"
      input: ExperimentInput
    }
  | {
      type: "parameters"
      patch: ParameterPatch
    }
  | {
      type: "pause"
    }
  | {
      type: "resume"
    }
  | {
      type: "dispose"
    }
```

Never send fake `UIEvent` objects across the worker boundary.

Send domain data.

The protocol is bidirectional and versioned. Commands carry a request ID and protocol version; events include `ready`, acknowledgements where ordering matters, telemetry, analysis results, structured errors and disposal completion. Initialization is a handshake, not an optimistic post. Parameter bursts and analysis requests are coalesced or backpressured, and stale results carry the source step/snapshot ID so the studio can reject them.

After `transferControlToOffscreen()`, failure cannot safely fall back on the same HTML canvas. Capability probing happens before transfer; a failure after transfer disposes the worker and remounts a new canvas before selecting the main-thread runtime. Silent catch-all fallback is forbidden.

---

# 15. Avoid excessive state transfer

The best Canvas-worker architecture is:

```text
Worker
 ├─ Simulation
 ├─ Spatial index
 └─ OffscreenCanvas renderer
```

The main thread receives only:

```text
analysis results
performance telemetry
selection information
errors
```

Not 100,000 particle coordinates every frame.

That eliminates an enormous serialization/transfer cost.

---

# 16. Renderer 2 — WebGL2

Then implement a GPU renderer.

Initially I would keep WebGL2 stable and relatively conventional.

Use:

- GPU buffers;
- instancing;
- compact particle attributes;
- batched connections;
- minimal scene/object allocation.

Three.js is fine where it provides genuine value.

But don't make every 2D particle line a `THREE.Object3D`.

---

# 17. Renderer 3 — WebGPU

Make this explicitly experimental.

```ts
capabilities.webgpu === true
```

Then show:

```text
Canvas2D
WebGL2
WebGPU (experimental)
```

WebGPU gives you an eventual opportunity to move not only rendering but **simulation** onto compute shaders. It supports general-purpose GPU computation, which WebGL wasn't designed around. ([MDN Web Docs][2])

Later:

```text
CPU simulation
      ↓
GPU rendering
```

can become:

```text
GPU simulation
      ↓
GPU rendering
```

for 100k–1m particles.

But don't design v1 around it.

---

# 18. Analysis architecture

This is the other major new subsystem.

```ts
interface Analyzer<State, Result> {
  id: string

  analyze(
    snapshot: Readonly<AnalysisSnapshot<State>>,
    context: AnalysisContext,
    signal: AbortSignal
  ): Promise<Result> | Result
}
```

Examples:

```text
GraphAnalyzer
TopologyAnalyzer
StabilityAnalyzer
LyapunovAnalyzer
DensityAnalyzer
TrajectoryAnalyzer
```

Analysis should be schedulable independently of animation.

For example:

```text
render:    60 Hz
simulate: 120 Hz
graph:     10 Hz
topology:   1 Hz
```

or topology only when manually requested.

This is essential.

Analyzers never read mutable live simulation state. Every result records experiment/state version, snapshot ID, simulation step/time, metric/formula version, input and sampled counts, sampling method/seed, backend/version, approximation settings, duration and warnings. The scheduler enforces one active request per analyzer unless the analyzer explicitly supports concurrency, cancels obsolete work and discards stale results.

---

# 19. Introduce explicit computational budgets

Every analyzer should have something like:

```ts
analysisBudget: {
  maxPoints: 5000,
  maxDurationMs: 50,
  updateRateHz: 2,
  sampling: "adaptive"
}
```

The numbers above are illustrative schema examples, not universal limits. Each analyzer freezes measured defaults after its benchmark/validation spike and reports when it sampled, approximated, timed out or refused the request. Exceeding a budget produces a visible partial/unavailable result; it never freezes the renderer or silently changes the scientific question.

The studio should even expose this concept eventually.

That's useful scientifically:

> Full topology analysis currently uses a 2,000-point sample.

rather than secretly freezing the browser.

---

# 20. First mathematical vertical slice: Flying Lines

This should be the **first target** for Codex.

Not Pulse.

Not WebGPU.

Flying Lines already naturally spans almost everything we want.

Implement:

```text
FlyingLinesExperiment
        ↓
ParticleSimulation
        ↓
SpatialHash
        ↓
Canvas2DRenderer
        ↓
WorkerRuntime
        ↓
ParameterSchema
        ↓
GraphAnalyzer
```

Interactions:

```text
click → add point
click+modifier → remove nearest
drag → move point
```

Analysis:

```text
nodes
edges
degree distribution
connected components
```

Then add:

```text
ε = connectionRadius
```

At this point you already have the mathematical bridge to topology.

---

# 21. Topology v0: don't start with persistent homology

Start with something much cheaper.

### Connected components

At any given ε:

$$
\beta_0
$$

can be calculated efficiently from the proximity graph using Union-Find.

Show:

```text
ε = 43.2

components β₀ = 7
edges         = 823
```

That alone already teaches topology-related intuition.

---

# 22. Topology v1: Vietoris–Rips visualization

The existing connection graph becomes the 1-skeleton.

Then identify cliques:

```text
3 mutually connected points
           ↓
triangle / 2-simplex
```

Visualize triangles optionally.

The relationship is mathematically legitimate: GUDHI describes Rips complexes as clique complexes built from a proximity graph. ([GUDHI library][4])

Now the user can visually understand why a graphical “hole” disappears after triangles fill it.

Keep two quantities distinct: the undirected graph's cycle rank can be computed as `edges - vertices + components`, but that is not \(\beta_1\) of the filled Rips complex once triangles or higher simplices exist. Label graph-cycle diagnostics as such; publish \(\beta_1\) only from a validated complex/homology computation. Interpret `connectionRadius` as \(\varepsilon\) only when rendering and analysis use the same frozen point snapshot, coordinate units and valid metric.

---

# 23. Topology v2: persistence

Do **not** implement the persistence algorithm yourself initially.

Create:

```ts
interface PersistentHomologyBackend {
  compute(
    points: PointCloud,
    options: PersistenceOptions
  ): Promise<PersistenceResult>
}
```

Then run a backend spike and use a pinned, reproducible WASM backend if it passes the gate.

The official Ripser project is especially interesting because it documents an Emscripten/WebAssembly browser demo. That proves feasibility, but the latest published Ripser release is old enough that Bindfly must not assume a maintained JavaScript package exists. The spike must pin source commit, compiler flags, license, wrapper protocol and golden outputs, and compare them against GUDHI fixtures. ([GitHub][7])

I would therefore use something like:

```text
RipserWasmAdapter
```

without letting the rest of Bindfly know anything about Ripser.

Potential future alternatives:

```text
GudhiServerAdapter
RustTdaWasmAdapter
CustomGpuTopologyAdapter
```

The abstraction matters more than which one wins today.

The adapter input/output contract includes point cloud or distance matrix, declared metric, maximum homology dimension, maximum filtration value, coefficient field, sampling/approximation metadata, intervals including infinite deaths, cancellation and structured resource-limit failures. Start with exact \(H_0\) and \(H_1\); keep \(H_2\) explicitly deferred until complexity and validation evidence justify it.

---

# 24. Topology UI

At minimum:

```text
main simulation

        +      

Betti numbers

β₀ = 2
β₁ = 1
β₂ = unavailable (H₂ deferred)

        +

persistence diagram

        +

barcode
```

Dragging ε should simultaneously update:

- proximity graph;
- filled simplices;
- Betti numbers;
- persistence cursor.

That will make persistent homology dramatically more intuitive.

Dragging ε moves a cursor through persistence intervals and filters the already computed filtration result for the same snapshot; it must not rerun persistent homology for every pointer movement. Recompute only when the point cloud, metric, filtration bound, coefficient field, approximation or relevant analyzer version changes.

---

# 25. Dynamical systems module

Once the foundational engine works, add a new experiment class:

```text
VectorFieldExperiment
```

The user enters:

$$
\dot x = f(x,y)
$$

$$
\dot y = g(x,y)
$$

Render:

- vector field arrows;
- particles;
- trajectories;
- streamlines.

Interaction:

```text
click → new trajectory
drag → initial condition
```

---

# 26. Numerical integration

Start with:

```text
Euler
RK4
```

Expose the integrator as an experiment option.

That itself becomes educational:

> Why does Euler become unstable here while RK4 does not?

Eventually:

- adaptive RK;
- symplectic methods;
- stiff solvers.

But don't implement those initially.

Integration applies only to continuous vector fields; discrete maps advance exactly once per discrete step. Every solver declares step size/tolerance semantics and behavior for singular, non-finite or escaped states. A formula sample that produces `NaN`, infinity, division by zero or a domain error is quarantined and surfaced with provenance rather than poisoning the entire particle buffer. Reference systems have convergence tests against known trajectories/invariants within declared tolerances.

---

# 27. Formula morphing

This deserves a first-class UX mode.

Given:

$$
f(x,y,a,b,c)
$$

generate sliders for:

```text
a
b
c
```

Then let the user continuously morph the system.

Add:

```text
A/B comparison

a = 1.0000
a = 1.0001
```

Display two simulations side-by-side.

This gives Bindfly one of its best educational mechanisms:

> Tiny formula difference → enormous qualitative effect.

---

# 28. Parameter sweeps

Later automate that.

For example:

```text
a = 0.0   [preview]
a = 0.1   [preview]
a = 0.2   [preview]
...
a = 2.0   [preview]
```

Or plot derived values:

```text
parameter a
   ↓
Lyapunov exponent
Betti number
attractor count
mean density
```

Now Bindfly becomes a genuine exploratory system rather than a manual toy.

---

# 29. Dynamical-analysis plugins

Add gradually:

### Equilibrium finder

Solve:

$$
f(x,y)=0
$$

### Stability

Approximate the Jacobian and eigenvalues.

### Lyapunov exponent

Useful for chaos.

### Poincaré section

Useful for periodic systems.

### Basin visualization

Color initial conditions by eventual attractor.

### Bifurcation explorer

Sweep a parameter and detect/visualize qualitative changes.

These should all be analyzers rather than baked into simulation classes.

---

# 30. Scalar-field experiments

Implement:

```text
f(x,y) → z
```

Visual representations:

- heatmap;
- contours;
- level sets;
- 3D surface eventually.

Use marching squares for:

$$
f(x,y)=c
$$

Then let the user change \(c\).

That becomes another route into topology:

> watch components merge and holes appear/disappear as the level threshold changes.

Later, this can grow into cubical-complex persistence.

---

# 31. Preserve the weird old formulas

Don't “correct” Pulse/Spiral into textbook systems.

Migrate them into:

```text
Original Experiments
```

For example:

```text
Bindfly Originals
├─ Pulse 2023
├─ Spiral I
├─ Spiral II
├─ Spiral III
└─ Flying Lines
```

Then try to describe them through the new analysis tools.

That preserves the project's identity.

---

# 32. Multiplayer architecture

Only after deterministic simulation works.

Your old idea becomes:

```text
Shared experiment
```

Users don't stream frames.

They stream **events**:

```ts
type CollaborativeEvent =
  | AddPointEvent
  | RemovePointEvent
  | MovePointEvent
  | ParameterChangeEvent
  | FormulaChangeEvent
```

Example:

```ts
{
  sequence: 1723,
  actorId: "...",
  type: "addPoint",
  step: 81238,
  point: [0.23, 0.84]
}
```

Clients replay events.

---

# 33. Don't rely on perfect lockstep forever

CPU JS fixed-step simulations should be highly reproducible, but eventually GPU backends and hardware differences can undermine exact deterministic agreement.

So design from the start for:

```text
event sequence
+
periodic authoritative state/hash
+
resynchronization
```

rather than assuming mathematical perfection.

---

# 34. Multiplayer can become mathematical gameplay

Later modes could include:

```text
Create exactly β₁ = 3
```

or:

```text
Connect the system using ≤ 5 points
```

or:

```text
Destroy the persistent loop
```

or:

```text
Each player controls one parameter
```

That last one could be genuinely interesting:

```text
Player A → α
Player B → β
Player C → γ
```

and they collectively steer a chaotic system.

---

# 35. Studio architecture

The React app should look conceptually like:

```text
┌────────────────────────────────────────────┐
│ experiment / formula / preset              │
├─────────────┬──────────────────┬───────────┤
│             │                  │           │
│ parameters  │   visualization  │ analysis  │
│             │                  │           │
│             │                  │           │
├─────────────┴──────────────────┴───────────┤
│ timeline / metrics / performance           │
└────────────────────────────────────────────┘
```

Panels are modular.

A future feature should be able to register an inspector without changing the entire application.

---

# 36. Separate durable and ephemeral state

Durable experiment state:

```text
experiment id
experiment version
formula
parameters
seed
initial conditions
active analyzers
renderer choice
camera/view
```

Ephemeral state:

```text
hover
pointer coordinates
drag state
worker ready state
current FPS
temporary modal
current frame
```

Never serialize ephemeral state.

---

# 37. Versioned URLs

Keep your old shareable-query idea, but formalize it.

Something like:

```text
/lab/flying-lines?v=2&state=...
```

With:

```ts
interface ExperimentStateCodec {
  parse()
  normalize()
  migrate()
  serialize()
}
```

A saved experiment from 2027 should ideally still work after parameter schemas evolve.

This is worth designing early.

The codec must reject malformed or unknown-version state safely, preserve unknown fields only when an explicit forward-compatibility rule allows it, and test every migration from supported historical versions. Keep route identity and serialized payload separate. If encoded state exceeds the agreed URL budget, offer deterministic JSON export/import rather than generating an unreliable link; formulas and collaboration credentials must never be embedded as executable code or secrets.

---

# 38. Performance telemetry

Since “laboratory” includes computational experimentation, expose the system itself.

Collect:

```text
FPS
frame time
simulation time
render time
analysis time
particle count
edge count
memory estimates
backend
DPR
```

Then users can compare:

```text
Canvas2D main thread
Canvas2D worker
WebGL
WebGPU
```

for exactly the same experiment.

So the old performance-laboratory idea remains—just as a **secondary axis** of the mathematical laboratory.

---

# 39. Benchmark harness

Create deterministic benchmark scenarios.

Example:

```text
FlyingLines / Seed 42

100 points
1,000 points
10,000 points
50,000 points

connection radius:
20
100
300
```

For each backend capture:

```text
median simulation ms
p95 simulation ms
median render ms
p95 render ms
FPS
```

Never claim one implementation is faster based on visual impression.

Benchmark runs pin build commit, browser/version, OS, hardware, power mode, viewport, DPR, seed, state version, timestep, warm-up, sample count and workload definition. Compare equal simulation snapshots and rendered content, separate simulation/render/analysis/transport time, report distributions and uncertainty, and store raw samples. Establish regression thresholds from repeated baseline evidence; do not invent universal performance gates. FPS is a diagnostic, not the primary result.

---

# 40. Testing architecture

The simulation/renderer separation will make testing dramatically easier.

### Unit tests

Test:

- RNG;
- formula parser;
- formula AST;
- numerical integration;
- spatial hash;
- coordinate transforms;
- parameter codecs;
- Union-Find;
- graph construction;
- serialization;
- worker protocol.

### Mathematical property tests

Examples:

```text
same seed → identical initial state

no velocity → positions remain constant

spatial hash neighbors ==
brute-force neighbors

increasing ε cannot increase β₀

distance(A,B) == distance(B,A)
for valid symmetric metrics
```

These are much more valuable than ordinary snapshots.

### Contract and integration tests

Add tests for:

- experiment registry and capability negotiation;
- main-thread/worker lifecycle state transitions and command/event schemas;
- main-thread versus worker replay parity within declared tolerances;
- OffscreenCanvas capability failure, initialization failure, remount fallback and disposal;
- parameter invalidation modes and URL/preset/worker normalization equivalence;
- analyzer cancellation, stale-result rejection, provenance and budget failures;
- renderer context loss/restoration and resource disposal;
- legacy URL/state migration;
- keyboard/pointer equivalence and accessible labels for generated controls.

Run browser integration smoke tests in Chromium, Firefox and WebKit for the supported capability matrix. Unsupported backends must be visibly unavailable with a reason, not represented as a test failure or silently selected fallback.

---

# 41. Analysis validation tests

For topology, maintain tiny known point clouds:

```text
single point

two separated points

triangle

circle

two circles

figure eight
```

Compare persistence outputs to expected results.

For advanced validation, compare your WASM backend against established reference implementations.

GUDHI is particularly useful as a reference implementation even if it isn't your browser runtime. ([GUDHI library][8])

Fixtures freeze metric, coefficient field, filtration convention, maximum dimension and numeric tolerance. Validate graph cycle rank separately from simplicial-complex Betti numbers. For approximate or sampled analysis, test deterministic sampling and declared error/approximation metadata instead of pretending the result is exact.

---

# 42. Visual tests

Use deterministic:

- seed;
- DPR;
- viewport;
- frame/step;
- parameters.

Then screenshot:

```text
first frame
known simulation step
paused analysis state
```

For Canvas/WebGL, deterministic rendering plus targeted image baselines is much better than DOM snapshots.

---

# 43. Tooling migration

I would remove the old CRA + custom Webpack split.

The current project carries both `react-scripts` and a hand-written Webpack setup.

Use:

```text
pnpm workspaces
Vite
TypeScript
Vitest
Playwright
ESLint
```

and browser workers as ESM workers.

The production build is not a correctness gate unless it also runs `tsc --noEmit` (or project-reference type checks), lint and tests. The current Babel/Webpack build succeeds while the repository has TypeScript errors, lint failures and no tests, so the new tree gets independent green gates from its first commit; legacy failures are recorded and quarantined rather than hidden.

Also eventually:

```json
"allowJs": false
```

for the actual engine.

---

# 44. TypeScript compiler policy

Turn on:

```text
strict
noUncheckedIndexedAccess
exactOptionalPropertyTypes
noImplicitOverride
```

where practical.

But do not spend days satisfying maximal TS flags before the architectural migration works.

The important distinction is:

> Type the simulation core first.

not:

> invent more utility types.

Add strict flags incrementally per new project/module and prevent regression. Do not globally flip flags over unchecked legacy JavaScript before the vertical slice is isolated. New engine/runtime/analysis/formula code is TypeScript with checking enabled; `allowJs` remains only in the explicitly marked legacy/archive boundary until migration completes.

---

# 45. Migration phases for Codex

Here is the actual order I would give Codex.

## Phase 0 — Baseline old Bindfly

Do not modify algorithms yet.

Tasks:

- make the current branch run reproducibly;
- record that the current Webpack/Babel production build passes while standalone TypeScript and lint fail and no tests are discovered;
- record working/broken routes;
- record representative screenshots;
- document each animation;
- measure current FPS for several particle counts;
- list known lifecycle bugs;
- create a `docs/legacy-architecture.md`.
- freeze the source commit, all presets, original formulas/constants and representative output assets in a legacy manifest;
- classify every route/effect as `parity`, `intentional-fix`, `archive-only`, or `drop-with-rationale`;
- record legacy URL patterns and a migration fixture for each supported preset.

**Exit criterion:** the legacy manifest, behavior matrix, evidence assets and current quality-gate results are committed and reviewable; we know exactly what is being preserved, intentionally fixed, archived or dropped.

---

## Phase 1 — Scaffold Bindfly 2

Create workspace structure.

Use a strangler layout: legacy remains runnable while the new studio and engine grow beside it. Create logical boundaries first; do not create all physical packages until the two-consumer/build-boundary rule in section 4 is satisfied.

Introduce:

```text
core
formula
effects
rendering
runtime
analysis
studio
benchmarks
```

Set architectural dependency rules.

For example:

```text
core ← effects
core ← analysis
core ← rendering

studio → everything

core → React     ❌
analysis → React ❌
effects → React  ❌
new code → legacy hooks/types ❌
```

**Exit criterion:** new empty architecture type-checks, lints and tests independently of legacy code; import-boundary tests fail on every forbidden edge; legacy still builds at its recorded baseline.

---

## Phase 2 — Core contracts

Implement:

- experiment definition;
- simulation;
- clock;
- seeded RNG;
- viewport;
- input events;
- parameter schema;
- renderer;
- analyzer;
- runtime interfaces.
- explicit experiment registry and capability negotiation;
- state codec/version migration contracts;
- lifecycle/error states and bidirectional worker protocol envelopes;
- immutable analysis snapshot/provenance contracts.

No actual sophisticated animation yet.

**Exit criterion:** contracts have unit and compile-time tests, no dependency on React/Canvas/legacy code, and at least one fake implementation proves lifecycle, serialization and cancellation semantics.

---

## Phase 3 — Flying Lines vertical slice

Reimplement Flying Lines under the new contracts.

Start deliberately naïve.

Use brute-force neighbors initially.

Implement:

```text
new simulation
new Canvas renderer
new parameters
new studio route
new pointer input
minimal GraphAnalyzer: nodes, unique edges, connected components
```

Compare it visually against legacy Flying Lines.

Use the Phase 0 classification to distinguish intended behavior from known bugs. Preserve the legacy preset/visual identity where classified as parity, but do not reproduce incorrect cancellation, duplicate pair drawing, frame-rate-dependent movement, same-axis velocity coupling, stringified distances or boundary-condition defects. Record every intentional divergence.

**Exit criterion:** one complete effect runs entirely through Bindfly 2, its approved parity/divergence evidence is reviewed, and no legacy runtime abstraction is imported.

---

## Phase 4 — Correct timing/lifecycle

Introduce:

- fixed timestep;
- pause/resume;
- correct rAF IDs;
- disposal;
- resize lifecycle;
- deterministic reset.

Remove simulation-loop ownership from effects.

**Exit criterion:** changing display refresh rate doesn't materially alter the simulation.

Also prove pause/resume does not create a time jump, catch-up saturation is observable, inputs/parameter patches land on recorded steps, and same-build replays match the declared deterministic tier. Freeze the selected timestep and tolerance in the experiment state version only after this evidence exists.

---

## Phase 5 — Performance data model

Convert Flying Lines to:

- typed arrays;
- seeded RNG;
- reusable buffers;
- no per-frame allocations.

Benchmark.

**Exit criterion:** same behavior, measured improvement/no regression.

---

## Phase 6 — Spatial indexing

Implement uniform-grid spatial hashing.

Maintain brute-force implementation as oracle.

Tests must compare:

```text
gridNeighborSearch
vs
bruteForceNeighborSearch
```

across random seeded point clouds.

Limit the first grid implementation to declared Euclidean 2D semantics. Add separate capability tests before using it for Manhattan/Chebyshev, and retain brute force for unsupported/custom metrics or relations. Include cell-boundary, duplicate-point, zero/negative radius, resize and deterministic pair-order fixtures.

**Exit criterion:** exact neighbor agreement plus benchmark improvement at appropriate N.

---

## Phase 7 — Worker runtime

Implement:

```text
MainThreadRuntime
WorkerRuntime
```

Move Flying Lines simulation + Canvas2D rendering into a worker with `OffscreenCanvas`.

MDN confirms this execution model is broadly available now. ([MDN Web Docs][1])

Implement capability probing, ready handshake, typed commands/events, request ordering, coalescing, structured failures, remount fallback after canvas transfer, cancellation and disposal. Test worker initialization/runtime crashes and rapid route/backend switching.

**Exit criterion:** user can switch runtime without changing experiment code; main/worker CPU replays meet the declared parity tolerance; no orphan worker, listener, timer, animation frame or transferred canvas survives disposal.

---

## Phase 8 — Studio architecture

Build:

- experiment picker;
- parameter panel;
- inspector;
- performance panel;
- renderer picker;
- runtime picker;
- reset/pause controls.

Generate parameter controls from schemas.

Expose validation, units, invalidation behavior, runtime/backend capability reasons and analysis provenance accessibly. Do not serialize hover, drag, readiness or telemetry state.

**Exit criterion:** adding a supported parameter kind requires no manual per-experiment UI implementation, and generated controls pass keyboard, label, error and reduced-motion checks.

---

## Phase 9 — URL/state architecture

Implement:

- versioned experiment state;
- serializer;
- parser;
- schema migration;
- copy-link.
- malformed/unknown-version rejection;
- legacy route/preset migration fixtures;
- deterministic JSON export/import when state exceeds the URL budget.

**Exit criterion:** supported states reproduce from URL alone, oversized states reproduce from exported JSON, and every supported historical/legacy fixture migrates or fails with an explicit reason.

---

## Phase 10 — Legacy migration

Migrate:

1. Drooping Lines
2. Spiral Flying Lines
3. Pulse
4. Spiral I
5. Spiral II
6. Spiral III

Preserve visual behavior first.

Do not yet aggressively generalize them.

For each effect, preserve the exact source formula/constants and presets in the legacy manifest, then migrate only according to its Phase 0 classification. Treat `FlyingCubesGL` as an archive/R&D notebook unless a later ADR selects a coherent experiment from it; do not clean its unrelated Mandelbrot/noise/texture/refraction trials into the engine. Migrate legacy WebGL behavior only after the shared CPU simulation and renderer contract are proven.

**Exit criterion:** useful old Canvas effects run through the new engine.

---

## Phase 11 — Formula AST

Create the formula language.

Start with:

```text
numbers
variables
+
-
*
/
^
sin
cos
tan
exp
log
abs
sqrt
min
max
```

Add parser limits and error reporting.

Complete the parser/IR ADR first. Add allowlist, source/token/node/depth/operation limits, finite-number/domain checks, fuzz/property tests, worker isolation and CSP tests. Keep serialized AST migrations and interpreter/compiler conformance fixtures in scope; keep arbitrary JavaScript and `eval()` out of scope.

**Exit criterion:** formulas execute without `eval()`.

---

## Phase 12 — Formula-based experiment system

Implement:

```text
VectorField
DiscreteMap
Transform
ScalarField
Metric
```

Each has explicit allowed variables and output shape.

Each also declares input/output dimension, continuous-versus-discrete stepping semantics, precision/tolerance, invalid-state policy and analyzer/renderer capabilities. `Lorenz` therefore uses a 3D vector-field contract while the logistic map uses a 1D discrete-map contract; neither is forced through a 2D particle signature.

**Exit criterion:** experiments can be defined by formulas instead of hard-coded animation classes.

---

## Phase 13 — Mathematical classics

Add several reference systems.

Examples:

```text
Van der Pol
Lotka–Volterra
Hénon map
logistic map
Lorenz
simple harmonic oscillator
```

These become correctness/education benchmarks.

---

## Phase 14 — Formula morphing

Generate sliders for symbolic parameters.

Add side-by-side comparison.

Implement deterministic synchronization between comparison panes.

**Exit criterion:** tiny parameter changes can be explored visually.

---

## Phase 15 — Graph-analysis subsystem

Formalize and extend the minimal Phase 3 graph analyzer. For point clouds expose:

```text
edges
degree
components
clustering
β₀
```

Reuse the spatial index.

Only reuse an index whose declared metric/search capabilities match the analyzer. Count undirected edges once, compute \(\beta_0\) on a frozen snapshot, and label graph cycle rank separately from Rips-complex \(\beta_1\). The monotonic rule “increasing ε cannot increase \(\beta_0\)” applies to the same point cloud and metric, not to a moving simulation sampled at different times.

**Exit criterion:** topology begins as graph analysis rather than expensive PH.

---

## Phase 16 — Rips-complex visualization

Implement:

```text
ε threshold
edges
triangles
optional higher-dimensional representation
```

Make `connectionRadius` explicitly interpretable as ε only when the graph and complex share the same frozen snapshot, coordinate units and validated metric. Show triangles only as filled 2-simplices; do not infer higher-dimensional homology from line rendering alone.

**Exit criterion:** users can visually understand components and holes.

---

## Phase 17 — Persistent topology backend

Add separate topology worker.

Implement adapter API.

Run a backend ADR/spike using the official Ripser source and browser demo as evidence, not the unrelated fork previously cited. The spike must produce:

```text
pinned source commit and license
reproducible Emscripten build
typed wrapper and cancellation/resource failures
H₀/H₁ golden fixtures compared with GUDHI
performance/memory envelope
go/no-go decision
```

If it passes, implement `RipserWasmAdapter`; otherwise select another adapter without changing the analysis/studio contracts. Do not implement persistence reduction from scratch in this phase. ([GitHub][7])

Start with:

```text
H₀
H₁
```

Keep H₂ deferred to a separate evidence-backed phase.

---

## Phase 18 — Persistence visualization

Add:

```text
barcode
persistence diagram
Betti numbers
ε cursor
```

Synchronize all of them with the simulation.

Cache results by snapshot, metric, filtration/coefficient options and analyzer version. Moving ε filters/cursors through one validated result and does not recompute persistence per pointer event.

**Exit criterion:** dragging ε updates visual geometry and topological interpretation coherently for the same provenance-tagged snapshot; stale or approximate results are visibly identified.

---

## Phase 19 — Dynamical systems analysis

Implement analyzers gradually:

```text
equilibria
Jacobian
stability
Lyapunov exponent
Poincaré section
basins
```

No analyzer should be mandatory for rendering.

---

## Phase 20 — WebGL renderer

Implement WebGL2 backend for high particle counts.

Reuse simulation state.

Do not create a separate WebGL-specific simulation unless GPU simulation is explicitly selected.

**Exit criterion:** same experiment can run Canvas2D or WebGL.

---

## Phase 21 — Benchmark laboratory

Create backend comparison mode:

```text
Canvas main
Canvas worker
WebGL
```

Same seed.

Same parameters.

Same viewport.

Show measured timing.

Also pin state version, timestep, browser/hardware/DPR, warm-up and sample methodology; store raw distributions and validate equal workload/snapshots. A faster backend that renders less or uses different simulation semantics is not a valid comparison.

---

## Phase 22 — WebGPU experiment

Only now implement:

```text
WebGPURenderer
```

behind capability detection.

Later investigate compute-based simulations.

Do not require WebGPU for normal Bindfly operation because browser coverage is still incomplete. ([MDN Web Docs][2])

---

## Phase 23 — Multiplayer event system

Define collaboration events.

Create local fake-server/event-log implementation first.

Then add WebSocket transport.

Define room authority, protocol/state versions, stable event/entity IDs, authentication/authorization boundary, idempotency, server sequence assignment, step scheduling, validation, rate/size limits, reconnect and error semantics before transport. Formula changes carry validated canonical formula state, never executable JavaScript. Presence/chat, public discovery and offline multi-writer editing remain out of scope unless separately approved.

**Exit criterion:** two clients can modify the same point-cloud experiment through an authoritative ordered log, recover from duplicate/late/out-of-order delivery, and resynchronize after a forced divergence.

---

## Phase 24 — Authoritative synchronization

Add:

```text
sequence numbers
state hashes
snapshots
reconnect
resync
```

Don't rely solely on lockstep.

Define canonical snapshot bytes and checksum algorithm per state version; never hash incidental JavaScript object serialization. The server periodically compares or supplies authoritative state, and clients atomically replace divergent state. Cross-browser/GPU backends use this reconciliation contract rather than claiming bitwise lockstep.

---

## Phase 25 — Collaborative mathematical modes

Add experiments such as:

```text
collectively form β₁ = N

connect all components

perturb an attractor

each user controls one parameter
```

At that point the old “WebSocket game” idea has matured into something genuinely distinctive.

---

# 46. Architecture acceptance tests

I would literally give Codex these tests of whether the architecture succeeded.

A new mathematical experiment should **not require modifying**:

- router code;
- worker switch statements;
- generic parameter UI;
- renderer internals;
- analysis infrastructure.

A new renderer should **not require modifying**:

- simulation logic;
- experiment formulas;
- analyzers.

A new analyzer should **not require modifying**:

- renderer;
- simulation;
- React control components.

A new parameter should ideally require changing only:

```text
experiment parameter schema
+
simulation/formula using it
```

A new worker command should usually arise from domain protocol types rather than arbitrary string handling.

If these statements cease to be true, the architecture is becoming coupled.

---

# 47. One more important rule for Codex

I would explicitly put this near the top of the specification:

> **Do not generalize from a single implementation prematurely. Prefer duplication across the first two implementations over creating a bad abstraction. Extract an abstraction after at least two concrete consumers demonstrate the common shape.**

This is particularly important given Bindfly's history.

Your previous hyperfocus was partly:

> architecture should be cool.

This time the goal should be:

> architecture should make future experiments cheap.

Those are not always the same thing.

---

# 48. The target end-state

Eventually, Bindfly's internal model should allow something like this:

```text
Experiment
│
├─ Mathematical definition
│  ├─ formula(s)
│  ├─ parameters
│  ├─ seed
│  └─ initial conditions
│
├─ Simulation
│  ├─ continuous
│  ├─ discrete
│  ├─ particles
│  └─ scalar field
│
├─ Runtime
│  ├─ main thread
│  └─ worker
│
├─ Renderer
│  ├─ Canvas2D
│  ├─ WebGL2
│  └─ WebGPU
│
├─ Analysis
│  ├─ graph
│  ├─ dynamics
│  ├─ topology
│  └─ statistics
│
├─ Interaction
│  ├─ point creation
│  ├─ perturbation
│  ├─ parameter morphing
│  └─ selection
│
└─ Collaboration
   ├─ event log
   ├─ WebSocket
   └─ authoritative synchronization
```

That is the architecture I'd want Codex working toward.

Most importantly, **it doesn't assume we already know what Bindfly will become**. A future idea—reaction-diffusion, cellular automata, complex functions, fractals, agent-based systems, manifolds, neural dynamics, PDEs, higher-dimensional projections—can fit into this architecture without redefining the entire application.

So yes: the next work should be architectural. But I would give Codex **Phases 0–9 first**, rather than instructing it to execute all 26 phases as one mega-refactor. The first major milestone should be **Flying Lines completely rebuilt on the new architecture, worker-capable, deterministic, spatially indexed, parameter-schema-driven, benchmarked, tested and URL-reproducible**. If that milestone feels clean, the rest of the mathematical laboratory has a strong foundation.

---

# 49. Verified current-state evidence and consequences

This plan is grounded in both the supplied audit/analysis and a fresh structural/runtime check of the branch.

CodeGraph indexed:

```text
51 source files
528 symbols/nodes
920 structural edges
```

The important blast radii are:

- `CanvasAnimation`: 104 affected symbols across every Canvas effect, both hooks, the worker and parameter helpers;
- `IProperty`: 134 affected symbols across presets, routes, UI, effects, worker and helpers;
- `ECanvasWorkerMessage`: 19 affected symbols across the enum, giant message interface, handlers and worker;
- `useCanvas`: the single React-to-Canvas/worker choke point, with no covering tests.

Fresh quality evidence:

```text
webpack production build: PASS
TypeScript no-emit check: FAIL
lint: FAIL
tests: FAIL — no tests found
```

The passing build is therefore only evidence that Babel/Webpack can emit bundles. It is not evidence of type safety or behavioral correctness. Confirmed structural/runtime defects include async loader functions used as constructors in fallback/WebGL paths, render-time `canvasReload` teardown, incorrect animation-frame cancellation, frame-based physics, duplicated/stringified distance work, fake resize events crossing the worker boundary, global resize ownership, same-axis velocity assignment, discarded WebGL property updates, listener cleanup with a different function identity, and unmanaged timers in effects.

Consequences:

1. Do not refactor `CanvasAnimation` or `IProperty` in place across their full blast radius.
2. Build a new typed vertical slice beside legacy, then migrate through explicit adapters/fixtures.
3. Do not spend Phase 0 making every legacy gate green; record failures, stabilize only what is needed for evidence, and require green gates for all new code.
4. Treat dynamic loader identity, parameter visibility matrices, presets, worker commands and route generation as one coupled seam to replace with the explicit experiment registry/schema—not as independent cleanup tasks.
5. Preserve old formula source and approved visual character, not lifecycle/performance bugs accidentally mixed into the same classes.

---

# 50. Delivery milestones, dependencies and stop rules

The 26 phases remain the detailed backlog, but execution is authorized in release bands. Do not start a later band merely because an earlier phase compiles.

## Milestone A — Legacy evidence (Phase 0)

Deliver the legacy manifest, behavior/route matrix, screenshots or recordings, preset/formula catalog, baseline measurements, current gate results and legacy URL fixtures.

Stop if representative routes cannot be made observable without changing their behavior; record the blocker and preserve source-level evidence instead of inventing parity.

## Milestone B — Flying Lines foundation (Phases 1–9)

Deliver the isolated architecture, contracts, deterministic CPU simulation, Canvas2D renderer, brute-force oracle, spatial grid, main/worker runtimes, generated studio controls, versioned state/URL codec, tests and benchmark evidence.

Required acceptance demonstration:

```text
one Flying Lines experiment
same approved preset and seed
main-thread and worker runtime switch
pause/reset/replay
add/remove/move input
URL or JSON reproduction
graph components diagnostic
visible performance/provenance panel
```

Hard stop: obtain architectural acceptance before Phase 10. WebGL, formula language, persistent homology, multiplayer, package proliferation and broad legacy cleanup are out of scope for this milestone.

## Milestone C — Extensible mathematical core (Phases 10–15)

Migrate only approved legacy effects, then deliver the safe formula IR, dimensional formula families, numerical policies, reference systems, morphing and graph analysis. The second concrete experiment is the evidence threshold for extracting shared abstractions or more physical packages.

Hard stop: formula conformance/security and graph-oracle tests must pass before topology consumes their outputs.

## Milestone D — Validated analysis (Phases 16–19)

Deliver Rips visualization, the persistent-homology backend decision/adapter, persistence UI and selected dynamical analyzers with immutable-snapshot provenance, budgets and reference validation.

Hard stop: no scientific result is labeled exact or exposed in lessons until fixtures, conventions and approximation metadata are reviewed.

## Milestone E — Renderer/performance laboratory (Phases 20–22)

Deliver WebGL2 and fair backend comparison first. WebGPU remains capability-gated research because current browser support is not universal and Three.js still describes `WebGPURenderer` as experimental.

Hard stop: do not create a renderer-specific simulation unless an ADR demonstrates that GPU simulation is the selected experiment and defines its non-determinism/reconciliation contract.

## Milestone F — Shared experiments (Phases 23–25)

Deliver authoritative event sequencing, reconciliation and reconnect before mathematical game modes. This milestone requires a separate privacy/security/operations review and is not implied by completion of single-user Bindfly.

---

# 51. Cross-interface contract matrix

| Producer | Artifact/contract | Consumer | Required invariant | Failure action |
| --- | --- | --- | --- | --- |
| Experiment registry | stable experiment ID, lazy loader, state version, capabilities | router, studio, runtime | no class/function-name identity; duplicate IDs fail build/tests | refuse registration and show developer error |
| Parameter schema | validated params/presets and invalidation modes | UI, codec, simulation, worker, collaboration | identical normalization at every boundary | reject patch with field error; retain last valid state |
| State codec | canonical serialized experiment state and migrations | URL/JSON import, snapshots, collaboration | deterministic encoding per state version; every supported migration tested | reject unknown/invalid state without partial mutation |
| Clock/runtime | step index, fixed-step timing, ordered input/parameter application | simulation, replay, collaboration | explicit catch-up policy; no refresh-rate-dependent dynamics | pause/report overload or apply documented slow-down policy |
| Simulation | immutable/read-only state view or snapshot | renderer, analyzer, checksum | renderer never mutates simulation; snapshot tied to step/version | discard invalid view; fail the affected runtime only |
| Runtime protocol | versioned command/event envelopes | main thread and worker | ready handshake, ordering, request identity, structured errors, disposal | cancel/dispose; remount canvas before safe fallback |
| Renderer | frame output and renderer telemetry | studio/benchmark | declared coordinate units, DPR and workload; no simulation ownership | surface context loss; restore or select supported backend |
| Spatial search | deterministic unique neighbor pairs | renderer and graph analyzer | semantics match declared metric/index capability; brute-force oracle agrees | fall back to oracle or mark configuration unsupported |
| Analysis scheduler | immutable analysis request with budget/cancellation | analyzer worker/backend | one provenance-tagged snapshot; stale work cannot overwrite current result | cancel/discard and retain last clearly labeled result |
| Topology adapter | intervals, conventions, options and provenance | barcode/diagram/Betti UI | metric, filtration, coefficient field, dimension and sampling explicit | return unavailable/partial with reason; never fabricate Betti values |
| Benchmark harness | raw samples plus environment/workload manifest | reports/regression gate | same workload and frozen metadata; distributions retained | invalidate comparison and rerun |
| Collaboration server | authoritative event sequence and snapshots | clients/replay | idempotency, validation, version compatibility and canonical checksum | reject event or force snapshot resync |

Every implementation issue that crosses a row must name both producer and consumer tests. A unit test on only one side is insufficient.

---

# 52. Legacy-to-new migration and cutover map

| Legacy seam | Evidence | New owner | Migration/cutover rule |
| --- | --- | --- | --- |
| `shared/abstract/canvas.ts` / `CanvasAnimation` | 104-symbol impact | experiment + simulation + renderer + runtime contracts | never adapter-wrap as the new core; replace one effect at a time |
| `types/IProperty` + `properties.json` | 134-symbol impact and 8 presets | parameter schema + versioned presets | write deterministic import fixtures; preserve supported names/values, then normalize through schema |
| `animations/index.ts` async functions and `.name` identity | loader/constructor mismatch | explicit experiment registry | registry IDs are stable data; lazy loader and constructor/factory are separate types |
| `router/CanvasHandlersConfig` | centralized visibility matrix | schema-driven controls/capabilities | delete a legacy entry only after the matching experiment route uses generated controls |
| `useCanvas` and `useWebGL` | lifecycle/runtime choke points | studio host + runtime/renderer adapters | new host cannot import legacy hooks; switch routes through strangler boundary |
| `canvas-worker.ts` + `ICanvasWorkerProps` | untyped heterogeneous commands | versioned bidirectional runtime protocol | no stringly per-parameter switch; compatibility is not required across the old/new worker boundary |
| `FlyingPoints`/`FlyingPointsGL` | mutable object arrays and frame-based randomness | typed state model + seeded initialization | preserve approved distributions visually; define new deterministic semantics explicitly |
| `FlyingLines` | representative topology/performance seam | first vertical slice | brute force first, then spatial grid with oracle/parity evidence |
| Pulse/Spiral variants | original mathematical identity | Original Experiments | freeze formulas/constants/source provenance before refactoring; document intentional numerical changes |
| `FlyingCubesGL` | mixed Mandelbrot/noise/shader/texture notebook | `experiments/archive` | archive intact; extract only a separately approved coherent experiment |

Cutover sequence:

1. Legacy and new routes coexist; new state never imports/mutates legacy singleton/context state.
2. Each migrated route gains parity/divergence evidence and legacy URL/preset migration.
3. Default navigation changes only after Milestone B acceptance and smoke tests on the supported browser matrix.
4. Remove a legacy route only after its replacement/archive decision, redirects/migrations and recovery instructions are committed.
5. Remove legacy build dependencies and `allowJs` only when no supported route or archived reproduction tool depends on them.
6. Keep the original commit/hash and legacy manifest permanently; deletion of obsolete runtime code does not delete provenance.

Rollback is route/build selection, not a source-tree reset: a failed new slice can be disabled while the recorded legacy target remains available.

---

# 53. Required ADRs and risk register

Create a short ADR before freezing each decision below. The default is deliberately conservative until evidence exists.

| Decision gate | Default before evidence | Required evidence |
| --- | --- | --- |
| Physical package extraction | logical module in workspace | two consumers or real build/deploy/test boundary plus dependency test |
| Formula parser | no parser selected | grammar/security/license spike, error quality, CSP and fuzz results |
| Numeric precision/timestep | experiment-local, not globally frozen | convergence/replay/benchmark evidence and tolerance contract |
| Worker/main state transport | worker owns simulation + Offscreen Canvas renderer for the first slice | measured transport/render needs before snapshots, transfer buffers or shared memory are introduced |
| WebGL abstraction | minimal implementation sufficient for the selected slice | compare raw WebGL2 versus Three.js maintenance/value; include disposal/context-loss evidence |
| Persistent topology backend | adapter contract only | reproducible build, license/source pin, GUDHI agreement, resource envelope and cancellation |
| WebGPU/TSL | deferred experimental adapter | supported-browser matrix, feature parity and benchmark value |
| Hosting/routes | static CSR unless product needs prove otherwise | deployment/URL requirements and legacy link compatibility |
| Collaboration storage/transport | local fake authoritative log | threat model, consistency model, reconnect load test and operating plan |

Primary risks:

| Risk | Impact | Mitigation / stop condition |
| --- | --- | --- |
| Architecture expands faster than working experiments | another abandoned rewrite | Milestone B hard stop; two-consumer extraction rule |
| Visual parity preserves bugs or loses identity | incorrect or generic remakes | Phase 0 classification plus formula/source and visual evidence |
| Custom formulas exhaust CPU or produce invalid numbers | frozen workers, corrupt state | restricted AST, budgets, isolation, finite checks and cancellation |
| Metric/index mismatch produces wrong graph/topology | scientifically false output | capability contracts and brute-force/reference oracles |
| Moving snapshots make analysis look synchronous/current | misleading results | snapshot IDs, stale-result rejection and visible provenance |
| Rips complex growth exhausts memory | crashes/unresponsive UI | explicit point/dimension/filtration budgets, sampling/sparse/collapse decisions, worker termination |
| Runtime comparison is unfair | invalid performance claims | frozen workload manifest and raw distributions |
| Canvas/worker/WebGL resources leak on navigation | progressive degradation | lifecycle state machine, disposal/context-loss tests and browser stress test |
| Replay diverges across browsers/GPU | broken sharing/multiplayer | determinism tiers plus authoritative snapshots/checksums |
| URL/schema evolution breaks saved work | lost experiments | versioned codecs, migration fixtures and JSON export/import |
| Multiplayer expands scope into operations/security | unsafe or unmaintainable service | separate Milestone F authorization and review |

---

# 54. Security, reliability, privacy and accessibility baseline

- User formulas and imported state are untrusted input. Parse to an allowlisted AST, enforce resource limits, validate at all boundaries, and never execute strings as JavaScript.
- Keep worker/WASM failures contained. Support cancellation/termination, memory/input caps, structured errors and recovery without page reload where practical.
- Treat WebGL/WebGPU context loss and device capability changes as normal runtime states; dispose buffers, textures, materials, render targets and listeners deterministically.
- Cap effective DPR and workload through a visible quality/performance policy on constrained devices; CSS size, backing-store size and world coordinates remain distinct.
- Telemetry is local-only by default. Any network collection requires a separate privacy decision defining fields, retention and consent. Never include formula/state contents, URLs, actor IDs or collaboration credentials in performance events by default.
- Collaboration requires authentication/authorization boundaries, room permissions, schema validation, size/rate limits, abuse controls, secure transport, retention/deletion policy and secrets outside shareable state.
- The studio remains operable by keyboard and screen reader: generated controls have labels, units, errors and focus order; Canvas interaction has equivalent controls/list output where feasible; color is not the only carrier of topology/state; motion can be paused and reduced.
- Scientific/educational UI always exposes metric, units, snapshot time, sample/approximation, backend and conventions. “Exact,” “persistent,” “hole,” or “chaotic” claims require the validated analyzer definition, not appearance alone.

---

# 55. Per-phase execution and definition-of-done template

Every Codex implementation issue/turn should contain:

```text
Phase and requirement IDs
user-visible outcome
in-scope files/modules
explicit non-goals
producer → artifact → consumer contracts touched
legacy parity or intentional-divergence fixture
tests to add before/with implementation
benchmark or scientific validation needed
failure/rollback behavior
documentation/ADR update
```

Definition of done for a phase:

1. Exit criterion and all entry dependencies are demonstrably satisfied.
2. New code passes typecheck, lint, unit/property/contract tests and relevant browser tests.
3. No forbidden dependency edge or unreviewed exact contract was introduced.
4. Lifecycle/resource cleanup and failure paths were exercised, not inferred from compilation.
5. Performance/scientific claims link raw evidence and configuration; approximations and unsupported cases are explicit.
6. State/protocol/schema changes include versioning and migration/compatibility decisions.
7. Legacy parity/divergence, URL migration and docs are updated where applicable.
8. CodeGraph impact is checked before changing shared symbols; the post-write compiler/tests, not the index, verify correctness.
9. The diff remains phase-scoped. If a new abstraction has only one concrete consumer, defer extraction unless a real worker/build boundary requires it.
10. Stop after the phase; do not opportunistically begin a later milestone.

---

# 56. Verified external assumptions

As checked on 2026-08-29:

- OffscreenCanvas, `transferControlToOffscreen()` and dedicated-worker `requestAnimationFrame()` are broadly available, while capability tests and fallback remain required for the supported browser matrix. ([MDN Web Docs][1]) ([MDN Web Docs][5]) ([MDN Web Docs][6])
- WebGPU remains limited availability and secure-context-only, so it stays optional. ([MDN Web Docs][2])
- Three.js `WebGPURenderer` can fall back to WebGL2 but remains experimental and has migration constraints around materials/post-processing, so it is not the baseline renderer. ([Three.js][3])
- React deprecated Create React App in 2025; moving away from the current CRA/custom-Webpack split is justified, but a full server framework is not required for this client-side laboratory. ([React][9])
- The official Ripser source documents an Emscripten/WebAssembly browser demo, but its release age and lack of an assumed maintained JS package require the Phase 17 build/validation spike. ([GitHub][7])
- GUDHI warns that Rips complexes can become huge and documents sparse approximations and edge collapse; these are budgeted backend decisions, not invisible substitutions. ([GUDHI library][4])

[9]: https://react.dev/blog/2025/02/14/sunsetting-create-react-app "Sunsetting Create React App"

[1]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen?utm_source=chatgpt.com "HTMLCanvasElement: transferControlToOffscreen() method - Web APIs | MDN"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API?utm_source=chatgpt.com "WebGPU API - Web APIs | MDN"
[3]: https://threejs.org/manual/en/webgpurenderer?utm_source=chatgpt.com "WebGPURenderer"
[4]: https://gudhi.inria.fr/python/latest/rips_complex_user.html?utm_source=chatgpt.com "Rips complex user manual — gudhi v3.13.0 documentation"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame?utm_source=chatgpt.com "DedicatedWorkerGlobalScope: requestAnimationFrame() method - Web APIs | MDN"
[6]: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas?utm_source=chatgpt.com "OffscreenCanvas - Web APIs | MDN"
[7]: https://github.com/Ripser/ripser "Ripser: efficient computation of Vietoris–Rips persistence barcodes"
[8]: https://gudhi.inria.fr/python/latest/persistent_cohomology_user.html?utm_source=chatgpt.com "Persistent cohomology user manual — gudhi v3.13.0 documentation"
