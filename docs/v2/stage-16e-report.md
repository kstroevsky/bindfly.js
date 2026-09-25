# Stage 16E — privacy, security and operations review

This review covers the Stage 16 collaboration boundary as implemented through Stage 16D. Its acceptance target is the current single-authority shared-experiment architecture. It is not a claim that the repository now contains a production identity provider, TLS terminator or multi-region collaboration service.

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

Exact idempotent retries remain safe and do not consume additional per-step input quota. Room mutations are serialized by the server operation queue.

These controls bound the current single-room service. Internet-facing deployments should additionally enforce network/reverse-proxy request and connection limits appropriate to their environment.

## Transport security

The built-in server is an HTTP/WebSocket server and intentionally uses `ws://` in local integration tests. Production traffic must use TLS, normally by terminating HTTPS/WSS at the deployment edge/reverse proxy or by adapting the server host to a TLS HTTP server. Authentication tokens must never traverse plaintext networks.

This is a deployment requirement, not something the deterministic collaboration core should infer from proxy headers.

## Snapshot and persisted-state integrity

Snapshot checksum v1 remains SHA-256 over canonical snapshot bytes. It is a protocol identity/divergence primitive, not a signature or MAC. It detects accidental/cross-client state mismatch and file corruption when the checksum is not also maliciously rewritten; it does not authenticate an attacker who already controls the room-state file.

The file store therefore relies on host/storage access control, creates replacement files with mode `0600`, uses atomic replacement and fails closed after a durable write failure. Production backups/volumes should apply the deployment's encryption and access-control policy.

## Privacy, retention and deletion

Collaboration persistence contains mathematical configuration/state, event inputs, participant IDs and client-event IDs. It contains no authentication secret by design, but participant identifiers can still be personal/pseudonymous data and must be treated accordingly.

The generic file adapter does not invent a universal retention period. A deployment must define one based on the product's room lifecycle and legal/privacy requirements. `AuthoritativeRoomStateStore.delete()` provides the deletion primitive; operators must connect it to room deletion/expiry. Backups must follow the same retention intent.

Performance telemetry remains local-only by default and must not include formula/state contents, participant IDs, collaboration credentials or full room URLs unless a separate telemetry/privacy decision explicitly approves those fields.

## Failure and recovery operations

The current server is one authoritative process per room. Persistence is written before accepted events or ticks are acknowledged/broadcast. If storage becomes unavailable after a mutation, the unpersisted mutation stays local and unacknowledged, further mutations stop, and restart returns to the last durable record.

The file adapter is not a high-availability store. Running multiple writers against the same file is unsupported. A multi-instance service needs a transactional/shared persistence implementation plus an explicit single-writer/leader rule per room.

The 16 MiB default store ceiling turns unchecked history growth into an explicit failure instead of silent disk consumption. Long-lived rooms will need measured checkpoint/log compaction and an idempotency-retention policy before this limit is raised.

## Review result

The Stage 16 architecture satisfies its shared-experiment acceptance boundary: authenticated/authorized ordered input, deterministic scheduling, duplicate/out-of-order handling, cryptographic snapshot identity, divergence recovery, reconnect, real WebSocket delivery, durable restart recovery, bounded transport/input pressure and explicit deletion/failure semantics.

Stage 16 can therefore close for the repository's current single-authority scope. A production Internet deployment still has mandatory environment decisions: real identity/room-membership verification, TLS/WSS, browser Origin policy where applicable, retention duration, backup/encryption policy, monitoring/alerting and a transactional store/leader design before horizontal scaling.
