# @0xsarwagya/ontoly-plugin-mermaid

## Responsibility

`@0xsarwagya/ontoly-plugin-mermaid` renders existing Software Graph input into
Mermaid diagrams. It does not build graphs, run the query engine, change
compiler behavior, or expose MCP transport.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-plugin-mermaid
```

## API

- Mermaid graph rendering helpers for existing Software Graphs.
- Deterministic Mermaid string output for documentation and reports.

## Example

```ts
import { createMermaidDiagram } from "@0xsarwagya/ontoly-plugin-mermaid";

const diagram = createMermaidDiagram(graph);
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.2. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
