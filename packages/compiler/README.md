# @0xsarwagya/ontoly-compiler

Repository discovery, graph build pipeline, and watch mode for Ontoly.

This package is part of [Ontoly](https://github.com/0xsarwagya/ontoly), a TypeScript-native software intelligence engine that builds a deterministic Software Graph.

## Responsibility

`@0xsarwagya/ontoly-compiler` owns repository discovery, compiler context,
pipeline execution, graph construction, build-time validation hooks, and watch
coordination. Language-specific frontends emit into compiler contracts; the
compiler does not own CLI UX, MCP transport, or high-level capability workflows.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-compiler
```

## Status

Public Preview package for Ontoly v0.1.0-alpha.19. The public API is versioned with the Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.sarwagya.wtf)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
