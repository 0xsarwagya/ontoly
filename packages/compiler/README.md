# @0xsarwagya/ontoly-compiler

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

## API

- `buildSoftwareGraph(options)` compiles a repository to a Software Graph.
- Compiler context, passes, pipeline stages, graph builder, and validation hooks.
- Incremental graph and frontend-product snapshots with exact source invalidation.
- Per-stage progress, timing, and bounded deterministic task execution.
- JavaScript/TypeScript incremental-builder reuse for watch mode and resident runners.
- `defaultCompilerPasses()` for the standard deterministic pipeline.

## Example

```ts
import { buildSoftwareGraphWithArtifacts } from "@0xsarwagya/ontoly-compiler";

const result = await buildSoftwareGraphWithArtifacts({
  root: process.cwd(),
  mode: "incremental",
  cache: true,
  workers: 8,
  onProgress: ({ stage, phase }) => console.log(stage, phase),
});

console.log(result.cache.hit, result.profile.durationMs);
```

## Status

Stable v1.0.0 package. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.xyz)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
