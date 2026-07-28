# @0xsarwagya/ontoly-parser-typescript

## Responsibility

`@0xsarwagya/ontoly-parser-typescript` is Ontoly's JavaScript and TypeScript
compiler frontend. It uses the TypeScript Compiler API to emit language-aware
compiler symbols and relationships for ESM, CommonJS, JSX, and TypeScript. It
does not own graph storage, query APIs, MCP transport, CLI commands, or generic
framework policy.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-parser-typescript
```

## API

- JavaScript and TypeScript frontend pass factory.
- Compiler-symbol emission and relationship extraction through the TypeScript Compiler API.
- Static ESM, dynamic `import()`, `require()`, `module.exports`, and `exports.*` support.

## Example

```ts
import { createTypeScriptFrontendPass } from "@0xsarwagya/ontoly-parser-typescript";

const pass = createTypeScriptFrontendPass();
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.22. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
