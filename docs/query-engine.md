# Query Engine

The query engine operates only on `SoftwareGraph`.

It does not depend on the compiler and never parses source files.

```ts
import { createQueryEngine } from "@0xsarwagya/ontoly-query";

const query = createQueryEngine(graph);
const main = query.findFunction("main");
const trace = main ? query.trace(main.id) : undefined;
```

## Lookup

- `findNode(idOrQuery)`
- `findNodes(options)`
- `resolve(target, options)`
- `findFunction(nameOrId)`
- `findClass(nameOrId)`
- `findModule(nameOrId)`
- `findRoute(nameOrId)`
- `findService(nameOrId)`
- `findByFile(file)`

The engine builds deterministic indexes for node ID, kind, name, file,
relationship type, incoming edges, and outgoing edges.

Free-text lookup is normalized for human concept phrases. A single lookup such
as `Plan Definition Resource` can match graph facts named `PlanDefinition`,
`plan-definition`, `planDefinition`, or metadata that contains the same concept.
Callers should issue one lookup and handle Ontoly's deterministic matches,
ambiguity, or not-found result instead of trying spelling variants manually.

`resolve(target)` turns a user's target into nodes the way the CLI does. It
returns the nodes of the first tier that matches: the exact node ID, then an
exact name, then free text. An exact name is qualified (`UserService.load`,
`src/service.ts`, `POST /login`) or bare (`main`, the `load` in
`UserService.load`, `/login`). More than one node means the target is
ambiguous. Pass `{ types: ["Route"] }` to limit the node kinds, or
`{ fuzzy: false }` to stop before free text.

## Traversal

- `walk(startId, options)`
- `trace(startId, options)`
- `shortestPath(fromId, toId, options)`
- `ancestors(nodeId)`
- `descendants(nodeId)`
- `neighborhood(nodeId)`

Traversal supports breadth-first and depth-first order, relationship
constraints, node kind constraints, maximum depth, predicates, visitors, and
cycle-safe visited-node tracking.

## Graph Algorithms

- `hasCycle()`
- `detectCycles()`
- `connectedComponents()`
- `topologicalSort()`

## Statistics

`query.stats()` returns deterministic graph analytics including node counts,
relationship counts, degree metrics, components, cycles, longest call chain,
most imported module, graph density, and average path length for practical
graph sizes.

## Cache

The engine memoizes deterministic traversals and graph analytics by graph hash.

```ts
query.cache.stats();
query.cache.clear();
```

## Exporters

The query package also exports graph serializers that operate only on
`SoftwareGraph`.

```ts
import { exportGraph } from "@0xsarwagya/ontoly-query";

exportGraph(graph, { format: "mermaid" });
exportGraph(graph, { format: "dependency-tree", rootId: "mod:src/index.ts" });
```

Supported formats are `json`, `mermaid`, `dot`, `graphml`,
`architecture-tree`, `dependency-tree`, and `call-tree`.
