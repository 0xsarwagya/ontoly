# MCP

Ontoly MCP exposes deterministic capabilities backed by the Query Engine.
Capabilities read from a `SoftwareGraph` (and, optionally, a repository
`History` artifact) and return evidence-bearing responses — no LLM, no
speculation.

The MCP runtime does not expose raw graph mutation and does not parse source.
When an LLM-capable client uses Ontoly MCP, [LLM Enhancement](llm-enhancement.md)
is mandatory: MCP returns deterministic graph facts and the LLM-facing
workflow must preserve evidence, confidence, and explicit fallback behavior.
Non-LLM tools may call the same capabilities directly.

## Runtime

```ts
import { createMcpRuntime } from "@0xsarwagya/ontoly-mcp";

const runtime = createMcpRuntime(graph);

const response = runtime.execute({
  capability: "TraceExecution",
  input: { id: "fn:src/index.ts:main" },
});
```

If a History artifact is available, pass it into the runtime so temporal
capabilities and Evidence Packs include repository evolution facts:

```ts
const runtime = createMcpRuntime(graph, { history });
```

Every capability declares a name, version, description, input schema, output
schema, and worked examples. Full capability specs live in
[Capabilities](capabilities.md) and [Capability API](capability-api.md).

## Structural capabilities

Read the shape of the graph itself.

- `FindFunction` — locate a function by fully-qualified name or graph ID.
- `FindNode` — resolve any graph node by ID.
- `FindDependencies` — return everything a node depends on (transitively).
- `FindDependents` — return everything that depends on a node (transitively).
- `FindCycles` — detect dependency cycles between modules, classes, or functions.
- `FindEntrypoints` — surface graph entrypoints (main modules, exported APIs, framework routes).
- `FindDeadCode` — surface nodes that are unreachable from any entrypoint.
- `FindConfiguration` — surface configuration nodes (env vars, settings, feature flags).

## Inspection capabilities

Return rich per-node reports.

- `InspectFile` — full report for a file: exports, imports, symbols, framework facts.
- `InspectModule` — module-level rollup: files, dependencies, exported surface.
- `InspectClass` — class report: methods, fields, ancestors, descendants.
- `InspectFunction` — function report: signature, callers, callees, span.

## Trace and impact capabilities

- `TraceExecution` — walk `CALLS` / `INVOKES` edges from an entrypoint.
- `TraceRequestLifecycle` — walk a request from route to handler to services to data layer.
- `FindResponsibleFunction` — identify which function is responsible for a symbol, route, or feature.
- `FindFeatureOwner` — identify the package, module, or file that owns a feature.
- `FindAuthenticationFlow` — trace authentication surfaces end-to-end.
- `ImpactAnalysis` — enumerate the blast radius of a change to a node.

## Semantic capabilities

Deterministic concept resolution built on the Semantic Index.

- `SearchConcept` — resolve a natural-language concept to graph entities.
- `FindFeature` — locate a named feature (across code, config, and routes).
- `FindRepositoryConcept` — resolve a repository-level concept (a service, a bounded context).
- `ResolveIntent` — map an intent string to graph entities with evidence.
- `SemanticNeighborhood` — return the semantic neighbors of a node.
- `FeatureOwnership` — semantic ownership derivation for a feature.
- `IntentExpansion` — expand an intent into related intents and entities.
- `SemanticContext` — return the semantic context around a node.

## History capabilities

Require a History artifact (`@0xsarwagya/ontoly-enhancer-history` output)
passed into the runtime.

- `History` — commit history for a node.
- `Ownership` — Git-backed ownership derivation.
- `Hotspots` — files or functions with disproportionate churn.
- `Cochanges` — files that change together.
- `Stability` — a stability score derived from churn and age.

## Capability metadata

Each capability declares `name`, `version`, `description`, `inputSchema`,
`outputSchema`, and worked `examples`. Schemas are JSON Schema draft-07.
The registry can be introspected:

```ts
const runtime = createMcpRuntime(graph);
const list = runtime.capabilities;
for (const cap of list) {
  console.log(cap.name, cap.version);
}
```

## Determinism

Every capability is deterministic: same graph in, same output out. Ordering,
pagination, and tie-breaking are fully specified in
[Query Engine](query-engine.md).
