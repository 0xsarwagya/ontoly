# @0xsarwagya/ontoly-semantic

## Responsibility

`@0xsarwagya/ontoly-semantic` owns semantic generation and the Framework
Analyzer registry. It converts deterministic semantic inputs into graph facts
and framework-aware relationships. It does not own compiler lifecycle,
persistence, transport, or agent workflows.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-semantic
```

## API

- `generateCompilerArtifacts(project)` lowers semantic inputs into compiler facts.
- Framework analyzer registry and deterministic framework facts.
- Semantic relationship extraction for TypeScript and framework concepts.

## Example

```ts
import { generateCompilerArtifacts } from "@0xsarwagya/ontoly-semantic";

const artifacts = generateCompilerArtifacts(project);
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.2. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
