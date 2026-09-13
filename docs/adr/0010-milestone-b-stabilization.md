# ADR 0010: Milestone B stabilization before generic composition

- Status: Accepted
- Date: 2026-09-13
- Stage: 9.5 — PR #33 stabilization
- Depends on: ADR 0004, ADR 0007, ADR 0008, ADR 0009

## Decision

Keep PR #33 bounded to correctness and contract stabilization. Do not extract the proposed experiment-session or heterogeneous-plugin architecture in this PR.

Parameter patches are classified by the strongest invalidation declared by the affected schema entries. `hot-update` patches update the live owners without recreating the deterministic particle world; `reset-simulation` patches rebuild from the canonical seed; `rebuild-runtime` remains an explicit unsupported path until a runtime-level consumer exists. Flying Lines currently applies connection radius and background as hot state/view-owner updates.

Worker and main-thread telemetry expose the same fields, including cumulative dropped fixed steps. Flying Lines capability metadata reports the already implemented worker runtime. UI capability decisions use a boolean support field; explanatory reason text is display-only.

Worker command envelopes are followed by command-specific runtime validation of initialize, viewport, input and parameter payloads. Invalid payloads and commands issued before initialization fail explicitly. An out-of-order command does not advance the expected sequence.

GitHub Actions runs V2 boundaries, typecheck, lint, unit/contract tests, V2 and legacy production builds, plus a Chromium browser smoke suite. The browser suite covers main/worker startup and switching, point interaction, hot parameter behavior, URL restoration, JSON import/export and a mobile viewport. Performance artifacts remain informational because shared CI runners are not a stable benchmarking environment.

## Deferred architecture

- Extract one framework-free `ExperimentSession` shared by main and worker only in Stage 10A.
- Add the deliberately erased heterogeneous `StudioExperimentPlugin` boundary with Drooping Lines as the second consumer.
- Replace independent renderer/runtime capability lists with compatible execution profiles.
- Separate frame-critical derivations from scheduled snapshot analyzers and repair snapshot typing before topology.
- Move connection radius and background fully out of physical simulation state when the session layer supplies their proper owners.

## Scaling boundary

The current proximity workspaces may allocate complete-graph edge capacity, `n(n-1)/2`, which is accepted only under the current 500-particle ceiling. Increasing that ceiling requires an explicit edge-output design such as budgets, streaming/chunking, sparse adjacency, renderer batches, sampling/LOD or GPU generation. Spatial indexing alone does not solve edge-output complexity.

## Consequences

- Hot visual/derivation changes no longer restart the live world.
- Worker inputs fail at a validated boundary instead of relying on TypeScript casts over untrusted messages.
- PR #33 gains automatic regression gates without absorbing the next architecture milestone.
- Stage 10A starts in a fresh PR and must prove generic composition with Drooping Lines.

## Rollback

Revert the Stage 9.5 commit. Phase 9 remains runnable, but the known invalidation, telemetry, capability, validation and CI contract gaps return.
