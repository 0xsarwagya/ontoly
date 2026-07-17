# @0xsarwagya/ontoly-core

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

## API

- Software Graph node, edge, diagnostic, metadata, and index types.
- Stable ID helpers and graph utility functions.
- Semantic Index primitives shared by CLI, capabilities, and validation.

## Example

```ts
import { createNodeId, createSemanticIndex } from "@0xsarwagya/ontoly-core";

const id = createNodeId("Function", "src/auth.ts", "login");
const index = createSemanticIndex(graph);
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.5. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
