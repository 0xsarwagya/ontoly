# @0xsarwagya/ontoly-core

Software Graph schema, stable IDs, indexes, and graph helpers for Ontoly.

This package is part of [Ontoly](https://github.com/0xsarwagya/ontoly), a TypeScript-native software intelligence engine that builds a deterministic Software Graph.

## Responsibility

`@0xsarwagya/ontoly-core` is the innermost package. It owns Software Graph
contracts, stable IDs, graph helpers, graph validation primitives, and shared
graph/index data structures. It does not discover repositories, parse source,
run the compiler pipeline, expose transport, or render artifacts.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-core
```

## Status

Public Preview package for Ontoly v0.1.0-alpha.18. The public API is versioned with the Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.sarwagya.wtf)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
