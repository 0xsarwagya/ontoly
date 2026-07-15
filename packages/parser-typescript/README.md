# @0xsarwagya/ontoly-parser-typescript

## Responsibility

`@0xsarwagya/ontoly-parser-typescript` is the TypeScript compiler frontend. It
uses the TypeScript Compiler API to emit compiler symbols and TypeScript
relationships. It does not own graph storage, query APIs, MCP transport, CLI
commands, or generic framework policy.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-parser-typescript
```

## API

- TypeScript frontend pass factory.
- Compiler-symbol emission and TypeScript relationship extraction through the TypeScript Compiler API.

## Example

```ts
import { createTypeScriptFrontendPass } from "@0xsarwagya/ontoly-parser-typescript";

const pass = createTypeScriptFrontendPass();
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.1. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
