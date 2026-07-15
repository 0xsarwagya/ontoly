# Ontoly v0.1.0-alpha.17 Engineering Excellence Report

Generated: 2026-07-15

## Scope

This pass was an engineering-excellence audit with a behavior freeze.

The following areas were intentionally not changed:

- Compiler behavior
- Software Graph schema
- Semantic extraction
- Retrieval algorithms
- Ranking
- Capabilities
- MCP behavior
- Skills

## Result

Status: PASS

The only source cleanup applied was a private CLI deletion:

- Removed one unused `resolveIntent` import from `packages/cli/src/cli.ts`.
- Removed one unused private `graph` parameter from `boundedEdgeEvidenceItem`.

No public exports changed. No graph, retrieval, compiler, MCP, or Skills behavior changed.

## Metrics

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Runtime files measured | 49 | 49 | 0 |
| Runtime LOC | 26,188 | 26,186 | -2 |
| Runtime nonblank LOC | 23,180 | 23,178 | -2 |
| Documentation files measured | 403 | 404 | +1 |
| Documentation LOC | 23,820 | 23,984 | +164 |
| Documentation nonblank LOC | 17,778 | 17,902 | +124 |
| Public export statements | 385 | 385 | 0 |
| Named public exports | 346 | 346 | 0 |
| Default exports | 16 | 16 | 0 |
| Star exports | 19 | 19 | 0 |
| Function-like nodes | 2,101 | 2,101 | 0 |
| Average function length | 14.30 | 14.30 | 0 |
| Largest function | `plugins/html/src/index.ts:155 renderHtml` 1,559 lines | unchanged | 0 |
| Measured cyclomatic complexity reduction | 0 | 0 | 0 |
| Duplicate utilities removed | 0 | 0 | 0 |
| Dead private code removed | 0 | 2 | +2 |
| Files deleted | 0 | 0 | 0 |

## Lines Changed

| Area | Lines deleted | Lines added |
| --- | ---: | ---: |
| Runtime source | 3 | 1 |
| Documentation | 0 | 164 |
| Generated validation artifacts | 0 | 0 |

## Largest Functions

The largest runtime functions were left untouched because each candidate sits in behavior-sensitive code.

| Function | Lines | Decision |
| --- | ---: | --- |
| `plugins/html/src/index.ts:155 renderHtml` | 1,559 | Leave for a dedicated HTML renderer extraction pass. |
| `packages/cli/src/cli.ts:2100 defaultCliEnhancers` | 350 | Leave until enhancer CLI behavior has golden coverage around every generated artifact. |
| `packages/cli/src/cli.ts:4530 commandHelp` | 347 | Leave until CLI help text is snapshot-tested as a public contract. |
| `packages/semantic/src/index.ts:629 addSemanticFacts` | 347 | Do not touch during a no-semantic-change sprint. |
| `packages/compiler/src/pipeline/stages.ts:23 createDefaultStage` | 196 | Do not touch during a compiler behavior freeze. |

## Public API Audit

Public API surface stayed unchanged.

The audit found public-looking exports that may be intentionally public but deserve a v1 API review before RC:

- `packages/compiler/src/context/index.ts`
- `packages/compiler/src/graph/index.ts`
- `packages/compiler/src/passes/index.ts`
- `packages/compiler/src/pipeline/executor.ts`
- `packages/compiler/src/validation/index.ts`
- `packages/core/src/semantic-index.ts`

No exports were removed in this pass because accidental-public versus supported-public requires a compatibility decision.

## Duplicate Utility Audit

Duplicate candidates were found but not removed:

- Repeated ignore-directory lists in compiler repository discovery and TypeScript analysis.
- Repeated generic `push(map, key, value)` helpers in analyzers and query.
- Repeated dependency relationship lists in capabilities and query.
- Similar serialization helpers across CLI and MCP.

Decision: keep unchanged for alpha.17.

Reason: extracting these would introduce or alter shared utility boundaries. Under the alpha.17 behavior freeze, the safer Clean Code decision is to document the candidates and leave runtime behavior byte-compatible.

## Package Dependency Graph

Internal dependency graph remains acyclic.

```text
core -> none
analyzers -> core
cache -> core
diagnostics -> core
enhancer -> core
query -> core
typescript -> core
plugin-html -> core
plugin-mermaid -> core
compiler -> cache, core, diagnostics
capabilities -> core, query
semantic -> compiler, core, typescript
parser-openapi -> compiler, core
parser-typescript -> compiler, core, semantic, typescript
mcp -> capabilities, core, query
cli -> analyzers, cache, capabilities, compiler, core, enhancer, mcp, parser-openapi, parser-typescript, plugin-html, query, semantic, typescript
```

No package cycles were found.

## Validation

| Gate | Result |
| --- | --- |
| `pnpm check-types` | PASS |
| `pnpm test` | PASS, 25 files, 110 tests |
| `pnpm build` | PASS |
| `pnpm docs:check-links` | PASS |
| `pnpm docs:lint` | PASS |
| `pnpm license:check` | PASS |
| `pnpm validate:packages` | PASS, 16 packages |
| `pnpm skills:validate` | PASS, 14/14 skills |
| `pnpm skills:validate-installed` | PASS |
| `pnpm evaluate` | PASS, semantic score 100, regression PASS |
| `pnpm validate:ci` | PASS, 5/5 repositories measured, release gates PASS |
| `pnpm benchmark:performance` | PASS |
| Ovok 40-question retrieval benchmark | PASS, 40 pass, 0 partial, 0 fail, Top-1 38, Top-K 40, errors 0 |

## Retrieval Parity

Alpha.17 preserved the alpha.16 retrieval target:

```json
{
  "pass": 40,
  "partial": 0,
  "fail": 0,
  "top1": 38,
  "topK": 40,
  "errors": 0
}
```

## Conclusion

Alpha.17 is a behavior-preserving engineering sweep.

The repository audit found larger cleanup opportunities, but the only safe source deletion under the strict behavior freeze was unused private CLI code. Larger simplifications should be handled in targeted future passes with golden coverage for CLI help, HTML rendering, semantic extraction, and public API compatibility.
