# @0xsarwagya/ontoly-typescript

## Responsibility

`@0xsarwagya/ontoly-typescript` owns the pure JavaScript and TypeScript Semantic
Model analysis. It uses the TypeScript Compiler API for both languages without
owning graph construction, framework analyzer registration, CLI behavior, or
MCP transport.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-typescript
```

## API

- `analyzeTypeScriptProject(options)` builds the pure ECMAScript Semantic Model.
- `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts` discovery.
- Serializable symbol, call, ESM/CommonJS import, export, and decorator facts.
- `sourceLanguageForPath(path)` reports JavaScript or TypeScript provenance.

## Example

```ts
import { analyzeTypeScriptProject } from "@0xsarwagya/ontoly-typescript";

const model = analyzeTypeScriptProject({ root: process.cwd() });
```

## Status

Stable v1.0.0 package. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.xyz)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
