# Stage 15.1 — renderer verification hardening

Stage 15.1 strengthens the evidence behind Stage 15 without changing renderer architecture or mathematical execution. The verification pass adds full deterministic checksums, repeated counterbalanced measurements, actual WebGL implementation metadata and browser-tested context restoration.

## Mathematical/render-input parity

The benchmark now computes deterministic regression checksums before and after every renderer call. Numeric state is encoded consistently as Float64 values; only active semantic ranges are included for capacity-backed buffers. These checksums are non-cryptographic verification sentinels local to the Stage 15 harness. They are not protocol state identifiers and must not be reused as the authoritative snapshot checksum for collaboration.

- Flying Lines simulation checksum includes active particle IDs, positions, velocities and lifetimes. Its render-input checksum also includes active proximity edge indices, distances and opacities.
- Vector Field includes time, configuration epoch, trajectory identity/status/head/trails/epochs and every CPU-sampled vector-field glyph.
- Discrete Map includes iteration, configuration epoch, orbit identity/status/head/trails/epochs.
- Scalar Field includes dimensions, mathematical bounds, every Float64 grid sample, invalid/valid counts, contour/value-scale configuration and CPU asymptotic-decider contour geometry.

For every sampled step, Canvas2D and WebGL2 must have identical simulation and render-input checksums. Each backend must also have identical pre/post-render checksums, which catches accidental renderer mutation of shared typed data. All assertions passed for all four workloads in all four runs.

This establishes **mathematical/render-input parity**. It deliberately does not claim pixel-identical rendering: Canvas2D and WebGL2 have different rasterization semantics, and the recorded WebGL `ALIASED_LINE_WIDTH_RANGE` is `[1, 1]`.

## Counterbalanced measurement protocol

Each frozen workload now executes four independent runs with backend order counterbalanced as:

```text
Canvas → WebGL
WebGL → Canvas
WebGL → Canvas
Canvas → WebGL
```

Each run retains the existing 40 samples per backend. Reports include pooled sample distributions, per-run medians and a deterministic 95% bootstrap interval over run medians. Four runs are still a small statistical sample, but they remove the fixed backend-order confound from the original Stage 15C/D evidence.

The verification run was recorded from clean commit `689b9e8e7e7a8490d64a7fd827d46eb5d7543779` with Chromium 153.0.8010.12 at 1440×900, DPR 1.

## Actual WebGL implementation

The benchmark now records the WebGL identity rather than inferring it from host CPU hardware. This headless Chromium run reports:

```text
WebGL 2.0 (OpenGL ES 3.0 Chromium)
UNMASKED_VENDOR_WEBGL: Google Inc. (Google)
UNMASKED_RENDERER_WEBGL:
ANGLE (Google, Vulkan 1.3.0
  (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
ALIASED_LINE_WIDTH_RANGE: [1, 1]
EXT_disjoint_timer_query_webgl2: unavailable
```

The archived headless benchmark is therefore a **SwiftShader software-renderer measurement**, not native Apple-GPU performance. CPU-side representation and submission costs remain informative for this environment; no Stage 15 result should be generalized as an M1 Max GPU benchmark.

## Current backend comparison

The table reports run medians for CPU `totalFrameMs`; intervals are the bootstrap 95% interval of those four run medians.

These are **verification-instrumented CPU timings**. The harness walks the complete simulation/render-input data to compute parity checksums immediately before rendering, which can warm CPU caches for the following Canvas iteration or WebGL staging pass. The absolute values therefore should not be presented as pristine production-profile timings. The Stage 15D before/after comparison remains useful because both historical and current implementations were measured through the same verification harness; mathematical/render-input parity is unaffected by this timing caveat.

