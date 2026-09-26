# ADR 0018: Formula provenance inspection and export

- Status: accepted
- Stage: 12 — Formula-backed Bindfly Originals

## Context

Formula source text reproduces an edited experiment but does not prove which preserved legacy artifact supplied an original. Stage 12 requires frozen source provenance to be visible laboratory content. Adding the full provenance record to every URL would consume the deliberately bounded URL budget and duplicate immutable catalog data.

## Decision

Formula-backed Studio plugins expose immutable provenance entries containing the original ID, format version, legacy path, Git blob and captured behavior. The generic Inspector renders those entries without experiment-specific branches.

The Export JSON action writes a separate `bindfly-studio-export` version 1 envelope containing the existing durable configuration plus the plugin provenance manifest. Reproducible URLs continue to use the existing compact `bindfly-studio` document unchanged. Import accepts both the new export envelope and older raw configuration JSON.

An export envelope is trusted only when its provenance canonicalizes exactly to the manifest registered by the selected plugin. Missing, malformed or altered provenance rejects the import rather than silently relabeling the formulas. Source-file tests independently recompute the Git blob commitments.

## Consequences

- Researchers can inspect and retain exact source attribution alongside a saved experiment.
- URL size and URL compatibility do not change.
- Export provenance is an integrity commitment, not user-editable metadata.
- Updating an original requires an explicit catalog/version change and corresponding export migration decision.

## Rollback

Revert the export envelope and Inspector section. Raw `bindfly-studio` configuration import remains the compatibility floor.
