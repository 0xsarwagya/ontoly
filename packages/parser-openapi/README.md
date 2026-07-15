# @0xsarwagya/ontoly-parser-openapi

## Responsibility

`@0xsarwagya/ontoly-parser-openapi` is the OpenAPI frontend. It turns OpenAPI
documents into compiler facts and OpenAPI graph relationships. It does not own
TypeScript parsing, graph persistence, query semantics, or rendered artifacts.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-parser-openapi
```

## API

- OpenAPI frontend pass factory.
- OpenAPI route, operation, model, field, and relationship fact extraction.

## Example

```ts
import { createOpenApiFrontendPass } from "@0xsarwagya/ontoly-parser-openapi";

const pass = createOpenApiFrontendPass();
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.3. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
