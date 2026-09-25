# Stage 15C — controlled Canvas2D/WebGL2 comparison

Stage 15C compares renderer backends under the rule **change representation, not mathematics**. Both backends use the same CPU simulation, formula VM outputs, derivation/sampling code, seed, parameter overrides, initial-condition inputs, viewport and DPR. Dynamic experiments start paused, advance to the same fixed-step index, and then advance exactly one step per recorded sample.

The benchmark also asserts backend parity for every state metric exposed by each experiment. Flying Lines matches `step/points/edges/components`; Vector Field and Discrete Map match `step/points/edges`; Scalar Field matches `points/edges`. Renderer selection occurs only when the session composes the renderer; simulation and derivation remain shared.

## Timing semantics

- `simulationMs`: fixed-step CPU simulation work for the sampled step.
- `derivationMs`: shared CPU derivation/sampling before renderer submission.
- `uploadMs`: WebGL representation conversion plus CPU-to-GPU API upload/submission; zero for Canvas2D.
- `renderMs`: synchronous CPU renderer draw-call submission.
- `gpuRenderMs`: asynchronously completed `EXT_disjoint_timer_query_webgl2` timing when supported. It is excluded from `totalFrameMs` because GPU work overlaps CPU execution.
- `totalFrameMs`: `simulationMs + derivationMs + uploadMs + renderMs`.

The test environment did not expose `EXT_disjoint_timer_query_webgl2`, so this run contains no GPU execution timings. CPU submission timings remain valid; no GPU cost is inferred from the missing extension.

## Controlled comparison

Environment: Chromium 153.0.8010.12, Apple M1 Max, 1440×900 browser viewport, DPR 1. The measured code is commit `8f2e5b1150985c5664867d2c33a7da378fc708d1`; tracked files were clean during the run.

| Workload | Canvas render median / p95 | Canvas total median / p95 | WebGL upload median / p95 | WebGL render median / p95 | WebGL total median / p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Flying Lines | 1.00 / 1.20 ms | 1.50 / 1.60 ms | 0.50 / 0.60 ms | 0.00 / 0.10 ms | 1.00 / 1.10 ms |
| Vector Field | 0.30 / 0.30 ms | 0.40 / 0.50 ms | 0.40 / 0.50 ms | 0.00 / 0.10 ms | 0.60 / 0.70 ms |
| Discrete Map | 0.10 / 0.20 ms | 0.20 / 0.20 ms | 0.10 / 0.20 ms | 0.00 / 0.10 ms | 0.10 / 0.20 ms |
| Scalar Field | 0.10 / 0.20 ms | 0.10 / 0.20 ms | 0.00 / 0.00 ms | 0.00 / 0.10 ms | 0.00 / 0.10 ms |

Raw samples, exact workload configuration, parity metadata and distribution summaries are in `docs/v2/stage-15c-renderer-comparison.json`.

## Stage 15D decision

The comparison gives one clear representation-level optimization target. Vector Field spends about 0.40 ms median converting/uploading WebGL primitive data, enough to make its WebGL CPU frame slower than Canvas2D despite cheaper draw submission. Flying Lines spends about 0.50 ms there as well, although its larger Canvas2D edge-rendering cost still leaves WebGL ahead overall. Discrete Map's 0.10 ms upload cost is small, and Scalar Field's cached raster/contour representation has effectively zero steady-state upload cost.

Stage 15D should therefore replace per-frame JavaScript number arrays plus `new Float32Array(...)` conversion with reusable typed vertex staging buffers in the dynamic WebGL primitive renderers, then repeat the same controlled benchmark. This changes representation only. There is no evidence in this run for moving scalar formula evaluation, scalar colormap evaluation, simulation state or derivation into shaders/GPU compute.
