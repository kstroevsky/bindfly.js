# Stage 16E — privacy, security and operations review

This review covers the Stage 16 collaboration boundary as maintained through the Stage 16.1 integration pass and Stage 16.2 recovery-edge hardening pass. Its acceptance target is the current single-authority shared-experiment architecture. It is not a claim that the repository now contains a production identity provider, TLS terminator or multi-region collaboration service.

## Authentication, authorization and room permissions

The server authenticates before completing the HTTP WebSocket upgrade. The resulting participant identity is bound to that connection, is length-bounded by the shared collaboration identity contract, and cannot be replaced by a different `participantId` in an event proposal.

A connection must complete protocol/state resume before it may submit input. The authoritative room then runs its separate `authorizeInput(participantId, input)` policy before accepting the canonical parsed input.

The generic `authenticate(request)` callback is the deployment boundary for real credentials and room membership. Production adapters must verify signed/session credentials and permission for the specific room; the integration-test `x-bindfly-participant-id` header is test-only identity plumbing and is not a production authentication scheme.

If browser authentication uses ambient credentials such as cookies, that callback must also enforce an Origin allowlist to prevent cross-site WebSocket use. No collaboration credential or secret belongs in experiment configuration, snapshot bytes, event input, URLs or telemetry.

## Untrusted input and abuse controls

Untrusted collaboration input crosses several independent limits:

- versioned wire-schema parsing;
- WebSocket payload ceiling (64 KiB by default);
- experiment canonical parser/validator;
- canonical encoded-input ceiling (4 KiB by default);
- per-participant accepted-input limit per authoritative step (64 by default);
- total concurrent connection limit (128 by default);
- concurrent connection limit per authenticated participant (4 by default).
- outbound WebSocket buffering hard limit (512 KiB by default), after which the slow client is disconnected and must recover through resume.

Exact idempotent retries remain safe and do not consume additional per-step input quota. Room mutations are serialized by the server operation queue.

These controls bound the current single-room service. Internet-facing deployments should additionally enforce network/reverse-proxy request and connection limits appropriate to their environment.

## Transport security

The built-in server is an HTTP/WebSocket server and intentionally uses `ws://` in local integration tests. Production traffic must use TLS, normally by terminating HTTPS/WSS at the deployment edge/reverse proxy or by adapting the server host to a TLS HTTP server. Authentication tokens must never traverse plaintext networks.

This is a deployment requirement, not something the deterministic collaboration core should infer from proxy headers.

## Snapshot and persisted-state integrity

Snapshot checksum v1 remains SHA-256 over canonical snapshot bytes. It is a protocol identity/divergence primitive, not a signature or MAC. Periodic authoritative synchronization points carry that identity into active sessions, so a connected replica can detect numerical/state divergence and request snapshot recovery instead of assuming indefinite bitwise lockstep.

Persisted events additionally use a SHA-256 hash chain over the previous hash and canonical event bytes. The checkpoint records the event-log prefix hash, so valid-but-wrong canonical event corruption is detected during recovery. Like the snapshot checksum, this is an integrity primitive rather than authentication: an attacker able to rewrite both data and hashes is outside its threat model.

The file store therefore relies on host/storage access control, creates replacement files with mode `0600`, uses atomic replacement and fails closed after a durable write failure. Production backups/volumes should apply the deployment's encryption and access-control policy.

## Privacy, retention and deletion

Collaboration persistence contains mathematical configuration/state, event inputs, participant IDs and client-event IDs. It contains no authentication secret by design, but participant identifiers can still be personal/pseudonymous data and must be treated accordingly.

The generic file adapter does not invent a universal retention period. A deployment must define one based on the product's room lifecycle and legal/privacy requirements. `AuthoritativeRoomStateStore.delete()` provides the deletion primitive; operators must connect it to room deletion/expiry. Backups must follow the same retention intent.

Performance telemetry remains local-only by default and must not include formula/state contents, participant IDs, collaboration credentials or full room URLs unless a separate telemetry/privacy decision explicitly approves those fields.

## Failure and recovery operations

The current server is one authoritative process per room. Every newly accepted event is appended to the event WAL and fsynced before the submit is acknowledged/broadcast. Authoritative simulation ticks are not individually fsynced; the file adapter writes periodic atomic checkpoints (120 steps by default). A crash can therefore roll simulation time back to the latest checkpoint, but every acknowledged event remains in the WAL and is deterministically reapplied at its original scheduled boundary as the authority advances again.

The reference server now owns authoritative-step serialization through `runAuthoritativeStep()`. The host supplies the experiment-specific fixed-step callback, but the server executes it inside its room operation queue:

```text
queued authoritative step
    ↓
simulation.step(...)
    ↓
advance collaboration boundary
    ↓
checkpoint / sync-point work
    ↓
publish authoritative tick
```

Resume and submit work uses the same queue, so network-visible snapshot/resume traffic cannot interleave between the simulation mutation and collaboration boundary metadata. The host still decides *when* to request a fixed step; wall-clock scheduling remains outside the reference server. If the simulation callback or boundary/checkpoint work fails, the authority is poisoned and disconnects clients rather than exposing potentially inconsistent state.

If either WAL append or checkpoint persistence fails, the room is poisoned for authoritative reads and writes, connected sockets are terminated, new upgrades are rejected, and restart/recovery is required. Clients are never given resume state from a known non-durable in-memory authority.

The file adapter is not a high-availability store. Running multiple writers against the same file is unsupported. A multi-instance service needs a transactional/shared persistence implementation plus an explicit single-writer/leader rule per room.

The 16 MiB default combined checkpoint/WAL ceiling turns unchecked history growth into an explicit failure instead of silent disk consumption. Long-lived rooms will need measured checkpoint/log compaction and an idempotency-retention policy before this limit is raised.

## Review result

With the Stage 16.2 rollback, scheduling, client-idempotency and WAL-tail regressions included, the Stage 16 architecture satisfies its shared-experiment acceptance boundary: authenticated/authorized ordered input, deterministic scheduling, duplicate/out-of-order handling, periodic cryptographic state verification, automatic divergence recovery, bounded-cost reconnect, real WebSocket delivery, WAL-backed acknowledged-event durability, bounded transport/input pressure, explicit deletion/failure semantics and a real Studio/Flying Lines collaboration client vertical slice. A 32-client reconnect fixture and Chromium/Firefox/WebKit recovery test exercise the operational and cross-engine assumptions.

Stage 16 can therefore close for the repository's current single-authority scope. A production Internet deployment still has mandatory environment decisions: wall-clock scheduling, real identity/room-membership verification, TLS/WSS, browser Origin policy where applicable, retention duration, backup/encryption policy, monitoring/alerting and a transactional store/leader design before horizontal scaling.
