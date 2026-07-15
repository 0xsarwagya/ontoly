# @0xsarwagya/ontoly-analyzers

## Responsibility

`@0xsarwagya/ontoly-analyzers` evaluates existing Software Graphs for semantic
coverage and graph quality. It does not build graphs, mutate graph artifacts,
own query semantics, or expose transport protocols.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-analyzers
```

## API

- Semantic coverage and graph quality report builders.
- Framework and graph-trust summaries over existing Software Graphs.

## Example

```ts
import { analyzeSemanticCoverage } from "@0xsarwagya/ontoly-analyzers";

const report = analyzeSemanticCoverage(graph);
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.1. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
