# Stage 15A — Canvas2D measurement baseline

Stage 15 begins with the rule **change representation, not mathematics**. The baseline therefore measures the existing CPU simulation, formula evaluation, derivation/sampling and Canvas2D renderer before any WebGL2 implementation is introduced.

The authoritative workload definitions live in `src-v2/benchmarks/stage-15-rendering-workloads.ts`. They freeze experiment ID, seed, parameter overrides, initial-condition inputs, warm-up target and sample count. The benchmark runs in the main-thread runtime at DPR 1 and records raw timing samples rather than formatted UI values.

## Timing semantics

- `simulationMs`: fixed-step simulation work accumulated since the previous rendered frame.
- `derivationMs`: CPU derivation/sampling performed by the session before renderer submission.
- `uploadMs`: CPU-to-GPU upload work. Canvas2D records zero by definition.
- `renderMs`: synchronous renderer call/submission duration.
- `totalFrameMs`: simulation + derivation + upload + rendering.

These measurements are intentionally separate from FPS. They use browser `performance.now()`, whose effective resolution on this run is approximately 0.1 ms, so very small costs quantize to zero.

## Frozen workloads

| Workload | Mathematical/render stress |
| --- | --- |
| `flying-lines-dense-500` | 500 moving points plus ~5.9k proximity edges |
| `vector-field-glyphs-and-trails` | 15 trajectories plus 1,147 CPU-sampled vector glyphs |
| `discrete-map-many-orbit-points` | 15 deterministic orbit trails |
| `scalar-field-dense-grid` | 11,058 valid CPU formula samples rendered as the cached scalar raster/contour view |

## Canvas2D baseline

Environment: Chromium 153.0.8010.12, Apple M1 Max, macOS/Darwin arm64, 1440×900 browser viewport, DPR 1. The measured code is commit `ea080cb72c3b0d531e7084dd2536d6aa24499249`; tracked files were clean during the run.

| Workload | Simulation median / p95 | Derivation median / p95 | Render median / p95 | Total median / p95 |
| --- | ---: | ---: | ---: | ---: |
| Flying Lines | 0.00 / 0.10 ms | 0.50 / 0.60 ms | 1.10 / 1.20 ms | 1.60 / 1.80 ms |
| Vector Field | 0.20 / 0.30 ms | 0.00 / 0.00 ms | 0.40 / 0.50 ms | 0.50 / 0.80 ms |
| Discrete Map | 0.00 / 0.10 ms | 0.00 / 0.00 ms | 0.30 / 0.50 ms | 0.30 / 0.50 ms |
| Scalar Field | 0.00 / 0.00 ms | 0.00 / 0.00 ms | 0.10 / 0.20 ms | 0.10 / 0.20 ms |

The near-zero steady-state Vector/Scalar derivation rows are expected: Stage 14 caches time-independent vector samples and scalar grids. Their expensive resampling path occurs only after relevant invalidation, so Stage 15 comparisons must keep that cache state equivalent across backends and benchmark invalidation/upload separately when representation optimizations are evaluated.

Raw samples, exact workload configuration and distribution summaries are in `docs/v2/stage-15a-canvas-benchmark.json`. These values are informational evidence for backend comparison, not universal performance gates.

## Gate for Stage 15B

WebGL2 must consume the same CPU-produced state and derived structures used here. The first parity renderer must not introduce GLSL formula evaluation, GPU simulation, Float32 simulation state or renderer-owned mathematical derivation. Scalar Field therefore uploads the existing sampled grid/raster representation; Vector Field uploads the existing trajectory and sampled-vector data; Discrete Map uploads the existing orbit trails; Flying Lines uploads the existing particle/proximity buffers.
