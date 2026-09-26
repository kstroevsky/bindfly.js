# ADR 0009: Versioned studio state and legacy URL migration

- Status: Accepted
- Date: 2026-09-08
- Phase: 9 — URL/state architecture
- Depends on: ADR 0002, ADR 0008

## Decision

The canonical studio document is `bindfly-studio` format version 1. It contains a versioned experiment envelope, the experiment codec payload, renderer ID and runtime choice. Parameters and seed are durable. Pause, readiness, telemetry, hover, drag, frame counters and analysis results are explicitly excluded.

Canonical JSON recursively sorts object keys, rejects non-finite/unsupported/cyclic values, and is encoded as unpadded UTF-8 base64url in query parameter `s`. A share URL is used only when it is at most 1,800 characters; larger state produces deterministic JSON with an explicit reason.

Parsing is all-or-nothing. Unknown format, unsupported studio/experiment version, invalid base64url/UTF-8/JSON, unsupported experiment/renderer/runtime and invalid parameters are rejected without partially applying state. The malformed URL remains visible until the user makes a valid durable change.

Studio format version 0 migrates into version 1. The five Phase 0 Flying Lines URL fixtures migrate explicitly: Simple, SwitchColor, Monochrome&Clickable, AddByClick and Blank. Legacy speed in pixels/frame is converted to CSS pixels/second using the frozen 120 Hz timing contract. Unknown legacy presets/effects are not guessed.

The React studio continuously replaces browser history with canonical durable state, supports Copy link, deterministic JSON export and validated JSON import. Import remounts the selected runtime/canvas with the imported seed and parameters.

## Consequences

- Reproducible state now survives reload and runtime selection.
- Runtime switching no longer requires a separate `runtime` query parameter; the parser still accepts the Phase 7 convention when no canonical state exists.
- JSON import/export is the overflow path and future large-state interchange format.
- Adding a state version requires an explicit migration or rejection path.

## Rollback

Revert the Phase 9 commit. Phase 8 remains runnable with non-reproducible in-memory studio choices.
