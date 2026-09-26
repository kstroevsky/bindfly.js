# Stage 15D — measured representation optimization

Stage 15D applies only the optimization justified by Stage 15C: reusable typed vertex staging for the dynamic WebGL2 primitive renderers. The CPU simulation, formula VM, derivation/sampling, trajectory/orbit state and scalar-field pipeline are unchanged.

Before this change, Flying Lines and the shared phase-portrait renderer built JavaScript `number[]` vertex arrays every frame and copied them into new `Float32Array` instances before WebGL upload. Stage 15D reuses geometrically growing `Float32Array` staging buffers across frames. The values sent to WebGL remain the same Float32 representation as before.

## Controlled post-optimization comparison

Environment: Chromium 153.0.8010.12 on a host with Apple M1 Max, 1440×900 browser viewport, DPR 1. The measured code is commit `5ddca316c5483a43f36c2baeac9c099801d732e5`; tracked files were clean during the run. The same Stage 15C count-level parity protocol and frozen workloads were used. Stage 15.1 later adds full-state/render-input checksums, counterbalanced repeats and actual renderer identity.

| Workload | Canvas render median / p95 | Canvas total median / p95 | WebGL upload median / p95 | WebGL render median / p95 | WebGL total median / p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Flying Lines | 1.10 / 1.20 ms | 1.60 / 1.70 ms | 0.40 / 0.50 ms | 0.10 / 0.10 ms | 0.90 / 1.10 ms |
| Vector Field | 0.30 / 0.40 ms | 0.50 / 0.60 ms | 0.20 / 0.30 ms | 0.00 / 0.10 ms | 0.40 / 0.50 ms |
| Discrete Map | 0.20 / 0.20 ms | 0.20 / 0.20 ms | 0.00 / 0.10 ms | 0.00 / 0.10 ms | 0.10 / 0.20 ms |
| Scalar Field | 0.10 / 0.30 ms | 0.10 / 0.30 ms | 0.00 / 0.00 ms | 0.00 / 0.10 ms | 0.00 / 0.10 ms |

Relative to the original single Stage 15C WebGL2 run, median upload cost changed from 0.50→0.40 ms for Flying Lines, 0.40→0.20 ms for Vector Field and 0.10→0.00 ms for Discrete Map. Vector Field's median WebGL CPU frame changed from 0.60→0.40 ms. Stage 15.1 repeats both the pre-staging and typed-staging variants with counterbalanced backend order: it confirms the Vector Field representation-conversion improvement and classifies Flying Lines' roughly 0.1 ms total-frame change as a modest observed improvement at the benchmark's timer resolution.

Scalar Field was deliberately unchanged. Its cached raster/contour path measures zero steady-state WebGL upload cost. This supports leaving the implementation alone for Stage 15, but it does not measure formula/parameter/viewport invalidation; a separate invalidation benchmark is required before any future GPU-scalar decision.

`EXT_disjoint_timer_query_webgl2` remained unavailable in the benchmark Chromium environment. The report therefore makes no claim about absolute GPU execution time. Browser timer resolution also quantizes these sub-millisecond samples at roughly 0.1 ms. Stage 15.1 additionally records ANGLE/Vulkan SwiftShader as the actual WebGL implementation in the same headless setup, so these measurements are not native Apple-GPU benchmarks.

Raw post-optimization samples are in `docs/v2/stage-15d-renderer-comparison.json`; the pre-optimization control remains frozen in `docs/v2/stage-15c-renderer-comparison.json`.

## Stage 15 result

Stage 15 now has a reproducible Canvas2D baseline, a WebGL2 render-only parity backend, a controlled same-state backend comparison, and one measured representation optimization with before/after evidence. The renderer boundary has been pressure-tested without introducing a second mathematical implementation.

Stage 15.1 subsequently hardens the word **parity** to mean mathematical/render-input equality through canonical checksums and adds a real context-loss browser test. See `docs/v2/stage-15-1-report.md`.
