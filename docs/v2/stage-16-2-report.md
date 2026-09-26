# Stage 16.2 — recovery-edge and client idempotency hardening

Stage 16.2 is the final narrow correctness pass over the Stage 16 shared-experiment milestone. It keeps the Stage 16/16.1 architecture intact and closes restart-rollback, event scheduling, client idempotency, WAL crash-tail and Studio boundary-ordering edge cases found by post-implementation audit.

## Authoritative rollback recovery

The file-store durability contract intentionally permits simulation time to roll back to the latest checkpoint while retaining every acknowledged event in the WAL. A client that was connected before the crash may therefore legitimately report a step/applied sequence ahead of the restored checkpoint.

Resume now distinguishes that expected rollback case from an impossible client history:

```text
client lastAppliedSequence > durable logHeadSequence
    → AHEAD_OF_AUTHORITY

client step/applied state ahead of restored checkpoint
but client sequence <= durable log head
    → authoritative snapshot rollback + WAL suffix
```

The regression fixture advances a replica beyond the durable checkpoint, recovers the authority from the older checkpoint plus WAL, resumes the same replica, verifies that it rolls backward through `resynchronize()`, then advances both sides through the retained WAL event and checks exact convergence.

## Monotonic scheduling after rollback

A recovered authority can contain durable future events whose scheduled boundary is ahead of the restored simulation step. New events must never receive an earlier boundary merely because the checkpoint rolled back.

Scheduling is therefore defined as:

```text
scheduledStep = max(currentStep + inputLeadSteps, lastEventScheduledStep)
```

This preserves the sequence-to-boundary monotonicity invariant before and after recovery. Per-participant input quotas are now keyed by the scheduled authoritative boundary, which is reconstructible from the WAL and directly bounds work applied at one boundary.

Recovery reconstructs those scheduled-boundary counters from the authoritative event log. A regression fixture proves that a room recovered at step 0 with an existing future event at step 6 schedules the next sequence at step 6 as well, and that the resulting persistence state remains recoverable.

## Client event identity and ambiguous acknowledgements

`SharedExperimentClient` now creates a cryptographically random client-instance namespace with `crypto.randomUUID()` and combines it with a monotonic local counter. A new page/client instance therefore cannot reuse another instance's `(participantId, clientEventId)` pair.

The client also retains one in-flight proposal as an outbox entry until a definitive `submit-result` is received. A transport close no longer discards an ambiguously committed proposal. After reconnect/resume, the exact same proposal is resent with the same `clientEventId`:

```text
submit X
→ WAL commit
→ connection dies before submit-result
→ reconnect + resume
→ resend exact X / same clientEventId
→ duplicate=true if already committed, otherwise accept once
```

The integration fixture deliberately suppresses the submit result after the authority commits the event, terminates the socket, reconnects the real `SharedExperimentClient`, and verifies that the pending promise resolves as an idempotent duplicate without adding a second event. It then constructs a fresh client for the same participant and verifies that its first logical action receives a distinct client event ID and a new authoritative sequence.

The in-memory outbox survives reconnects within one client instance. Persisting ambiguous intents across a full browser/page restart remains optional future product work; the random per-instance namespace already prevents cross-instance ID collisions.

## WAL crash semantics

The first WAL creation now fsyncs both the WAL file and its containing directory before `appendEvent()` returns, so the acknowledged-event durability contract covers the newly created directory entry as well as file contents.

WAL records are newline-terminated. Recovery treats only newline-terminated records as complete. A final unterminated fragment is considered an unacknowledged crash-torn tail, is removed after the complete prefix has passed normal sequence/canonical/hash-chain verification, and the WAL is fsynced after truncation. Any complete record with malformed content, a broken previous hash or a wrong event hash still fails closed.

A regression writes one valid durable record plus a truncated JSON tail and verifies recovery preserves the complete record and repairs the WAL to exactly that validated prefix.

## Studio boundary preflight

`CollaborationReplica` now exposes a non-mutating `canAdvanceStepIndex()` check. `SharedExperimentClient` calls it before `session.step()` so a missing authoritative event prefix cannot mutate the mathematical session and only then discover that crossing the boundary was illegal. `advanceStepIndex()` reuses the same validation before committing the replica boundary and applying due inputs.

This keeps the existing boundary order:

```text
verify required authoritative prefix
→ simulate step N
→ commit boundary N+1
→ apply inputs scheduled for N+1
```

## E2E flake hardening

The prior CI run for the ordinary Chromium Studio suite ultimately passed all 16 tests but one Probe/worker test required a retry. The test was racing the asynchronous runtime replacement: the runtime selector could already display `worker` while the new controller was not yet ready to answer the first Probe request.

The Probe fixture now waits by polling the actual inspection outcome while Probe remains enabled, rather than assuming the controller is ready immediately after the selector changes. The previously flaky test passes 10/10 repeated local executions. CI also sets Playwright `failOnFlakyTests`, so a retry can no longer silently produce a green verification job.

## Verification

Final local verification on 2026-09-26:

- `pnpm run v2:check`: 218/218 tests passed; dependency boundaries, TypeScript and ESLint clean;
- targeted Probe worker/main E2E: 10/10 repeated executions passed;
- `pnpm run v2:e2e`: 16/16 Chromium Studio E2E tests passed without retry;
- `pnpm run v2:e2e:stage16-cross-browser`: 3/3 recovery projects passed (Chromium, Firefox, WebKit);
- `pnpm run v2:build`: passed;
- `pnpm run build`: passed;
- `git diff --check`: passed.

## Authoritative step transaction

The reference WebSocket server now exposes `runAuthoritativeStep()`. The host still supplies the experiment-specific fixed-step callback, but the server invokes it inside the same serialized operation queue used for resume, submit, checkpoint and sync-point work. Reference hosts/tests no longer perform `simulation.step(...)` followed by a separate public server boundary call.

One queued authoritative step is:

```text
simulate fixed step
→ advance collaboration boundary
→ checkpoint / sync-point work
→ publish authoritative tick
```

Resume/snapshot traffic cannot observe the interval between mathematical simulation mutation and collaboration metadata advancement. If the simulation callback or boundary/checkpoint work fails, the authority fails closed: active sockets are terminated and further authoritative operations require restart/recovery.

Stage 16.2 changes no simulation, formula, renderer, analyzer or generic experiment ownership boundary. It completes the single-authority repository milestone with explicit handling for checkpoint rollback, retained future WAL events, ambiguous client acknowledgements, crash-torn WAL tails and authoritative-step serialization. Production wall-clock scheduling, identity, TLS/WSS, retention/backup policy and horizontally scaled transactional storage/leadership remain deployment concerns.
