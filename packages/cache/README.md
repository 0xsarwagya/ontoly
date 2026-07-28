# @0xsarwagya/ontoly-cache

## Responsibility

`@0xsarwagya/ontoly-cache` reads and writes local graph artifacts, indexes, and
cache metadata. It does not decide artifact meaning, perform graph construction,
run queries, or expose user-facing commands.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-cache
```

## API

- `persistGraph(graph, options)` writes canonical graph artifacts.
- `loadGraph(options)` reads graph artifacts from disk.
- `loadOrCreateSemanticIndex(options)` loads or derives the Semantic Index.
- `persistCompilerSnapshot(graph, options, manifest, products)` atomically
  commits the reusable graph and frontend products, publishing the manifest last.

## Example

```ts
import { loadGraph } from "@0xsarwagya/ontoly-cache";

const graph = await loadGraph({ root: process.cwd(), directory: ".ontoly" });
```

## Status

Stable v1.0.0 package. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
