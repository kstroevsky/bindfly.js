# Stage 14 report: dynamical-systems laboratory

Stage 14 is complete on the current integration branch.

## Implemented

- Preserved Pulse/Spiral historical accumulator behavior behind explicit `Original` mode and added the separate `Controlled phase · mathematical variant`, where every point uses the declared constant phase.
- Replaced presentation strings in durable phase-mode state with stable machine values (`original` / `controlled`) and added migration for the initial Stage 14 state representation.
- Added reusable declared numeric formula parameters with stable IDs, defaults, ranges and steps. Formula coefficients enter the canonical formula scope through schema metadata and never through source/AST interpolation.
- Preserved formula-parameter semantics in the generic parameter schema so Studio history and future analyzers can distinguish coefficients from unrelated numeric controls.
- Added the `vector-field-2d` experiment family with editable `dx/dt` and `dy/dt`, canonical Probe traces, clickable initial conditions, field samples, multiple trajectories and fourth-order Runge-Kutta integration.
- Added the `discrete-map-2d` experiment family with simultaneous two-coordinate recurrence from one old scope, Hénon defaults, logistic delay embeddings, clickable initial conditions and point-only orbit rendering.
- Added the `scalar-field-2d` experiment family with explicit `z=f(x,y)` formulas, declared coefficients, bounded field sampling, a selected level-set contour, value coloring and canonical Formula Probe.
- Added one framework-independent isotropic phase-space transform and use it for rendering, input, Probe coordinates and field sampling. Rectangular viewports expose more mathematical domain instead of stretching one axis.
- Enabled Canvas2D Worker execution for vector fields, discrete maps and scalar fields through the existing Studio session/runtime protocol, without experiment-specific Worker branches.
- Added configuration epochs to vector-field trajectories and discrete-map orbits. Formula/coefficient hot updates preserve current state but begin a new provenance segment; continuous trajectory rendering does not draw a false connecting curve across the regime boundary.
- Committed the pnpm lockfile and retained frozen-lockfile CI behavior.

## Architecture result

The Stage 14 pressure test did not require new abstractions in the core Experiment contract, fixed-step runtime, Worker protocol, formula VM or Stage 13 analysis scheduler. The new mathematics is implemented through additive experiment, session, formula, sampling and renderer modules.

The boundary checker caught and rejected one attempted `rendering -> effects` dependency while scalar-field rendering was being added. The final renderer owns a neutral structural render-grid contract, so the canonical dependency direction remains intact.

Vector-field RK4 stepping and discrete recurrence stepping remain separate implementations. No generic dynamical-system session base class was introduced; only commonality demonstrated by multiple consumers was extracted, such as the phase-space transform and formula-parameter semantics.

## Verification status

- V2 dependency boundaries: PASS.
- TypeScript typecheck and V2 lint: PASS.
- V2 unit/integration suite: PASS, 167/167 tests.
- RK4 reference system `x'=x, y'=-y`: PASS against the expected exponential solution.
- Discrete simultaneous-update semantics and Hénon/logistic examples: PASS.
- Isotropic screen/mathematical coordinate round trips and scalar-field visible bounds: PASS.
- Formula/coefficient configuration-epoch segmentation: PASS, including a renderer test proving continuous curves break at regime boundaries.
- Chromium Studio E2E: PASS, 12/12 tests. Vector Field, Discrete Map and Scalar Field all exercise the generic Worker path; dynamics labs exercise Freeze/Step, and Scalar Field exercises Probe on main and Worker runtimes.
- Production V2 webpack build: PASS.
- `git diff --check`: PASS for the Stage 14 changes.

## Exit criterion

Met. Formula families are now explicit mathematical experiment types rather than arbitrary expression strings. Stage 14 includes preserved historical/controlled parametric behavior, declared formula coefficients, continuous vector fields with RK4 trajectories, simultaneous discrete maps and sampled scalar fields.

Equilibria, stability, Lyapunov exponents, basins and bifurcations remain later optional analyzers as specified by the implementation plan; automated parameter sweeps remain Stage 17 work.

## Next stage

Stage 15 can now compare a second renderer against three materially different workloads: particle/proximity geometry, continuous ODE phase portraits, and discrete/scalar mathematical fields. The simulation and formula models should remain unchanged while WebGL2 is introduced behind the renderer capability boundary.
