# @0xsarwagya/ontoly-plugin-html

## Responsibility

`@0xsarwagya/ontoly-plugin-html` renders existing Software Graph input into an
offline HTML artifact. It does not build graphs, run the query engine, change
compiler behavior, or expose MCP transport.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-plugin-html
```

## API

- `createInteractiveHtmlArtifact(graph, options)` renders the offline Software Graph Explorer.
- Architecture-first HTML graph payload and deterministic static asset generation.

## Example

```ts
import { createInteractiveHtmlArtifact } from "@0xsarwagya/ontoly-plugin-html";

const artifact = createInteractiveHtmlArtifact(graph, { title: "Software Graph" });
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.3. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
