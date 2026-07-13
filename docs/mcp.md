# MCP

Ontoly MCP exposes deterministic capabilities backed by the Query Engine.

The MCP runtime does not expose raw graph mutation and does not parse source.
Every capability reads from `SoftwareGraph`.

```ts
import { createMcpRuntime } from "@0xsarwagya/ontoly-mcp";

const runtime = createMcpRuntime(graph);
const response = runtime.execute({
  capability: "TraceExecution",
  input: { id: "fn:src/index.ts:main" },
});
```

## Capabilities

- `FindFunction`
- `FindNode`
- `FindDependencies`
- `FindDependents`
- `TraceExecution`
- `InspectFile`
- `InspectModule`
- `InspectClass`
- `InspectFunction`
- `FindCycles`
- `FindDeadCode`
- `FindEntrypoints`
- `FindConfiguration`
- `GraphStatistics`

Each capability declares a name, version, description, input schema, output
schema, and examples.
