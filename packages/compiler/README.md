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
- `defaultCompilerPasses()` for the standard deterministic pipeline.

## Example

```ts
import { buildSoftwareGraph } from "@0xsarwagya/ontoly-compiler";

const graph = await buildSoftwareGraph({ root: process.cwd() });
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.5. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
