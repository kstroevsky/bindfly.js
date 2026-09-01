# Legacy architecture baseline

Status: Phase 0 accepted on `2026-08-31T09:24:16+02:00`. No legacy algorithm or application source was modified.

## Reproducible source

- Branch: `bug/pulse-position`
- Commit: `9f2a83d3996207bf6886d80949561c96e1bc175d`
- Source tree (`src`, configuration, package metadata): clean before evidence generation
- Node: `v22.22.0`
- npm: `11.11.0`
- pnpm: `11.6.0`
- Lockfile: `pnpm-lock.yaml`, SHA-256 `1ba461339d1b38bfb401f1d86649f9e7fa05012bdd371d24a958d171e1736d94`

## Runtime flow

```text
properties.json + animation loader namespace
            |
            v
router creates every animation × preset route
            |
            v
Animation / AnimationGL React shell
            |
            +--> schema-external CanvasHandlersConfig -> ParamHandler controls
            |
            +--> useCanvas -> OffscreenCanvas worker -> dynamic import -> effect class
            |        \-> main-thread fallback (broken loader/constructor boundary)
            |
            \--> useWebGL -> Three.js scene -> effect constructor (broken loader/constructor boundary)
```

The Canvas2D worker currently carries simulation, neighborhood work and drawing. React carries routing, the preset sidebar, generated-looking but centrally configured controls, URL query state and canvas lifecycle. Identity is derived from async function `.name`, and parameter changes are duplicated between main-thread handlers and the worker switch.

## Structural evidence

CodeGraph indexed 51 files, 528 nodes and 920 edges.

- `CanvasAnimation` impact depth 4: 104 symbols.
- `IProperty` impact depth 4: 134 symbols.
- `ECanvasWorkerMessage` impact depth 4: 19 symbols.
- `useCanvas` is the single React-to-Canvas/worker choke point and has no covering tests.

This blast radius is why the canonical plan uses a strangler slice rather than changing these symbols in place.

## Build and quality gates

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run build` | PASS | Webpack/Babel emits production bundles; this does not type-check. |
| `npx tsc --noEmit` | FAIL | Loader-as-constructor, Canvas2D/3D particle unions, and incomplete WebGL handler contracts. |
| `npm run lint` | FAIL | 25 errors and 1 warning. |
| `CI=true npm test -- --watchAll=false` | FAIL | No tests found across 51 checked files. |

## Route and browser baseline

The router constructs 72 routes (9 effects × 8 presets), while the sidebar exposes 37 supported effect/preset links.

Browser smoke results for all 37 visible links:

- 33 routes render one canvas.
- 4 routes show the React Router error screen.
- Broken routes: `FlyingCubesGL-Simple`, `FlyingLinesGL-Simple`, `FlyingLinesGL-AddByClick`, `FlyingLinesGL-Clickable&Pulsative`.
- Error signature: `TypeError: e is not a constructor`.
- A fresh Canvas2D route/tab produced no console error or warning.
- The default root redirect resolved to `DroopingLines-Simple`, not a stable explicit experiment ID.

Interaction evidence:

- On `FlyingLines-Simple`, the `particlesCount` slider visually changed from 100 to 120 and 121.
- The URL stayed at a query containing only `bgColor`, so the changed particle count was not reproducible from the link.

Responsive evidence at 390×844:

- Canvas renders and four range inputs exist.
- Controls are visibly clipped/compressed across the top edge.
- A usable navigation/open-close affordance is not visible in the captured viewport.

See [route-matrix.json](./route-matrix.json) and [screenshots](./screenshots/).

## Lifecycle and correctness risks

The complete stable-ID list lives in [legacy-manifest.json](./legacy-manifest.json). Highest-impact items:

1. Async module factories are used as constructors in main-thread fallback and WebGL paths.
2. `canvasReload` performs destructive ref/worker mutations during React render.
3. Effects do not retain numeric animation-frame IDs for cancellation.
4. Timing, life and fades are frame-based and randomness is uncontrolled.
5. Flying Lines/Drooping Lines use quadratic neighbor loops and stringified distances.
6. The 2D boundary test compares `velocity < margin` instead of `velocity < 0`.
7. Worker commands are heterogeneous but share one giant interface and fake DOM events.
8. Global resize ownership, mismatched listener cleanup and unmanaged timers leak lifecycle responsibility.

## Performance baseline status

Complete through a temporary query-gated worker probe, now removed.

The probe wrapped worker `requestAnimationFrame` and measured the legacy effect-loop callback (particle update/neighborhood work plus Canvas2D render) after 30 warmup frames. Three 60-frame windows were captured for each count at 1280×720:

| Particles | Callback median | Frame interval median | Approx. cadence |
| ---: | ---: | ---: | ---: |
| 100 | 2.8 ms | 8.3 ms | 120.5 fps |
| 300 | 24.0 ms | 25.0 ms | 40.0 fps |
| 500 | 67.5 ms | 67.0 ms | 14.9 fps |

Pair-count growth and callback growth closely agree, supporting the quadratic-neighbor-work hypothesis for this workload. See [performance-baseline.md](./performance-baseline.md), [raw samples](./performance-raw.json) and [machine summary](./performance-summary.json). The probe was removed and all frozen source hashes passed again.

## Phase 0 completion state

Completed:

- canonical acceptance recorded;
- source commit and file hashes frozen;
- toolchain and quality gates recorded;
- effects, formulas and presets inventoried;
- all visible routes smoke-tested;
- desktop/mobile/error screenshots captured;
- migration classifications assigned;
- known defects and URL/responsive behavior recorded.
- trustworthy worker callback/frame timing captured for 100, 300 and 500 particles;
- temporary probe removed and frozen source restored byte-for-byte.

The user accepted the preservation classifications and evidence set. Phase 1 is authorized. The commit containing this baseline is the recovery point before any Bindfly 2 scaffold work.
