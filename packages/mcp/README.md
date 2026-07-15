# @0xsarwagya/ontoly-mcp

## Responsibility

`@0xsarwagya/ontoly-mcp` owns MCP transport, tool schema validation, structured
errors, and exposure of existing capabilities to agent clients. It does not own
capability semantics, graph construction, parsing, or AI reasoning.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-mcp
```

## API

- `createMcpRuntime(graph, options)` exposes deterministic MCP capabilities.
- Capability schemas, input validation, structured errors, and tool execution helpers.

## Example

```ts
import { createMcpRuntime } from "@0xsarwagya/ontoly-mcp";

const runtime = createMcpRuntime(graph);
const stats = await runtime.execute({ capability: "GraphStatistics", input: {} });
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.3. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
