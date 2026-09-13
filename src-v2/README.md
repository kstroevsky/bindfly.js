# Bindfly 2 logical modules

These directories are logical architecture boundaries, not separately published packages.

| Module | Responsibility | May depend on |
| --- | --- | --- |
| `core` | Domain-neutral simulation/state primitives introduced in Phase 2 | nothing |
| `formula` | Formula language contracts introduced later | `core` |
| `effects` | Experiment definitions | `core`, `formula` |
| `rendering` | Renderer adapters | `core` |
| `runtime` | Main/worker execution adapters and protocol | `core` |
| `analysis` | Analyzer plugins and result contracts | `core` |
| `benchmarks` | Controlled benchmark fixtures | all engine modules except `studio` |

`apps/studio` may consume every V2 module. Engine modules must not import React or the legacy `src` tree. Physical package extraction requires two concrete consumers, a worker/build boundary, or a separately testable/deployable artifact.

Run `pnpm v2:check` to enforce the current boundary and toolchain contract.