| Workload | Canvas run medians | Canvas median CI | WebGL run medians | WebGL median CI | WebGL upload run medians |
| --- | --- | ---: | --- | ---: | --- |
| Flying Lines | 1.50, 1.40, 1.50, 1.50 ms | 1.40–1.50 ms | 0.90, 0.90, 0.90, 0.90 ms | 0.90–0.90 ms | 0.40, 0.40, 0.40, 0.40 ms |
| Vector Field | 0.50, 0.40, 0.50, 0.40 ms | 0.40–0.50 ms | 0.40, 0.30, 0.40, 0.40 ms | 0.30–0.40 ms | 0.20, 0.20, 0.20, 0.10 ms |
| Discrete Map | 0.10, 0.10, 0.20, 0.20 ms | 0.10–0.20 ms | 0.10, 0.10, 0.10, 0.10 ms | 0.10–0.10 ms | 0.00, 0.00, 0.00, 0.00 ms |
| Scalar Field | 0.10, 0.10, 0.10, 0.10 ms | 0.10–0.10 ms | 0.00, 0.00, 0.00, 0.00 ms | 0.00–0.00 ms | 0.00, 0.00, 0.00, 0.00 ms |

These values remain quantized by the browser timer at roughly 0.1 ms. `renderMs` is CPU submission time; GPU execution time remains unknown because timer queries are unavailable.

## Counterbalanced Stage 15D before/after control

To verify the typed-staging optimization itself, the same Stage 15.1 harness was run in an isolated worktree based on pre-staging commit `30274f2d2fb9945e2b8547bb821fa8706cc88b73`, with verification commit `689b9e8` cherry-picked only. The typed-staging commit `5ddca31` was absent.

| Workload | Pre-staging WebGL upload medians | Typed-staging upload medians | Pre-staging WebGL total medians | Typed-staging total medians |
| --- | --- | --- | --- | --- |
| Flying Lines | 0.60, 0.50, 0.50, 0.50 ms | 0.40, 0.40, 0.40, 0.40 ms | 1.00, 1.00, 1.00, 1.00 ms | 0.90, 0.90, 0.90, 0.90 ms |
| Vector Field | 0.40, 0.30, 0.30, 0.30 ms | 0.20, 0.20, 0.20, 0.10 ms | 0.60, 0.40, 0.50, 0.50 ms | 0.40, 0.30, 0.40, 0.40 ms |
| Discrete Map | 0.10, 0.10, 0.10, 0.10 ms | 0.00, 0.00, 0.00, 0.00 ms | 0.10, 0.10, 0.10, 0.10 ms | 0.10, 0.10, 0.10, 0.10 ms |
| Scalar Field | 0.00, 0.00, 0.00, 0.00 ms | 0.00, 0.00, 0.00, 0.00 ms | 0.00, 0.00, 0.00, 0.00 ms | 0.00, 0.00, 0.00, 0.00 ms |

For Flying Lines, the paired total-frame improvement is consistently about 0.1 ms, but that is one timer quantum. It is best described as a **modest observed improvement in this environment**, not a general percentage speedup.

For Vector Field, every paired run improves both upload and total CPU frame. Upload improves by about 0.1–0.2 ms and total CPU frame by about 0.1–0.2 ms depending on the run. Combined with the implementation change directly removing the measured `number[] → Float32Array` conversion, this is stronger evidence that Stage 15D fixed the representation-conversion bottleneck identified in Stage 15C.

Discrete Map's upload falls below timer resolution, but total CPU frame is effectively unchanged. Scalar Field is unchanged, as expected.

## Context-loss recovery

Browser E2E now exercises `WEBGL_lose_context` on the Scalar Field renderer. The test:

1. records mathematical/render-input checksums and a known rendered pixel;
2. loses the WebGL context;
3. restores it after the loss event has completed;
4. verifies the mathematical and render-input checksums are unchanged;
5. verifies the same pixel is rendered after resource reconstruction.

This covers the Stage 15 context-loss requirement in an actual Chromium WebGL lifecycle rather than only by code inspection.

## Scalar-field scope limitation

The Stage 15 scalar workload remains a steady-state cache-hit benchmark. It proves that rendering an already-sampled/cached scalar raster and contour is cheap; it does not measure formula edits, coefficient changes, contour invalidation, value-scale changes, viewport resize or sample-density changes.

Before any future proposal for GPU scalar evaluation or shader colormaps, add a separate invalidation benchmark that times formula evaluation, raster creation, contour extraction, texture upload and rendering independently. Stage 15.1 still gives no reason to introduce a second GLSL formula language or GPU simulation tier now.

Raw current verification samples are in `docs/v2/stage-15-1-renderer-verification.json`. The historical pre-typed-staging control is archived in `docs/v2/stage-15-1-pre-typed-staging-verification.json` with explicit base/harness provenance.
