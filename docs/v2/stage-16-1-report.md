# Stage 16.1 — collaboration correctness and integration hardening

Stage 16.1 is a post-review hardening pass over the completed Stage 16A–16E collaboration foundation. Stage 16.2 later supersedes the final closure claim here with a narrow recovery-edge pass; this report remains the record of the 16.1 integration work. It does not reopen the ordering or simulation architecture. It closes the gaps between a strong protocol/reference-server implementation and an end-to-end shared Studio experiment.

## Active-session reconciliation

`AuthoritativeTick` can now carry an `AuthoritativeSyncPoint` containing the authoritative `stepIndex`, `appliedSequence` and SHA-256 canonical snapshot checksum. The reference server creates a sync point every 120 steps by default and whenever the applied event prefix changes. Replicas verify the checksum only after they reach the same step/applied-sequence boundary.

On mismatch, `CollaborationReplica` enters `needs-resync` and the shared client requests authoritative recovery. This keeps the intended numerical contract:

```text
optimistic deterministic CPU execution
        +
periodic authoritative SHA-256 verification
        +
snapshot recovery on mismatch
```

Cross-browser `Math.sin`/`Math.cos` behavior therefore does not need to be promised bitwise-identical indefinitely.

Reconnect replay is also stricter. Except for the explicit genesis state, a replay base must match a remembered authoritative synchronization point (or the current authoritative snapshot) by step, applied sequence and checksum. Otherwise recovery uses a snapshot. `maxReplaySteps` (600 by default) complements `maxReplayEvents`, preventing an event-free but extremely stale replica from being asked to simulate an unbounded number of historical fixed steps.

## Event integrity and durability

Persistence format version 2 separates event durability from simulation-time checkpoints:

```text
accepted event
    ↓
canonical event bytes
    ↓
SHA-256 event-log hash chain
    ↓
append + fsync WAL
    ↓
ACK / broadcast

simulation steps
    ↓
periodic canonical snapshot checkpoint
    ↓
temp file + fsync + atomic rename + directory fsync
```

Each WAL record stores its previous hash, resulting hash and canonical event. Checkpoints store the event count and event-log prefix hash. Recovery verifies the full chain, contiguous sequence numbers, canonical event decoding/re-encoding, and checkpoint-to-log-prefix identity before restoring state. Tests include a valid, canonical but altered event payload; changing the event without also forging the chain is rejected.

This remains an integrity mechanism, not a MAC/signature. A malicious actor who can rewrite the persistence file and recompute all hashes is outside this adapter's threat model.

The file adapter now gives the following durability contract:

- acknowledged collaboration events are lossless across a process crash once their WAL append succeeds;
- simulation time may roll back to the latest periodic checkpoint (120 steps by default);
- on recovery, WAL events beyond that checkpoint remain authoritative and are reapplied at their original scheduled boundaries as simulation time catches up;
- ticks do not trigger full-file rewrite/fsync transactions;
- the existing 16 MiB ceiling applies to checkpoint plus WAL bytes.

Persistence format v1 is intentionally not migrated by this development adapter. A v1 file is rejected as an unsupported persistence version. There is no deployed production room corpus requiring migration yet; adding a migration without such a compatibility requirement would create a second historical durability contract unnecessarily.

If a WAL append or checkpoint fails, the server poisons the authority for all reads and writes, terminates active collaboration sockets and rejects new upgrades until process restart/recovery. Resume can therefore never expose state known to be newer than durable storage.

## Idempotency and transport backpressure

Submission now canonicalizes/validates the input and checks `(participantId, clientEventId)` before current authorization and rate-limit checks. An exact retry of an already-authoritative event returns the original committed outcome even if the participant's permission changed after the original acceptance. Reusing the same idempotency key with different canonical bytes remains a conflict.

Outbound transport now checks `WebSocket.bufferedAmount` plus the outgoing message size against a 512 KiB default hard limit. A slow consumer is disconnected and must recover through resume; authoritative events are never silently skipped on a connection that remains live.

## Room bootstrap and Studio vertical slice

The wire protocol adds an authenticated `describe-room` / `room-descriptor` handshake. The descriptor contains:

```text
roomId
experimentId
stateVersion
configurationVersion
canonical configuration bytes
```

This lets a new participant discover the experiment/configuration before constructing its local session. Configuration equality remains part of snapshot/resume validation after construction.

Studio collaboration is an optional plugin/session capability rather than a new method on every `ExperimentSession`. Flying Lines opts in with its existing versioned collaboration configuration and moving-point input/checkpoint codecs. Other experiments remain unchanged.

`SharedExperimentClient` owns the client-side protocol flow:

```text
room descriptor
    ↓
create collaboration-capable Studio session
    ↓
resume snapshot/replay
    ↓
authoritative event buffering
    ↓
fixed-step simulation + boundary application
    ↓
sync-point verification
    ↓ mismatch
automatic snapshot resynchronization
```

The Node integration fixture uses two real Flying Lines Studio sessions. It submits add/move inputs, forces one session to mutate locally, verifies automatic checksum detection/snapshot restoration, disconnects another client, submits while it is away and verifies exact replay convergence after reconnect. Checkpoint equality is byte-exact and therefore includes particle state, RNG state and next stable particle ID.

The current product slice proves the Studio/session integration boundary. It does not add production room-creation UI, identity UX or collaborative formula editing; those are separate product/deployment work rather than protocol-correctness prerequisites.

## Operational and browser evidence

A 32-client CI-sized reconnect fixture repeatedly accepts events, disconnects/reconnects rotating client groups, injects deliberate local divergence, checks contiguous authoritative sequences, verifies exact final checkpoint convergence and confirms all server sessions close cleanly. The existing transport tests separately verify connection limits and forced disconnect when the outbound-buffer ceiling is exceeded.

A dedicated Playwright recovery fixture runs the real browser `SharedExperimentClient` and Flying Lines Studio session in Chromium, Firefox and WebKit against one Node authority. It performs authoritative input, periodic checksum verification, deliberate local corruption, automatic snapshot recovery and reconnect replay. On 2026-09-26 all three projects passed locally. This is evidence that the recovery architecture works across engines; it is not a claim that transcendental math is bitwise-identical across browsers.

CI installs Chromium, Firefox and WebKit, runs the ordinary Chromium Studio suite and then runs this dedicated three-engine collaboration recovery fixture.

## Completion

Stage 16.1 closes the issues identified after the Stage 16 implementation review without changing the simulation, formula, rendering or Stage 13 analysis boundaries. The shared-experiment acceptance criterion is now exercised through the actual Studio session layer rather than only through raw simulations/protocol fixtures.

Verification recorded for the Stage 16.1 candidate on 2026-09-26:

- `pnpm run v2:check`: 212/212 tests passed, with dependency boundaries, TypeScript and ESLint clean;
- `pnpm run v2:e2e`: all 16 Chromium Studio E2E tests ultimately passed in CI, with one Probe/worker case requiring a retry; Stage 16.2 removes that race and makes CI fail on flaky tests;
- `pnpm run v2:e2e:stage16-cross-browser`: 3/3 collaboration recovery projects passed (Chromium, Firefox, WebKit);
- `pnpm run v2:build`: passed;
- `pnpm run build`: passed;
- `git diff --check`: passed.
