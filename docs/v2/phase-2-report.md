# Phase 2 report: core contracts

- Status: Complete
- Date: 2026-08-31
- Phase 1 base: `51b66e5`
- Canonical requirements: `MIG-003`, `EXP-001`, `EXP-002`, `TIME-001`, `PARAM-001`, `REND-001`, `ANAL-001`, `PROTO-001`

## Delivered

- Experiment definition with stable ID/state version, schema, full durable-state codec, capabilities, analyzers, presets and simulation factory; the helper rejects empty IDs, version mismatch and duplicate analyzer/preset IDs.
- Simulation, simulation step/clock, viewport and scheduled input contracts.
- Versioned deterministic `xmur3-mulberry32-v1` random source with snapshot/restore and golden sequence.
- Number/boolean/string/enum parameter schema with defaults, bounds, step/enum validation, stable issues and all-or-nothing normalization.
- Renderer and immutable analysis snapshot/result/provenance ports.
- Versioned state envelope plus codec/migration port.
- Explicit lazy experiment registry with duplicate, missing-ID and loader-identity failures.
- Runtime lifecycle states/transitions, execution-backend port, protocol version 1 commands/events.
- Native TypeScript test runner requiring no new dependency.

## Contract integration fake

One test-only fake crosses:

```text
registry -> schema normalization -> durable-state codec
        -> simulation creation/step
        -> immutable analysis snapshot -> cancellation
        -> runtime initialize/start/pause/resume/resize
        -> parameter/input application -> disposal
```

No fake is shipped as a production backend.

## Verification

| Check | Result |
| --- | --- |
| `pnpm run v2:boundaries` | PASS |
| `pnpm run v2:typecheck` | PASS |
| `pnpm run v2:lint` | PASS |
| `pnpm run v2:test` | PASS, 31/31 |
| `pnpm run v2:check` | PASS |
| React imports in engine | forbidden and tested |
| Legacy imports from V2 | forbidden and tested |

Broad legacy verification is run again before the Phase 2 commit. Known Phase 0 failures are not treated as Phase 2 regressions.

## Intentional deferrals

- Fixed-step clock mechanics and refresh-rate behavior: Phase 4.
- Flying Lines simulation/Canvas renderer/studio route: Phase 3.
- Worker execution: Phase 7.
- Schema-generated React controls: Phase 8.
- URL migration: Phase 9.

## Next

Phase 3 may implement one deliberately naive Flying Lines vertical slice with brute-force unique pairs, Canvas2D rendering, pointer inputs, parameter schema, a minimal graph analyzer and explicit parity/divergence evidence. It must not introduce spatial hashing, worker runtime or broad legacy abstractions yet.
