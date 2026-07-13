# Architecture

Ontoly turns a repository into a deterministic Software Graph.

```text
Repository
  -> discovery
  -> language frontend
  -> compiler passes
  -> semantic generation
  -> Software Graph
  -> Query Engine
  -> MCP, validation, skills, and plugins
```

## Packages

- `@0xsarwagya/ontoly-core`: Software Graph types, stable IDs, graph helpers, validation primitives.
- `@0xsarwagya/ontoly-compiler`: repository discovery, compiler context, pipeline execution, graph construction.
- `@0xsarwagya/ontoly-parser-typescript`: TypeScript frontend and relationship extraction.
- `@0xsarwagya/ontoly-typescript`: pure TypeScript Semantic Model.
- `@0xsarwagya/ontoly-semantic`: semantic generation and Framework Analyzer registry.
- `@0xsarwagya/ontoly-query`: deterministic graph lookup, traversal, and dependency queries.
- `@0xsarwagya/ontoly-mcp`: structured graph capabilities for agent integrations.
- `@0xsarwagya/ontoly-cli`: command-line interface and release validation commands.
- `@0xsarwagya/ontoly-cache`: local graph artifact persistence.
- `@0xsarwagya/ontoly-diagnostics`: shared diagnostic constructors.
- `@0xsarwagya/ontoly-analyzers`: semantic coverage and graph quality analyzers.

## Principles

- Build understanding, not AI.
- The graph is deterministic for identical input.
- Relationships must have provenance.
- Plugins consume graph contracts, not compiler internals.
- Public contracts change through RFCs.

See [docs/index.mdx](docs/index.mdx), [docs/graph.md](docs/graph.md), and [rfcs/0002-compiler-pipeline.md](rfcs/0002-compiler-pipeline.md).
