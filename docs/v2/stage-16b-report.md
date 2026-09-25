# Stage 16B — authoritative scheduling and reconnect semantics

Stage 16B makes the Stage 16A collaboration foundation safe for intentionally scheduled future input and reconnects. The central change is that an accepted event-log head is no longer treated as identical to the event prefix already represented by authoritative simulation state.

## Ordered log versus applied state

The authority now exposes two distinct sequence concepts:

- `logHeadSequence` is the latest accepted authoritative event.
- `appliedSequence` is the contiguous event prefix already incorporated into authoritative state.

`AuthoritativeSnapshot.lastAppliedSequence` records only the second value. A snapshot therefore never claims to contain a future event merely because that event has already been accepted into the room log.

Canonical snapshot encoding v1 keeps the same binary layout and checked-in SHA-256 golden value. The TypeScript field was renamed from the ambiguous `lastSequence` to `lastAppliedSequence`; the encoded integer occupies the same position and has the same meaning as the state-covered sequence.

## Fixed-step scheduling contract

Accepted inputs are scheduled a positive number of simulation boundaries ahead; the default lead is one boundary. Events accepted at the same authoritative boundary keep server sequence order and share the same scheduled boundary.

The collaboration boundary uses this convention:

```text
state at boundary N
    ↓
run fixed simulation step N
    ↓
arrive at boundary N + 1
    ↓
apply authoritative inputs scheduled for boundary N + 1
```

`InMemoryAuthoritativeRoom.advanceStepIndex()` therefore advances exactly one boundary at a time and applies the newly due event prefix at that boundary. The deterministic simulation host remains responsible for performing its fixed simulation step before advancing the collaboration boundary.

The authority emits an `AuthoritativeTick` containing:

```text
stepIndex
logHeadSequence
appliedSequence
```

That tick is the replica watermark. A replica cannot advance beyond the latest authoritative tick and cannot cross a boundary while any event from the authority's applied prefix is missing. It also rejects contradictory evidence such as a tick claiming an event was already applied before that event's scheduled boundary.

This prevents the failure mode where a client advances simulation time and only later discovers an authoritative event that should already have affected its state.

## Reconnect planning

Reconnect is still transport-independent. A `CollaborationResumeRequest` declares protocol/room/experiment/state identity plus the client's last applied sequence, current simulation boundary and optional current-state checksum.

The authority deterministically returns one of two successful plans:

- **replay** — send the missing ordered event suffix plus the latest tick when the client's state can still be advanced safely from its reported boundary;
- **snapshot** — send a checksum-verified authoritative snapshot plus every accepted event after the snapshot's applied sequence, including events already accepted for future boundaries.

A snapshot fallback is selected when the client has already crossed a missing event's scheduled boundary, when the applied-history replay budget is exceeded, or when a checksum supplied for the current authoritative boundary disagrees with authoritative state.

Protocol, room, experiment and state-version mismatches are rejected explicitly. Duplicate replay remains idempotent because already-applied sequences are ignored and pending duplicate events must match their canonical identity.

## Input pressure limits

The existing encoded input-size limit is now complemented by a per-participant accepted-input limit for each authoritative boundary. Exact idempotent retries do not consume additional quota, and participants are accounted independently.

This remains a domain-level protection. Transport-level connection limits, authentication policy and deployment-specific abuse controls belong to the later WebSocket/server boundary.

## Deterministic evidence

The collaboration contract tests now verify:

- future events remain outside snapshots until their scheduled boundary is applied;
- a missing event plus a newer authoritative tick blocks replica advancement;
- contradictory tick/event scheduling metadata is rejected before state mutation;
- repeated replay plans remain idempotent;
- stale reconnects recover from snapshot plus the pending future-event suffix;
- a current-state checksum mismatch forces snapshot recovery;
- protocol/state identity mismatches are rejected;
- per-participant step rate limits do not penalize exact retries.

The moving-point integration test adds a real reconnect sequence. One replica first misses an event and recovers by replay. It later falls beyond the replay budget and recovers from an authoritative moving-point checkpoint plus one future `add-point` event. After the next fixed step, authority and both replicas have exactly equal complete checkpoints, including RNG state and stable ID allocation. This proves that reconnect recovery preserves future random-dependent behavior, not only visible geometry at the instant of restoration.

## Current boundary and next slice

Stage 16 remains **in progress**. The collaboration domain now defines ordering, scheduled application, log/applied watermarks, snapshots, divergence recovery, replay/snapshot reconnect behavior, size limits and a first rate-limit policy without depending on a network transport.

Stage 16C now places a real WebSocket server boundary around these contracts without changing their mathematical semantics; see `docs/v2/stage-16c-report.md`. Before exposing a production shared Flying Lines room, its collaboration adapter must replace the integration fixture's marker configuration bytes with canonical bytes for every future-affecting room configuration value. Persistent room storage and the dedicated privacy/security/operations review remain open Stage 16 work.
