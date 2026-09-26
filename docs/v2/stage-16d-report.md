# Stage 16D — durable authoritative room recovery

Stage 16D makes the authoritative collaboration state recoverable after a server-process restart without changing the Stage 16A–16C ordering, scheduling or simulation semantics.

> **Current-storage note (2026-09-26):** Stage 16.1 supersedes Stage 16D's original full-record/per-step file-write strategy with an fsynced event WAL plus periodic checkpoints. This report preserves the Stage 16D milestone history; `stage-16-1-report.md` is the canonical description of the current persistence behavior.

## Persistence contract

The collaboration domain now defines a versioned `AuthoritativeRoomPersistenceState` containing:

- the latest checksum-verified authoritative snapshot;
- the durable `inputLeadSteps` scheduling policy;
- the complete ordered authoritative event log;
- each event input encoded through the experiment's canonical binary input codec rather than incidental JSON object serialization.

Recovery verifies the complete persistence record before restoring the experiment:

```text
persistence version
room / experiment / state identity
input scheduling policy
snapshot SHA-256
configuration bytes
contiguous event sequence
scheduled-step ordering
snapshot-applied / pending-event boundary
canonical event-input decode → re-encode identity
participant + client-event idempotency identity
```

Only after those checks succeed does `InMemoryAuthoritativeRoom.recover()` restore snapshot state, rebuild the event log/idempotency index and reconstruct current-boundary participant rate-limit usage.

## File-backed server store

`FileAuthoritativeRoomStateStore` is the first concrete persistence adapter. It is intentionally a single-room, single-writer Node adapter rather than a database abstraction pretending to provide distributed transactions.

Writes use a temporary file in the destination directory, mode `0600`, `fsync`, atomic rename and directory sync. The JSON storage envelope contains only versioned metadata plus canonical base64url byte payloads. The default file-size ceiling is 16 MiB, and `delete()` provides an explicit room-deletion primitive for retention policy.

The original Stage 16D WebSocket server persisted:

1. initial authoritative state before it starts listening;
2. every successful submit before returning/broadcasting the accepted event;
3. every authoritative step transition before broadcasting its tick.

Stage 16.1 tightens this contract: accepted events are appended and fsynced in the WAL before acknowledgement, ticks no longer require a filesystem transaction, checkpoints are periodic, and any persistence failure poisons authoritative reads as well as writes and terminates connected collaboration sockets.

## Canonical Flying Lines collaboration configuration

The earlier fixture marker bytes are gone. `FlyingLinesCollaborationConfiguration` now has a versioned binary encoding covering the shared values needed to reproduce the room:

- seed;
- the complete Flying Lines parameter set;
- shared simulation width and height;
- fixed-step duration.

Device-pixel ratio, renderer and runtime backend are deliberately absent because they are representation/execution choices and must not change the mathematical room identity.

## Restart evidence

The real WebSocket integration now persists a room containing one applied event plus one accepted future event, shuts the server down, constructs a fresh simulation/authority, restores from disk, reconnects through replay and advances the pending event at its original scheduled boundary. The post-restart complete moving-point checkpoint matches the uninterrupted reference, including RNG state and stable ID allocation.

Tests also verify that tampered snapshots, malformed persisted input bytes and a changed `inputLeadSteps` policy are rejected during recovery.

## Scope boundary

The file adapter deliberately retains the full authoritative event log. The size ceiling prevents unbounded local growth from becoming silent memory/disk growth; a larger or long-lived service should introduce log compaction/checkpoint retention only with an explicit idempotency-retention contract.

Multi-process writers, high availability, distributed locking and database replication are outside this adapter. A scaled deployment should replace the store behind the same persistence state contract and provide one authoritative writer/leader per room.
