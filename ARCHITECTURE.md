# Architecture

Ontoly turns a repository into a deterministic Software Graph.

```text
Repository
  -> discovery
  -> frontends
  -> compiler pipeline
  -> semantic generation
  -> Software Graph
  -> indexes and query engine
  -> capabilities, MCP, enhancers, validation, skills, and plugins
```

## Package Responsibilities

Each package has one primary reason to change.

| Package | Owns | Does not own |
| --- | --- | --- |
| `@0xsarwagya/ontoly-core` | Software Graph schema, stable IDs, graph helpers, graph validation primitives, and shared graph/index data structures. | Repository discovery, parsing, compiler orchestration, transport, CLI behavior, or plugin rendering. |
| `@0xsarwagya/ontoly-compiler` | Repository discovery, compiler context, pipeline execution, graph construction, build-time validation hooks, and watch-mode coordination. | Language-specific AST ownership, high-level capabilities, MCP transport, CLI UX, or rendered artifacts. |
| `@0xsarwagya/ontoly-parser-typescript` | TypeScript frontend integration, compiler-symbol emission, and TypeScript relationship extraction. | Graph storage, query APIs, MCP transport, CLI commands, or generic framework policy. |
| `@0xsarwagya/ontoly-parser-openapi` | OpenAPI frontend integration and OpenAPI graph facts. | TypeScript parsing, graph storage, query APIs, or rendered artifacts. |
| `@0xsarwagya/ontoly-typescript` | Pure TypeScript Semantic Model analysis. | Graph construction, framework registry ownership, CLI behavior, or MCP transport. |
| `@0xsarwagya/ontoly-semantic` | Semantic generation and Framework Analyzer registry. | Compiler lifecycle, persistence, transport, or agent workflows. |
| `@0xsarwagya/ontoly-query` | Deterministic Software Graph lookup, traversal, dependency, path, and statistics queries. | Natural-language capability workflows, MCP transport, persistence, or parsing. |
| `@0xsarwagya/ontoly-capabilities` | Deterministic software-engineering capabilities over existing graph artifacts, including evidence packs and implementation planning. | Compiler logic, parser logic, transport, CLI UX, LLM calls, embeddings, vector search, or code generation. |
| `@0xsarwagya/ontoly-mcp` | MCP transport, tool schema validation, and capability exposure for agents. | Capability semantics, graph construction, parsing, or AI reasoning. |
| `@0xsarwagya/ontoly-enhancer` | Enhancer API, artifact model, deterministic enhancer pipeline, manifests, and enhancer validation helpers. | Repository parsing, Software Graph mutation, runtime capability semantics, or rendered plugin output. |
| `@0xsarwagya/ontoly-cache` | Local persistence and cache access for graph artifacts and indexes. | Artifact semantics, graph construction, query behavior, or transport. |
| `@0xsarwagya/ontoly-diagnostics` | Shared diagnostic constructors and diagnostic shape consistency. | Running analyzers, compiler passes, transport, or report rendering. |
| `@0xsarwagya/ontoly-analyzers` | Semantic coverage and graph quality analysis over existing graphs. | Compiler behavior, graph mutation, query engine ownership, or MCP transport. |
| `@0xsarwagya/ontoly-cli` | Command-line orchestration, user prompts, command output, release validation commands, and public convenience entrypoints. | Package-internal semantics owned by compiler, query, capabilities, MCP, enhancers, or plugins. |
| `@0xsarwagya/ontoly-plugin-html` | Self-contained HTML Software Graph Explorer artifacts. | Graph construction, query engine semantics, compiler behavior, or MCP transport. |
| `@0xsarwagya/ontoly-plugin-mermaid` | Mermaid diagram artifacts from Software Graph input. | Graph construction, query engine semantics, compiler behavior, or MCP transport. |

## Dependency Direction

- Library packages depend inward toward `@0xsarwagya/ontoly-core`.
- Frontends depend on the compiler contracts they emit into, not on the CLI.
- The query engine reads graph contracts; capabilities compose query behavior.
- MCP exposes capabilities through transport boundaries; it does not redefine them.
- Enhancers consume immutable Ontoly artifacts and produce new artifacts.
- Plugins render artifacts from graph input and do not participate in graph construction.
- The CLI is the composition boundary for user-facing workflows and may depend on the other packages.

## Principles

- Build understanding, not AI.
- The graph is deterministic for identical input.
- Relationships must have provenance.
- Downstream packages consume graph contracts, not compiler internals.
- Public contracts change through RFCs.

See [docs/index.mdx](docs/index.mdx), [docs/graph.md](docs/graph.md), and [rfcs/0002-compiler-pipeline.md](rfcs/0002-compiler-pipeline.md).
