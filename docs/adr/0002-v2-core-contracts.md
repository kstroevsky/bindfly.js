# ADR 0002: Bindfly 2 core contract ownership

- Status: Accepted
- Date: 2026-08-31
- Phase: 2 — Core contracts
- Depends on: ADR 0001

## Context

Phase 1 established one-way logical module boundaries. Phase 2 needs stable domain ports before any Flying Lines implementation, Canvas renderer, worker backend or React studio exists.

The old architecture made Canvas classes, async loaders, UI properties and worker messages define the domain implicitly. The new contracts must make those runtime concepts explicit without extracting packages or implementing a speculative engine.

## Decision

### Core owns domain ports

`src-v2/core` owns:

- experiment identity and definition;
- simulation and simulation-step contracts;
- deterministic random source and snapshot;
- viewport and scheduled input data;
- parameter schema, validation and invalidation modes;
- renderer port and render-frame data;
- immutable analysis snapshot/result/provenance ports;
- versioned durable-state envelope and codec/migration port;
- experiment capability and explicit registry contracts.

Rendering, analysis, runtime and effects implement or consume these ports; core imports none of them.

### Runtime owns execution concerns

`src-v2/runtime` owns:

- lifecycle states and allowed transitions;
- the execution-backend port;
- protocol version 1 command/event envelopes.

The required command surface is exactly: `initialize`, `resize`, `input`, `parameters`, `pause`, `resume`, `dispose`.

### Deterministic random algorithm

The first CPU random contract is `xmur3-mulberry32-v1`. Seeds are canonicalized with `String(seed)`. Snapshots record the algorithm ID and unsigned 32-bit state. A golden sequence test makes algorithm drift an explicit version change.

This selection is for deterministic fixtures and the first CPU simulation; it is not a claim of cryptographic security or scientific randomness.

### Parameter validation

A schema is a stable-ID record of number, boolean, string or enum definitions. Definitions include defaults and invalidation behavior (`hot-update`, `reset-simulation`, `rebuild-runtime`). Invalid schema defaults/steps/enums fail before runtime input. Input normalization is all-or-nothing and reports stable parameter IDs/codes; unknown parameters are rejected.

### Durable state

An experiment definition separates live simulation state from its durable serialized state. `ExperimentStateCodec<DurableState, SerializedState>` owns parse, serialize and migration. Versioned envelopes require explicit experiment ID, positive integer state version and payload.

### Analysis and cancellation

Analyzers consume immutable snapshot envelopes and an `AbortSignal`; results carry provenance. The core contract does not schedule work or implement an analyzer.

### Testing without new dependencies

Node 22's query-gated TypeScript stripping runs Phase 2 tests without adding an uncommitted test dependency to a repository that ignores lockfiles. TypeScript remains the authoritative compile gate. A later tooling ADR may replace this runner with Vitest when dependency/lockfile migration is explicit.

## Non-goals

- No fixed-step clock implementation; Phase 4 owns timing behavior.
- No concrete renderer, analyzer, runtime backend or worker.
- No formula language.
- No experiment implementation or preset migration.
- No React/Vite studio.

## Evidence

`pnpm v2:check` runs boundary enforcement, strict typecheck, type-aware lint and 31 tests. The integration fake proves definition validation, registry loading, schema normalization, full durable-state roundtrip, simulation creation, analyzer cancellation, and the complete execution-backend lifecycle.

## Consequences

Positive:

- Phase 3 can implement Flying Lines against explicit ports rather than legacy Canvas classes.
- Stable IDs replace function/class names.
- Main/worker backends share one lifecycle and protocol surface.
- Invalid parameter and state input fails before partial mutation.

Costs:

- Protocol version, RNG algorithm and state versions are now exact compatibility contracts.
- Concrete timing, rendering and scheduling decisions remain deliberately unresolved.

## Rollback

Revert the Phase 2 commit. ADR 0001 and the empty Phase 1 module scaffold remain valid.
