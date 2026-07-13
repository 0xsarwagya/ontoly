# Repository Audit

Generated for Sprint 7 alpha polish.

## Summary

The repository is cohesive enough for a public alpha. The strongest areas are
validation discipline, deterministic graph artifacts, and package boundaries. The
largest remaining maintainability issue is file size: several packages still use
single-file module layouts that should be split after alpha without changing
public APIs.

## Automated Scan

- TODO/FIXME/HACK/debugger markers in source, docs, examples, skills, and validation tools: `0`
- Direct `console.*` usage in packages, skills, docs, and validation tools: `0`
- Current validation lab release gate: `PASS`
- Semantic evaluation: Ontoly `100`, Graphify structural baseline `55.17`
- Validation corpus measured: `5/5`
- Aggregate graph size: `30,218` nodes and `62,521` edges

## Large Files

These files are candidates for post-alpha decomposition:

| File | Lines | Recommendation |
| --- | ---: | --- |
| `packages/typescript/src/index.ts` | 2115 | Split model types, AST collection, serialization, validation. |
| `packages/semantic/src/index.ts` | 2077 | Split framework registry, analyzers, semantic generation, helpers. |
| `packages/cli/src/cli.ts` | 1997 | Keep alpha CLI stable, then split commands and formatting helpers. |
| `packages/query/src/index.ts` | 1286 | Split indexes, traversal, stats, formatting-independent query primitives. |
| `packages/compiler/src/repository-intelligence/index.ts` | 754 | Split package/workspace, Docker, CI, scripts, and config analyzers. |
| `packages/analyzers/src/index.ts` | 733 | Split coverage metrics, diagnostics, reports, recommendations. |

## Dead Code

No obvious dead packages were found. Every workspace package contributes to one
of the active alpha surfaces:

- graph schema
- compiler
- TypeScript frontend
- OpenAPI frontend
- semantic generation
- analyzers
- query engine
- cache/artifacts
- CLI
- MCP
- Mermaid plugin

## Duplicate Logic

Observed duplication:

- Several validation scripts have local JSON, ranking, Markdown, and stdout
  helpers. This is acceptable for alpha tooling but should become a shared
  validation utility module before beta.
- CLI, validation lab, and semantic harness each format reports independently.
  This keeps runtime package dependencies simple but creates presentation
  duplication.
- Stable count and sort helpers exist in multiple files. Extract only when a
  second package needs identical behavior at runtime.

## API Consistency

Consistent patterns:

- Package names use `@0xsarwagya/ontoly-*`.
- Build APIs accept options objects.
- Graph/query APIs return deterministic arrays sorted by stable ids or labels.
- Diagnostics are graph-native and include stable codes.

Areas to watch:

- Some packages expose large `index.ts` surfaces. Public exports should be
  reviewed before v1.
- CLI output is now consistently routed through the CLI logger, but validation
  scripts still have their own simple stdout wrappers rather than a shared
  logger.

## Circular Imports

No circular import failures were observed in build, typecheck, or tests.

## Debug Logging And Temporary Code

- No `debugger` statements.
- No TODO/FIXME/HACK markers.
- CLI supports `--debug`, `--trace`, `--verbose`, `--log-json`, and `--no-color`.

## Naming

Naming is generally consistent:

- graph entities use Software Graph vocabulary
- validation uses repository/corpus/lab language
- CLI commands map to user workflows

Potential cleanup later:

- Normalize `coverage`, `trust`, and `trustworthiness` names across reports.
- Decide whether validation tools should use `repository` or `repo` internally.

## Recommendations

1. Keep alpha scope focused on validation, docs, and CLI predictability.
2. Defer large-file decomposition until after alpha to avoid unnecessary API
   churn.
3. Add linting for direct `console.*`, TODO markers, and large-file thresholds.
4. Promote validation script helpers into a shared `validation/tools/lib/` module
   once Sprint 8 introduces more lab tooling.
5. Before v1, freeze public exports from each package and document compatibility
   guarantees.
