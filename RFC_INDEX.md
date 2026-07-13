# RFC Index

Ontoly uses RFCs for every change that affects public graph, compiler, query, plugin, or type contracts.

| RFC | Status | Scope |
| --- | ------ | ----- |
| [0000](rfcs/0000-template.md) | Active | RFC template |
| [0001](rfcs/0001-software-graph.md) | Accepted | Software Graph Specification |
| [0002](rfcs/0002-compiler-pipeline.md) | Accepted | Compiler Pipeline |
| [0003](rfcs/0003-query-engine.md) | Accepted | Query Engine |
| [0004](rfcs/0004-plugin-and-compiler-pass-system.md) | Accepted | Plugin and Compiler Pass System |

## When to Write an RFC

Write an RFC before changing:

- Software Graph node, edge, diagnostic, metadata, serialization, or versioning semantics.
- Compiler stage responsibilities, invariants, failure handling, or extension points.
- Query traversal semantics, public API, indexing, or caching behavior.
- Plugin manifests, pass ordering, compatibility negotiation, or execution isolation.
- Public package types that downstream tools depend on.
