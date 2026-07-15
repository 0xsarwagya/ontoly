# @0xsarwagya/ontoly-mcp

Structured graph capabilities for AI agents consuming Ontoly.

This package is part of [Ontoly](https://github.com/0xsarwagya/ontoly), a TypeScript-native software intelligence engine that builds a deterministic Software Graph.

When an LLM-capable client uses Ontoly MCP, LLM Enhancement is mandatory. The MCP runtime stays deterministic and AI-free; the LLM-facing workflow must preserve evidence, confidence, and fallback rules.

## Responsibility

`@0xsarwagya/ontoly-mcp` owns MCP transport, tool schema validation, structured
errors, and exposure of existing capabilities to agent clients. It does not own
capability semantics, graph construction, parsing, or AI reasoning.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-mcp
```

## Status

Public Preview package for Ontoly v0.1.0-alpha.16. The public API is versioned with the Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.sarwagya.wtf)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
