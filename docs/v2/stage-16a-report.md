# Stage 16A — authoritative collaboration foundation

Stage 16A establishes the protocol-domain boundary needed to turn Bindfly's deterministic local experiments into deterministic shared experiments. It deliberately starts with an in-memory authority so ordering, idempotency, checkpoint identity and resynchronization can be tested independently of WebSocket lifecycle behavior.

## Authoritative event contract

The collaboration module now defines semantic protocol concepts rather than roadmap-numbered runtime APIs:

- `ClientEventProposal` carries room/participant/client-event identity, the client's last known authoritative sequence and an untrusted input payload.
- `AuthoritativeEvent` carries protocol, room, experiment and state versions plus the server-assigned sequence and scheduled simulation step.
- `InMemoryAuthoritativeRoom` validates protocol/room identity, bounded IDs, sequence claims, experiment input, encoded input size and an explicit authorization callback before mutating state.
- idempotency is keyed by participant plus client-event ID. An exact retry returns the original authoritative event; reuse of the same key for a different canonical input is rejected.
- stale `knownSequence` values are accepted so concurrently connected clients can submit against the same observed head. A client claiming a sequence ahead of authority is rejected.

This is the fake-server/event-log layer required before transport. It does not assume a WebSocket implementation.

## Canonical snapshot identity

Protocol v1 implements the plan's checksum contract literally:

```text
snapshot checksum v1 = SHA-256(canonical snapshot encoding v1)
```

Canonical snapshot bytes use an explicit binary layout containing a format magic/version, room ID, experiment ID, experiment state version, authoritative sequence, simulation step, canonical configuration bytes and experiment checkpoint bytes. Integers have fixed widths and byte order; strings and opaque payloads are length-prefixed. JavaScript object serialization is not part of the checksum definition.

The encoding has a checked-in golden SHA-256 fixture so an accidental wire-format change fails tests rather than silently redefining snapshot identity. This checksum is separate from the non-cryptographic Stage 15 renderer-verification sentinel.

## Replica ordering and resynchronization

`CollaborationReplica` applies only the next authoritative sequence. Later sequences are buffered until gaps arrive. Already-applied events are ignored, while an event whose scheduled step is already in the replica's past requests resynchronization instead of rewriting history.

Snapshot comparison hashes the replica's current canonical snapshot bytes and returns explicit divergence evidence. Resynchronization first verifies protocol/room/experiment/state-version compatibility, configuration identity and the authoritative SHA-256. Only then does it replace experiment state and authoritative sequence/step metadata. A tampered snapshot test verifies that state is not restored before checksum validation succeeds.

## Complete moving-point checkpoints

The existing moving-point snapshot intentionally represented visible simulation state only. That is insufficient for distributed resynchronization because future evolution also depends on hidden state.

The new moving-point checkpoint v1 therefore contains:

- every active particle ID, position, velocity and remaining lifetime;
- the current seeded-RNG algorithm/state;
- the next stable particle ID.

Its explicit binary codec is independent of UI/transport serialization. Restore reconstructs the live typed-buffer state and restores RNG/ID allocation, so equality survives future random-dependent operations rather than only matching at the instant of resync.

Moving-point input validation also now lives with the moving-point domain rather than Studio. The same parser validates local and untrusted collaborative input, and a deterministic binary input encoding supplies idempotency identity without relying on object property order.

## Deterministic integration proof

The Stage 16A integration test uses one authoritative and two replica moving-point simulations with the same seed, parameters and viewport. It exercises:

1. two participants submit point changes against the same observed sequence;
2. authority assigns a total order;
3. one replica receives sequence 2 before sequence 1 and buffers the gap;
4. duplicate delivery is ignored;
5. all simulations advance through the same fixed steps;
6. one replica is intentionally mutated to force divergence;
7. SHA-256 comparison detects the divergence;
8. the replica restores the authoritative checkpoint;
9. another point is added after resynchronization;
10. all simulations advance again and their complete checkpoints remain exactly equal.

The post-resync point creation is important: it proves RNG and stable-ID allocation were restored along with visible geometry.

## Current boundary and next slice

Stage 16 is **not complete**. Stage 16A proves the authority/replica and checkpoint contracts without network transport. The next slice should define authoritative distributed step/tick scheduling and the reconnect handshake, then place a WebSocket transport around the already-tested domain protocol. Persistent room storage and the separate privacy/security/operations review also remain open.

The integration fixture currently supplies fixed canonical configuration bytes. Before a real shared Flying Lines room is exposed through WebSockets, its collaboration adapter must define canonical configuration bytes for every future-affecting configuration value required by that room version rather than using the fixture marker.
