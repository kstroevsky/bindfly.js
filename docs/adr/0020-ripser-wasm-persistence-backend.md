# ADR 0020: Ripser WASM persistent-homology backend

## Status

Accepted for Stage 13E.

## Decision

Persistent homology is provided through the `PersistentHomologyBackend` contract and the Studio analysis worker uses `RipserWasmAdapter`. Bindfly does not implement persistence matrix reduction itself.

The backend is built from official [Ripser](https://github.com/Ripser/ripser) commit `01add51ff64aaf40889483260cc5c3b7d0f2a1e7`, licensed MIT. The checked-in license and source provenance live under `third_party/ripser/`.

The browser artifact is built with Emscripten 3.1.74 (`sdk-releases-c2655005234810c7c42e02a18e4696554abe0352-64bit`) using `tooling/build-ripser-wasm.sh`. The build uses `-O3`, ES-module modularization, a single embedded WASM file, Worker-only environment, filesystem support, memory growth, and a 256 MiB maximum memory ceiling. The script verifies the generated artifact SHA-256 `0165efd5f9d299fb114621f68d1c4b9d7f8a01647ab54f6a282896f1daed4851`.

The only build-time source adjustment is output precision: the script inserts `std::cout.precision(std::numeric_limits<value_t>::max_digits10);` at the beginning of Ripser's `main`. It does not change filtration or reduction semantics.

Stage 13 requests H0/H1 over F2 only. Cancellation is process-boundary cancellation: the `AnalysisWorkerClient` terminates a superseded analysis worker, which also terminates any active Ripser WASM computation. Budget refusals happen before invoking Ripser; WASM failures, malformed output, cancellation, and memory exhaustion are represented by typed backend errors.

## Validation spike

Reference calculations used GUDHI 3.13.0 with NumPy 2.5.3. Official Ripser and the Emscripten build were checked against these fixtures:

| Fixture | Expected H0 | Expected H1 |
| --- | --- | --- |
| two points, distance 2 | `[0,2)`, `[0,∞)` | none |
| unit square | three `[0,1)`, one `[0,∞)` | `[1,√2)` |
| 8-point unit circle | seven deaths at `≈0.765366865`, one `[0,∞)` | `[≈0.765366865, ≈1.847759065)` |
| 7-point figure eight | six deaths at `≈0.707106781`, one `[0,∞)` | two `[≈0.707106781,1)` |

Ripser stores filtration values as `float`, so comparisons against GUDHI's double-precision reference use a `1e-6` tolerance. The checked-in parser goldens preserve the actual Ripser values.

A deterministic 500-point cloud in a 1000×700 CSS-pixel area at ε=100 produced 5,069 edges, 21,923 triangles and 27,492 total simplices, within the Stage 13 budgets. The JS preflight took about 7.6 ms on the development M1 Max. Three fresh Node-hosted Emscripten runs of the same Ripser source/build settings completed in 24.5 ms, 50.5 ms, and 9.7 ms. Observed process RSS growth was about 32 MiB for the first fresh module and then reused runtime pages; the hard WASM ceiling remains 256 MiB. Browser production bundling was verified with `pnpm run v2:build`.

## Consequences

Persistence is computed once per pinned point-cloud snapshot and εmax. Moving the ε cursor only queries the returned half-open intervals; it does not rerun persistent homology. Static Rips structure and β1 remain independently computed by the small F2 complex analyzer, with GUDHI-backed fixture validation, so graph/Rips inspection does not depend on loading the WASM backend.

The generated worker module is deliberately checked in. Rebuilding it requires the pinned compiler and source commit and must reproduce the recorded hash before replacement.
