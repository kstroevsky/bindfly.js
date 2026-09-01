# Legacy FlyingLines performance baseline

Status: baseline complete. No optimization was attempted or retained.

## Contract

- Outcome: characterize the scalability of the legacy FlyingLines OffscreenCanvas worker without changing animation semantics.
- Workload: `FlyingLines-Simple` at `particlesCount` 100, 300 and 500.
- Primary metric: median worker animation callback duration across three independent 60-frame windows.
- Secondary metric: median worker requestAnimationFrame interval and cadence implied by that interval.
- Guardrails: one canvas rendered; the worker-reported particle count matched the requested count; frozen source hashes matched again after removing the probe.
- Materiality/adoption: not applicable. This is a descriptive baseline, not an A/B optimization decision.

## Environment

| Field | Value |
| --- | --- |
| Source | `9f2a83d3996207bf6886d80949561c96e1bc175d`, `bug/pulse-position` |
| OS | macOS 15.7.9, build 24G830 |
| Architecture / CPU | arm64 / Apple M1 Max |
| Memory | 32 GiB |
| Node | v22.22.0 |
| Browser | Codex In-app Browser; exact engine version was not exposed |
| Viewport | 1280×720 |
| Preset | Simple |
| Runtime | OffscreenCanvas worker |

## Probe and lifecycle

The query-gated temporary probe wrapped the dedicated worker's `requestAnimationFrame`. It measured the duration of each legacy effect-loop callback with `performance.now()` and the interval between worker rAF timestamps.

- Warmup: 30 frames.
- Samples: 60 frames per window.
- Windows: 3 per particle count.
- Callback scope: legacy particle update/neighborhood work plus Canvas2D draw.
- Observer effect: one timing pair per frame, bounded arrays, and one worker-to-main log per 60 samples; active only with `diagnostics=1`.
- Cleanup: the probe was removed after capture and every source hash in `source-hashes.sha256` revalidated.

An initial pilot used 60 warmup + 240 samples. It was classified inconclusive because 300/500-particle windows did not complete within the bounded wait. The final 30/60 workload was rerun from scratch for all counts.

## Results

| Particles | Unique pair count | Callback median | Callback p95 | Frame interval median | Frame interval p95 | Approx. cadence |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 4,950 | 2.8 ms | 3.3 ms | 8.3 ms | 9.3 ms | 120.5 fps |
| 300 | 44,850 | 24.0 ms | 28.0 ms | 25.0 ms | 34.3 ms | 40.0 fps |
| 500 | 124,750 | 67.5 ms | 90.2 ms | 67.0 ms | 100.5 ms | 14.9 fps |

Raw data: [performance-raw.json](./performance-raw.json). Machine summary: [performance-summary.json](./performance-summary.json).

## Observation and inference

Observations:

- At 100 particles, callback work fits comfortably inside the roughly 8.3 ms display interval.
- At 300 particles, callback duration is roughly 24 ms and sets the frame interval near 25 ms.
- At 500 particles, callback duration is roughly 67.5 ms and the cadence falls to roughly 15 fps.

Cost-model comparison:

- 100→300 unique pair count grows 9.06×; callback median grows 8.57×.
- 100→500 unique pair count grows 25.20×; callback median grows 24.11×.

Inference: quadratic pair work is the dominant scalability constraint for this workload. This is supported by both source structure and measured scaling, but callback duration also includes drawing and the number of accepted connections.

## Limits

- One machine, browser surface, build and preset.
- Exact browser engine version and DPR were not exposed by the safe test surface.
- Probe overhead was not independently subtracted.
- No deterministic seed exists, so particle distributions differ across runs.
- This baseline cannot be used to claim a future win without a paired deterministic oracle/workload.

## Decision

No product change is adopted. Phase 6 must compare brute-force and spatial-index implementations on deterministic point clouds, prove exact neighbor agreement, retain raw samples, and report incremental plus cumulative comparisons.
