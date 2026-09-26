# Phase 1 report: Bindfly 2 scaffold

- Status: Complete
- Date: 2026-08-31
- Recovery base: `58ae600`
- Canonical requirements: `MIG-002`, `ARCH-003`, `ARCH-008`, `ARCH-009`

## Outcome

Bindfly 2 now has an isolated strangler scaffold with logical module ownership, an empty studio application boundary, strict independent TypeScript/lint gates, and executable import-boundary tests. No legacy source, route, entry point or runtime behavior changed.

## Added boundaries

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

These are logical modules, not physical packages. The future studio is intentionally not runnable in Phase 1.

## Enforcement

`tooling/check-v2-boundaries.mjs` rejects forbidden module directions, React imports from engine modules, imports from legacy `src`, imports leaving owned V2 roots, unknown V2 aliases, and garbage-drawer module names.

Contract tests prove:

1. Every allowed dependency direction passes.
2. Every forbidden source→target module pair fails.
3. React is rejected from every engine module.
4. A relative import into legacy `src` fails.
5. `shared`, `types` and `utils` roots fail.
6. Forbidden dynamic imports and `require()` calls fail.
7. Unknown V2 aliases and relative imports outside owned roots fail.

Independent gates:

- `tsconfig.v2.json`: strict checked TypeScript, `allowJs: false`, no emit, exact optional properties, unchecked-index protection, no implicit override and no unused declarations.
- `tooling/eslint-v2.cjs`: type-aware TypeScript rules, no explicit any, no floating/misused promises, no cycles.
- `pnpm v2:check`: boundaries → typecheck → lint → node tests.

## Package-manager compatibility finding

An initial `pnpm@11.6.0` declaration was rejected before installation because the existing lockfile and virtual store use lockfile format 6.0. The repository's `node_modules/.modules.yaml` records pnpm `8.15.4`, so Phase 1 pins that exact compatible manager. No dependency or lockfile regeneration was performed.

## Verification

| Requirement | Evidence | Result |
| --- | --- | --- |
| V2 dependency boundaries executable | `pnpm run v2:boundaries` | PASS |
| Empty V2 architecture type-checks | `pnpm run v2:typecheck` | PASS |
| Empty V2 architecture lints | `pnpm run v2:lint` | PASS |
| Boundary contract tests | `pnpm run v2:test` | PASS, 7/7 |
| Integrated V2 gate | `pnpm run v2:check` | PASS |
| Legacy production build remains runnable | `npm run build` | PASS |
| Legacy lint baseline preserved | `npm run lint` | expected FAIL, unchanged 25 errors + 1 warning |
| Legacy typecheck baseline preserved | `npx tsc --noEmit` | expected FAIL at recorded loader/particle boundaries |
| Legacy tests baseline preserved | `CI=true npm test -- --watchAll=false` | expected FAIL, no tests found across 51 files |

## Non-goals preserved

- No experiment/simulation/renderer/analyzer/runtime contracts yet.
- No Vite or React studio implementation.
- No legacy adapter, refactor or cleanup.
- No physical packages.
- No new route or deployment behavior.

## Rollback

Revert the Phase 1 scaffold commit. The accepted Phase 0 commit `58ae600` remains a complete recovery state.

## Next

Phase 2 may now introduce the smallest tested core contracts: experiment definition, simulation, clock, seeded RNG, viewport/input, parameter schema, renderer, analyzer, runtime lifecycle, registry/capabilities, state codec and immutable analysis snapshot. No sophisticated animation belongs in that phase.
