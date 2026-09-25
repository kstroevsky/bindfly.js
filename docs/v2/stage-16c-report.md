# Stage 16C — WebSocket collaboration transport

Stage 16C puts the Stage 16A/16B authority and replica contracts behind a real WebSocket boundary while keeping ordering, simulation scheduling, checkpoints and resynchronization inside the transport-independent collaboration domain.

## Wire contract

The collaboration module now owns a versioned JSON wire envelope for:

- resume requests and replay/snapshot resume plans;
- untrusted client input proposals and authoritative submit results;
- authoritative event broadcasts;
- authoritative tick broadcasts;
- bounded transport errors.

Snapshot byte fields use canonical base64url on the wire. The snapshot itself retains the Stage 16A protocol identity:

```text
SHA-256(canonical snapshot encoding v1)
```

The JSON transport therefore does not redefine checkpoint or checksum semantics.

## Server boundary

`AuthoritativeRoomWebSocketServer` wraps an `InMemoryAuthoritativeRoom` and owns only network/session concerns:

- authenticate before accepting the HTTP upgrade;
- bind one authenticated participant identity to the connection;
- require a successful resume before accepting input;
- reject a proposal whose participant ID differs from the authenticated connection;
- serialize room mutations through one operation queue;
- broadcast newly accepted authoritative events to resumed peers;
- broadcast authoritative ticks after the host advances one fixed-step boundary;
- cap WebSocket payload size independently of the domain-level encoded input limit.

The server does not implement simulation or reorder collaboration events. The room still assigns authoritative sequence numbers, schedules future application boundaries, produces replay/snapshot recovery plans and validates untrusted experiment input.

## Real transport evidence

The WebSocket integration test starts an actual HTTP/WebSocket server and connects two real `ws` clients. It verifies:

1. unauthenticated upgrades are rejected;
2. input cannot be submitted before resume;
3. participant identity cannot be spoofed across an authenticated connection;
4. two clients receive the same server-assigned event order;
5. authoritative ticks gate the same fixed-step application boundary on both replicas;
6. a disconnected replica first recovers through ordered replay;
7. a later stale replica recovers through an authoritative snapshot plus a pending future event;
8. after the next fixed step, authority and both replicas have exactly equal complete moving-point checkpoints, including RNG state and stable ID allocation.

The test intentionally uses the existing deterministic moving-point fixture and the same CPU simulation on authority and replicas. WebSocket transport therefore changes delivery mechanics without introducing a second mathematical implementation.

## Current boundary and next slice

Stage 16 remains **in progress**. A real transport now exists, but the server is still an in-memory room host. Restarting the process loses the event log and checkpoint state, and the moving-point WebSocket fixture still supplies marker configuration bytes rather than a production canonical Flying Lines room configuration encoding.

The next architectural slice is persistent authoritative room storage: durable room metadata, ordered accepted events and authoritative checkpoints with explicit protocol/state-version identity and deterministic recovery after process restart. The dedicated privacy/security/operations review remains required before Stage 16 can close.
