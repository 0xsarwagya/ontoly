# @0xsarwagya/ontoly-plugin-html

Software Graph Explorer plugin for Ontoly Software Graphs.

This package emits a self-contained HTML explorer with architecture-first modes,
search navigation, grouped filters, node relationship details, trace focus, and
a minimap. It works offline and does not use a CDN or external runtime.

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

## Usage

```ts
import { createInteractiveHtmlArtifact } from "@0xsarwagya/ontoly-plugin-html";

const artifact = createInteractiveHtmlArtifact(graph, {
  title: "Software Graph",
  maxEdges: 500,
});

await writeFile(artifact.path, artifact.contents);
```

The Ontoly CLI can also render the same artifact:

```bash
ontoly graph --format html > graph.html
ontoly architecture --format html > architecture.html
```

## Status

Public Preview package for Ontoly v0.1.0-alpha.19. The public API is versioned with the Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.sarwagya.wtf)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
