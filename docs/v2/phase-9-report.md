# Phase 9 report: URL and state architecture

- Status: Complete
- Date: 2026-09-08
- Phase 8 base: `eecb7ca`

## Delivered

- Canonical, deterministic studio JSON format version 1.
- UTF-8 base64url URL encoding and 1,800-character budget policy.
- Strict atomic parsing and future/unknown-version rejection.
- Studio format version-0 migration.
- Five captured legacy Flying Lines preset migrations.
- Continuous durable URL synchronization, Copy link, JSON export and JSON import.
- Runtime/canvas remount after imported state.
- Explicit exclusion of ephemeral interaction and telemetry state.

## Verification

| Check | Result |
| --- | --- |
| V2 tests | PASS, 71/71 |
| Canonical JSON/base64url repeatability | PASS, including Unicode seed |
| URL round-trip | PASS; parameters, seed and runtime reproduced |
| Ephemeral-state exclusion | PASS |
| URL overflow → JSON | PASS |
| Malformed/future/unknown rejection | PASS without partial state |
| Format v0 migration | PASS |
| Legacy preset fixtures | PASS for all five captured Flying Lines URLs |
| Browser default URL canonicalization | PASS |
| Browser Copy link | PASS; accessible success status |
| Browser legacy Blank migration | PASS; 1 particle, converted values, canonical URL |
| Browser malformed URL | PASS; original URL retained, alert visible, defaults used |
| React Doctor | 80/100, zero errors; remaining six warnings non-blocking/older scope |
| V2 production build | PASS |
| Legacy production build | PASS |

## Exit criterion

Met. Experiment state is versioned and reproducible by URL or deterministic JSON; malformed and unknown versions fail atomically; captured legacy Flying Lines routes migrate; oversized state has a defined export/import path.

## Explicit deferrals

- Live simulation snapshots/event-log replay in exported state: later replay/collaboration phases.
- Legacy effects other than Flying Lines: Phase 10 migration.
- Browser-matrix automation and mobile import-file interaction: future CI; the underlying codec/import path is deterministically tested.

## Next

This original Phase 10 recommendation is superseded by the accepted Milestone B review. Stage 9.5 stabilizes PR #33 first; Stage 10A then proves generic composition with Drooping Lines in a fresh PR before Stage 10B extracts shared behavior.
