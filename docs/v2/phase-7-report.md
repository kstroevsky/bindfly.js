# Phase 7 report: worker runtime

- Status: Complete
- Date: 2026-09-01
- Phase 6 base: `560599d`

## Delivered

- Generic `MainThreadRuntime` and ordered `WorkerRuntime` execution backends.
- Protocol sequence IDs, request identity, ready/ack events and structured errors.
- Flying Lines OffscreenCanvas worker composition and separate Webpack worker asset.
- Capability probing, pre-transfer fallback and post-transfer remount navigation.
- Worker telemetry, frame-coalesced parameter patches and worker-owned pointer inputs.
- Explicit listener/frame/worker disposal tests.

## Verification

| Check | Result |
| --- | --- |
| V2 tests | PASS, 64/64 |
| Main/worker CPU parity | Exact; maximum difference 0 ≤ 1e-9 |
| Ordered rapid commands | PASS |
| Structured initialization failure | PASS |
| Worker termination/listener cleanup | PASS |
| V2 build | PASS; separate worker asset emitted |
| Legacy build | PASS |
| Browser worker render/telemetry | PASS; 100 points, advancing step, no console errors |
| Runtime switch/remount | PASS; Worker → Main thread on same route |

## Exit criterion

Met. The user can select main or worker execution without changing experiment code; CPU replay meets tolerance; disposal terminates the transport and removes listeners; transferred canvases are replaced through a fresh route remount.

## Explicit deferrals

- Live state migration across runtime switching: Phase 9 snapshot/URL state.
- Generated generic runtime controls: Phase 8.
- Cross-browser and worker-crash matrix beyond the current browser: future CI/browser coverage.

## Next

Phase 8 should build the schema-generated React studio, experiment picker and generic runtime/renderer controls around these backends.
