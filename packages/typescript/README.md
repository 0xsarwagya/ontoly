# @0xsarwagya/ontoly-typescript

## Responsibility

`@0xsarwagya/ontoly-typescript` owns the pure TypeScript Semantic Model analysis.
It describes TypeScript language semantics without owning graph construction,
framework analyzer registration, CLI behavior, or MCP transport.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-typescript
```

## API

- `analyzeTypeScriptProject(options)` builds the pure TypeScript Semantic Model.
- Serializable TypeScript symbol, call, import, export, and decorator facts.

## Example

```ts
import { analyzeTypeScriptProject } from "@0xsarwagya/ontoly-typescript";

const model = analyzeTypeScriptProject({ root: process.cwd() });
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.2. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
