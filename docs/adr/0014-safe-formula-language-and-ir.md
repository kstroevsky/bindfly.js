# ADR 0014: Safe scalar formula language and canonical IR

- Status: Accepted
- Date: 2026-09-19
- Stage: 11 — Formula engine
- Depends on: ADR 0012, ADR 0013

## Decision

Bindfly formulas are data, never JavaScript. Stage 11 introduces a dependency-free pipeline:

```text
source → tokenizer → typed AST → semantic validation → canonical stack IR → deterministic interpreter
```

The initial grammar supports finite decimal/scientific numbers, explicitly allowed variables, parentheses, unary `+`/`-`, binary `+ - * / ^`, and these functions:

```text
sin cos tan atan exp log abs sqrt min max
```

`^` is right-associative. Unary signs bind outside exponentiation, so `-2^2` means `-(2^2)`. Single-argument functions require exactly one argument; `min` and `max` require exactly two.

The AST is immutable and discriminated. Semantic validation rejects unknown variables, unknown functions, invalid arity and invalid identifiers. Compilation emits version-1 stack instructions with variables resolved to indices in a sorted canonical allowlist. The interpreter executes instructions through explicit switches; it never uses `eval`, `Function`, dynamic import, property access or arbitrary calls.

Every intermediate and final number must be finite. Division by zero, invalid powers, `log(x <= 0)`, `sqrt(x < 0)`, non-finite variables and non-finite function results fail explicitly.

## Frozen default budgets

| Budget | Default |
| --- | ---: |
| Source characters | 4,096 |
| Tokens | 1,024 |
| AST nodes | 512 |
| AST depth | 64 |
| Interpreter operations | 4,096 |

Limits may be reduced by a caller but may not exceed these engine defaults in serialized programs. Tokenization and parsing stop at the first bounded structured issue; they do not attempt error recovery over hostile input.

## Versioning and canonical serialization

Serialized programs use format `bindfly-formula` version 1 and contain source, sorted variable allowlist and operation limit. Parsing serialized state recompiles the source and reconstructs canonical IR rather than trusting supplied instructions. Unknown/future formats and versions fail atomically.

A 2D transform is two scalar programs evaluated against one finite scope. Formula-experiment configuration values are sorted, finite, declared variables and override same-named runtime scope values. This is enough to encode `x′ = tan(x)` and `y′ = atan(y)` without prematurely defining vector fields, maps or formula morphing.

## Explicit non-goals

- JavaScript syntax or arbitrary JavaScript execution.
- Assignment, mutation, statements, loops, recursion or user-defined functions.
- Strings, arrays, objects, property access or member calls.
- Implicit globals or built-in constants.
- JIT compilation, WebAssembly or GPU code generation.
- Formula morphing/interpolation semantics.

Those require later typed contracts and backend-conformance evidence.

## Consequences

- Formula execution is deterministic for a build, scope and serialized program.
- CSP can forbid dynamic code generation without breaking the interpreter.
- `atan` is available before Drooping Lines moves to formula IR in Stage 12.
- Future execution backends must match the interpreter’s golden fixtures and error behavior.

## Rollback

Remove the Stage 11 formula module and this ADR. Stage 10B experiments continue to use typed hardcoded derivations.
