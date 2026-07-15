# @0xsarwagya/ontoly-capabilities

Deterministic software engineering capabilities over the Ontoly Software Graph.

This package owns high-level reasoning such as impact analysis, repository
summary, request tracing, ownership, configuration usage, and implementation
planning. It contains no compiler logic, parser logic, CLI behavior, MCP
transport, LLM calls, embeddings, vector search, or code generation.

`EvidencePack` is the compact graph-backed payload for agent workflows. It is a
capability over existing Ontoly artifacts, not a separate router package.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-capabilities
```

## Status

Public Preview package for Ontoly v0.1.0-alpha.19. The public API is versioned with the
Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.sarwagya.wtf)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
