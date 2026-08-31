# ADR 0001: Bindfly 2 strangler and logical module boundaries

- Status: Accepted
- Date: 2026-08-31
- Phase: 1 — Scaffold Bindfly 2
- Recovery base: `58ae600` (`docs: establish Bindfly 2 plan and legacy baseline`)

## Context

The legacy application couples routing, async animation loaders, preset visibility, React hooks, Canvas lifecycle, worker commands and mutable effect classes. Phase 0 recorded that the legacy production bundle builds while its standalone typecheck, lint and test gates fail.

The canonical plan requires Bindfly 2 to grow beside the old application, with engine code independent from React and from legacy hooks/types. It also forbids package proliferation before two consumers or a real build/deploy boundary exist.

## Decision

Use a strangler layout with logical TypeScript modules:

```text
apps/studio/src
src-v2/core
src-v2/formula
src-v2/effects
src-v2/rendering
src-v2/runtime
src-v2/analysis
src-v2/benchmarks
```

`apps/studio` is the future UI ownership boundary. It is not yet a runnable application or workspace package. The directories under `src-v2` are logical modules, not separately published packages.

The pnpm workspace envelope is declared now, but physical package manifests are deferred until the canonical extraction gate is met. pnpm `8.15.4` is pinned because the existing virtual store records that version and uses lockfile format 6.0.

## Dependency policy

| Source | Allowed V2 dependencies | React allowed | Legacy `src` allowed |
| --- | --- | --- | --- |
| core | none | no | no |
| formula | core | no | no |
| effects | core, formula | no | no |
| rendering | core | no | no |
| runtime | core | no | no |
| analysis | core | no | no |
| benchmarks | core, formula, effects, rendering, runtime, analysis | no | no |
| studio | all V2 modules | yes | no |

`shared`, `types` and `utils` are forbidden logical module names.

## Enforcement

`tooling/check-v2-boundaries.mjs` parses TypeScript import/export/import-type/dynamic-import/require specifiers with the TypeScript compiler API. It rejects:

- every dependency direction outside the table;
- React imports from engine modules;
- relative or aliased imports into the legacy `src` tree;
- relative imports that leave owned V2 roots;
- unknown `@bindfly-v2/*` modules;
- `shared`, `types` or `utils` roots.

The checker has contract tests covering the full forbidden source→target matrix and each isolation rule.

`tsconfig.v2.json` and `tooling/eslint-v2.cjs` provide independent strict type and lint gates. `pnpm v2:check` runs boundaries, typecheck, lint and tests without invoking the failing legacy gates.

## Non-goals

- No Bindfly 2 domain contracts; those belong to Phase 2.
- No React/Vite studio application; the UI is Phase 8.
- No legacy code cleanup or adapter layer.
- No physical packages.
- No new runtime behavior or route.

## Consequences

Positive:

- Phase 2 code cannot accidentally grow inside React or the legacy architecture.
- Dependency direction is executable rather than documentary.
- New code has green gates independent of known legacy failures.
- The legacy build remains the fallback and rollback target.

Costs:

- The policy checker is repository-specific and must evolve through ADRs when legitimate boundaries change.
- The empty module files intentionally provide ownership only; they are not evidence that any domain architecture works yet.

## Rollback

Revert the Phase 1 scaffold commit. No legacy source, route, bundle entry or runtime state is changed, so `58ae600` remains the complete pre-scaffold recovery point.
