# @0xsarwagya/ontoly-query

## Responsibility

`@0xsarwagya/ontoly-query` owns deterministic lookup, traversal, dependency,
path, and statistics operations over the Software Graph. It does not parse
repositories, persist artifacts, run high-level capabilities, or expose MCP
transport.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-query
```

## API

- `createQueryEngine(graph)` creates deterministic lookup and traversal APIs.
- Callers, callees, dependencies, dependents, routes, services, models, and path queries.

## Example

```ts
import { createQueryEngine } from "@0xsarwagya/ontoly-query";

const query = createQueryEngine(graph);
const callers = query.callers("method:src/auth.ts:AuthService.login");
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.5. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
