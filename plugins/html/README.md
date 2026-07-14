# @0xsarwagya/ontoly-plugin-html

Software Graph Explorer plugin for Ontoly Software Graphs.

This package emits a self-contained HTML explorer with architecture-first modes,
search navigation, grouped filters, node relationship details, trace focus, and
a minimap. It works offline and does not use a CDN or external runtime.

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

Alpha package for Ontoly v0.1.0-alpha.13. The public API is versioned with the Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
