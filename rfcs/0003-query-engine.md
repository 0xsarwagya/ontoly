# RFC 0003: Query Engine

## Status

Draft

## Summary

This RFC defines the Ontoly Query Engine: the deterministic graph reasoning
layer over the Software Graph defined by RFC-0001.

The Query Engine is not an AI interface and is not designed around chat,
prompts, or natural language. It is a graph engine for software structure.
It should serve AI tools, SDK generators, documentation systems,
architecture tools, static analyzers, IDEs, visualization tools, and future
developer infrastructure through the same deterministic primitives.

This document defines graph-theoretic behavior first. Public APIs are
specified after the core query model.

## Normative Language

The words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as
defined by RFC 2119.

## Design Goals

1. **Deterministic reasoning.** Identical graph input and query input MUST
   produce identical query output ordering and content.
2. **Graph-first design.** Query semantics MUST be defined in graph terms:
   vertices, edges, walks, paths, neighborhoods, projections, and filters.
3. **Schema awareness.** The engine MUST understand RFC-0001 node types,
   relationship types, direction, provenance, confidence, and extensions.
4. **Consumer neutrality.** Queries MUST be useful to AI, SDK generation,
   documentation, architecture visualization, static analysis, and IDEs
   without introducing consumer-specific concepts.
5. **Composability.** Lookup, filtering, traversal, pattern matching, and
   projection SHOULD compose predictably.
6. **Index-backed execution.** The engine SHOULD use indexes and query
   plans where available, while preserving identical semantics without
   indexes.
7. **Bounded execution.** Query APIs MUST provide controls for depth,
   direction, relationship types, limits, and cycle handling.
8. **Explainability.** Query results SHOULD preserve enough edges,
   provenance, and traversal metadata to explain why each result was
   returned.

## Non-Goals

The Query Engine does not define:

- Natural language querying.
- AI prompting or model reasoning.
- Embedding search.
- Full text search over source code.
- Graph mutation.
- Compiler behavior.
- A persistent database engine.
- A distributed query protocol.
- Visualization rendering.
- SDK or documentation generation.

These systems may consume query results, but they are not part of the
query specification.

## Core Terminology

### Query Graph

The validated Software Graph loaded into the Query Engine.

### Vertex

A Software Graph node. This RFC uses "node" and "vertex" interchangeably
when describing graph algorithms.

### Directed Edge

A Software Graph edge with `from`, `to`, and relationship type.

### Adjacency

The set of edges touching a node in a selected direction.

### Walk

An ordered sequence of alternating nodes and edges where nodes and edges
may repeat unless restricted by query options.

### Path

A walk where nodes do not repeat, unless the query explicitly allows
cycles.

### Neighborhood

The bounded set of nodes and edges reachable from one or more seed nodes
under traversal rules.

### Projection

A view of nodes, edges, or paths that includes only selected fields or
derived summaries.

### Predicate

A deterministic boolean function over nodes, edges, paths, provenance, or
metadata.

### Query Plan

An internal execution plan chosen by the engine to answer a query.

## Query Engine Responsibilities

The Query Engine is responsible for:

- Loading a validated Software Graph.
- Building or accepting indexes.
- Looking up nodes and edges by ID and attributes.
- Expanding adjacency in deterministic order.
- Traversing graph neighborhoods.
- Finding paths.
- Computing dependency and impact traversals.
- Matching structural graph patterns.
- Filtering nodes, edges, and paths.
- Projecting results into stable result shapes.
- Caching query plans and query results when safe.
- Reporting query diagnostics for invalid or unsupported queries.

The Query Engine is not responsible for:

- Validating compiler output beyond the checks needed to safely query.
- Inferring missing graph facts.
- Mutating graph contents.
- Persisting compiler artifacts.
- Resolving source code beyond graph data.
- Calling plugins to invent query results.

## Query Invariants

All conforming engines MUST preserve:

1. **Read-only graph.** Query execution MUST NOT mutate the Software Graph.
2. **Stable output ordering.** Results MUST be sorted deterministically
   unless the query explicitly requests traversal order.
3. **Explicit direction.** Traversal direction MUST be explicit or have a
   documented default.
4. **Cycle safety.** Traversals MUST define cycle handling.
5. **Bounded default execution.** Public traversal APIs SHOULD have safe
   defaults for depth and result limits.
6. **Index transparency.** Indexes MAY improve performance but MUST NOT
   change results.
7. **Schema compatibility.** Unknown extension node or relationship types
   MUST be preserved and queryable by exact type, even if the engine does
   not understand their semantics.
8. **No probabilistic behavior.** Query results MUST NOT depend on
   probabilistic ranking or AI-generated interpretation.

## Graph View

The Query Engine operates on a logical graph:

```ts
type NodeId = string;
type EdgeId = string;

interface QueryGraph {
  nodes: Map<NodeId, SoftwareNode>;
  edges: Map<EdgeId, SoftwareEdge>;
  outgoing: Map<NodeId, EdgeId[]>;
  incoming: Map<NodeId, EdgeId[]>;
}
```

Rules:

- `outgoing[node]` contains edges whose `from` is `node`.
- `incoming[node]` contains edges whose `to` is `node`.
- Edge arrays MUST be sorted by canonical edge order.
- Node arrays MUST be sorted by canonical node order.
- A graph with invalid edge endpoints MUST be rejected by strict engines or
  loaded with diagnostics by tolerant engines.

## Canonical Ordering

Unless otherwise specified:

- Nodes sort by `id`.
- Edges sort by `id`.
- Paths sort lexicographically by edge ID sequence, then node ID sequence.
- Diagnostics sort by `id`.
- Equal-cost query plan choices MUST choose the lexicographically smallest
  deterministic plan key.

Traversal order:

- Breadth-first traversal visits frontier nodes in canonical node order.
- Depth-first traversal visits adjacent edges in canonical edge order.
- Path finding returns paths in deterministic cost order, then canonical
  path order.

## Query Inputs and Results

Every query has:

- A graph.
- A query operation.
- Parameters.
- Optional execution options.

Every query returns either:

- A successful result.
- A query diagnostic result.

```ts
interface QueryResult<T> {
  ok: boolean;
  value?: T;
  diagnostics: QueryDiagnostic[];
  stats?: QueryStats;
}
```

Public APIs MAY throw for programmer errors, but the canonical query model
is result-oriented so CLI, MCP, and server integrations can report
diagnostics without crashing.

## Lookup Primitives

Lookup primitives retrieve graph entities without traversal.

### Node Lookup

Supported lookup keys:

- ID.
- Node type.
- Name.
- Qualified name.
- Package.
- Source path.
- Source range.
- Language.
- Attribute predicate.
- Extension namespace and extension field.

Rules:

- Lookup by ID MUST be O(1) with indexes.
- Lookup by type SHOULD use `nodesByType`.
- Lookup by source path SHOULD use a source index.
- Name lookup MUST be exact unless an explicit match mode is supplied.

### Edge Lookup

Supported lookup keys:

- ID.
- Relationship type.
- `from`.
- `to`.
- Endpoint pair.
- Direction around a node.
- Confidence.
- Provenance producer.
- Source path.
- Attribute predicate.
- Extension namespace and extension field.

Rules:

- Endpoint lookups SHOULD use adjacency indexes.
- Relationship type lookup SHOULD use `edgesByType`.
- Edge lookup MUST preserve direction.

### Source Lookup

Source lookup finds graph facts associated with a source artifact.

Supported source queries:

- Nodes declared in a source.
- Edges proven by a source.
- Diagnostics associated with a source.
- All graph facts owned by a source.

Use cases:

- Documentation for a file.
- Incremental impact analysis.
- Editor integrations.

## Filtering Primitives

Filters reduce node, edge, path, or neighborhood sets.

### Filter Types

Core filters:

- Node type.
- Relationship type.
- Direction.
- Source path.
- Package.
- Language.
- Name or qualified name.
- Confidence.
- Provenance kind.
- Producer name.
- Diagnostic severity.
- Attribute equality.
- Attribute predicate.
- Extension namespace.
- Extension predicate.

### Filter Semantics

Filters MUST be deterministic and side-effect free.

Filter combination:

- `all` means logical AND.
- `any` means logical OR.
- `not` means logical negation.

Example:

```ts
type Filter =
  | { nodeType: string | string[] }
  | { edgeType: string | string[] }
  | { sourcePath: string | string[] }
  | { confidenceAtLeast: Confidence }
  | { all: Filter[] }
  | { any: Filter[] }
  | { not: Filter };
```

Rules:

- Engines MUST define how missing fields behave. Missing fields do not
  match equality filters unless the filter explicitly asks for absence.
- Filters over extension metadata MUST be namespace-qualified.
- Predicate filters supplied as functions are allowed in in-process APIs
  but not in serialized query documents.

## Result Set Algebra

The Query Engine operates on deterministic result sets.

Core set operations:

- `union`
- `intersection`
- `difference`
- `dedupe`
- `sort`
- `limit`
- `project`
- `groupBy`
- `count`

Rules:

- Set operations over nodes deduplicate by node ID.
- Set operations over edges deduplicate by edge ID.
- Set operations over paths deduplicate by canonical edge ID sequence.
- `union` MUST preserve canonical ordering after deduplication.
- `intersection` MUST preserve canonical ordering of the left-hand input
  unless canonical ordering is explicitly requested.
- `limit` MUST apply after deterministic ordering.
- Set algebra MUST NOT mutate the underlying graph.

## Traversal Primitives

Traversal starts from one or more seed nodes and expands through edges.

### Direction

```ts
type Direction = "outbound" | "inbound" | "both";
```

Rules:

- `outbound` follows edges from `from` to `to`.
- `inbound` follows edges from `to` to `from`.
- `both` treats edges as traversable in either direction while preserving
  original edge direction in results.

### Traversal Strategy

```ts
type TraversalStrategy = "breadth-first" | "depth-first";
```

Rules:

- Breadth-first is the default for neighborhood expansion.
- Depth-first is useful for dependency trees and path enumeration.
- Strategy affects traversal order, not result set, unless a limit stops
  traversal early.

### Cycle Policy

```ts
type CyclePolicy = "skip" | "include-boundary" | "allow";
```

Rules:

- `skip` does not revisit nodes already seen on the current traversal.
- `include-boundary` records the edge that would close a cycle but does
  not expand beyond it.
- `allow` permits repeated nodes and MUST require max depth or max path
  length.

### Traversal Bounds

Bounds include:

- `maxDepth`.
- `maxNodes`.
- `maxEdges`.
- `maxPaths`.
- `relationshipTypes`.
- `nodeFilter`.
- `edgeFilter`.
- `stopFilter`.

Rules:

- Public APIs SHOULD default to bounded traversal.
- Unbounded traversal MUST be explicit.
- Limits MUST produce deterministic truncation.
- Truncation SHOULD be reported in query stats or diagnostics.

## Graph Walks

A graph walk returns the subgraph visited by traversal.

```ts
interface WalkResult {
  seeds: NodeId[];
  nodes: SoftwareNode[];
  edges: SoftwareEdge[];
  visits: VisitRecord[];
  truncated: boolean;
}

interface VisitRecord {
  node: NodeId;
  depth: number;
  via?: EdgeId;
  predecessor?: NodeId;
}
```

Rules:

- `nodes` and `edges` are canonical sets sorted by ID.
- `visits` preserve traversal order.
- If multiple paths reach a node at the same depth, the canonical
  predecessor wins unless the query asks for all predecessors.
- Walks MUST include seed nodes that exist even if no edges are traversed.
- Missing seed nodes SHOULD produce diagnostics.

## Neighborhood Expansion

Neighborhood expansion is a bounded graph walk around one or more seeds.

Use cases:

- Explain a module.
- Show local architecture.
- Build graph visualizations.
- Gather context for downstream tools.

Default semantics:

- Direction: `both`.
- Strategy: breadth-first.
- Cycle policy: `include-boundary`.
- Depth: caller-defined; public APIs SHOULD default to 1 or 2.

Neighborhood results SHOULD include:

- Seed nodes.
- Neighbor nodes.
- Connecting edges.
- Boundary edges when cycles or limits stop expansion.
- Query stats.

## Dependency Traversal

Dependency traversal follows relationships that indicate a node depends on
another node.

Canonical dependency relationship set:

- DEPENDS_ON
- IMPORTS
- USES
- CALLS
- CREATES
- READS
- SUBSCRIBES

Rules:

- Dependency traversal direction is outbound by default.
- Reverse dependency traversal is inbound over the same relationship set.
- Consumers MAY customize the relationship set.
- Dependency traversal MUST preserve relationship types in results.
- Dependency traversal SHOULD expose direct and transitive dependencies
  separately.

### Dependency Closure

The dependency closure of a seed node is the set of all nodes reachable by
outbound dependency traversal under the selected bounds.

### Reverse Dependency Closure

The reverse dependency closure of a seed node is the set of nodes that may
depend on the seed under inbound dependency traversal.

### Dependency Tree

A dependency tree is a traversal projection.

Rules:

- Trees are rooted at the seed.
- Cycles MUST be represented explicitly as cycle references, not expanded
  infinitely.
- Shared dependencies MAY appear once with references or repeated with
  stable cycle/shared markers, depending on projection options.

## Path Finding

Path finding returns one or more paths between source and target node sets.

### Path Query Inputs

- Start node set.
- Target node set or target predicate.
- Direction.
- Relationship type set.
- Node filter.
- Edge filter.
- Max path length.
- Max path count.
- Cost model.
- Cycle policy.

### Path Semantics

Default path semantics:

- Directed paths.
- No repeated nodes.
- Breadth-first shortest path by edge count.
- Canonical tie-breaking.

Path result:

```ts
interface PathResult {
  paths: GraphPath[];
  truncated: boolean;
}

interface GraphPath {
  nodes: NodeId[];
  edges: EdgeId[];
  cost: number;
}
```

Rules:

- `nodes.length` MUST equal `edges.length + 1`.
- Every edge MUST connect the adjacent nodes in the path according to the
  query direction.
- If multiple shortest paths exist, all MAY be returned up to `maxPaths`.
- No path is an empty successful result, not an error.

### Cost Models

Required cost models:

- `unit`: every edge has cost 1.
- `relationship-weighted`: edge costs are configured by relationship type.
- `confidence-weighted`: lower-confidence edges cost more.

Rules:

- Cost functions MUST be deterministic.
- Negative edge costs are forbidden.
- Weighted path finding MUST define tie-breaking.

## Impact Analysis

Impact analysis identifies nodes that may be affected by a change to one or
more seed nodes.

Impact is graph reachability under a selected impact relationship policy.

Canonical impact relationship set:

- inbound CALLS
- inbound IMPORTS
- inbound USES
- inbound DEPENDS_ON
- inbound READS
- inbound SUBSCRIBES
- inbound REFERENCES
- inbound IMPLEMENTS
- inbound EXTENDS

Rules:

- Impact traversal is inbound by default.
- Impact analysis MUST include relationship evidence so consumers can
  explain why a node is impacted.
- Impact analysis SHOULD classify results by distance from seed.
- Impact analysis SHOULD separate direct impact from transitive impact.
- Impact analysis MAY support risk scoring, but scoring MUST be
  deterministic and explainable.

Impact result:

```ts
interface ImpactResult {
  seeds: NodeId[];
  direct: ImpactItem[];
  transitive: ImpactItem[];
  subgraph: WalkResult;
}

interface ImpactItem {
  node: NodeId;
  distance: number;
  via: EdgeId[];
  relationshipTypes: string[];
}
```

## Pattern Matching

Pattern matching finds subgraphs that satisfy structural constraints.

### Pattern Model

```ts
interface GraphPattern {
  nodes: PatternNode[];
  edges: PatternEdge[];
  returns?: string[];
}

interface PatternNode {
  bind: string;
  filter?: Filter;
}

interface PatternEdge {
  from: string;
  to: string;
  filter?: Filter;
  direction?: Direction;
  minHops?: number;
  maxHops?: number;
}
```

Rules:

- Pattern bindings MUST be deterministic.
- Pattern matching MUST return stable binding maps.
- Pattern edges with `minHops` or `maxHops` represent bounded path
  constraints.
- Unbounded pattern edges are forbidden in serialized queries.
- Pattern matching MUST define duplicate handling.

Example pattern:

```ts
{
  nodes: [
    { bind: "route", filter: { nodeType: "Route" } },
    { bind: "permission", filter: { nodeType: "Permission" } }
  ],
  edges: [
    {
      from: "route",
      to: "permission",
      filter: { edgeType: "AUTHORIZES" },
      direction: "outbound"
    }
  ],
  returns: ["route", "permission"]
}
```

## Query Projection

Projection controls result shape.

Projection kinds:

- Full nodes and edges.
- IDs only.
- Summaries.
- Paths.
- Trees.
- Adjacency lists.
- Grouped results.
- Counts.

Rules:

- Projection MUST NOT change which graph entities match the query.
- Projection SHOULD reduce result size for large graphs.
- Projection MUST preserve IDs for traceability.
- Projection MAY include provenance when requested.

## Indexes

Indexes are derived structures that accelerate query execution.

Required logical indexes:

- `nodesById`
- `edgesById`
- `outgoingEdgesByNode`
- `incomingEdgesByNode`

Recommended indexes:

- `nodesByType`
- `edgesByType`
- `nodesByName`
- `nodesByQualifiedName`
- `nodesBySource`
- `edgesBySource`
- `edgesByEndpointPair`
- `nodesByPackage`
- `diagnosticsByNode`
- `diagnosticsByEdge`
- `extensionNamespaces`

Rules:

- Engines MUST be able to build required indexes from graph content.
- Engines MAY use indexes serialized in the graph if validated.
- Indexes MUST be invalidated when graph content hash changes.
- Index contents MUST be deterministic.
- Indexes MUST NOT alter query semantics.

## Caching

The Query Engine may cache:

- Built indexes.
- Parsed query documents.
- Query plans.
- Result sets.
- Intermediate traversals.
- Pattern match partials.

Cache keys MUST include:

- Graph content hash.
- Query operation.
- Query parameters.
- Query options.
- Engine version when execution semantics may differ.

Rules:

- Cached results MUST be invalidated when graph content hash changes.
- Query caches MUST NOT cross graphs unless graph content hashes match.
- Result cache eviction MUST NOT affect correctness.
- Function predicates in in-process APIs SHOULD either disable result
  caching or provide explicit stable predicate IDs.

## Query Optimization

Query optimization chooses efficient execution without changing results.

Optimization strategies:

- Use ID lookup before scans.
- Push filters before traversal.
- Start pattern matching from the most selective binding.
- Use relationship type indexes for traversal.
- Use bidirectional search for path finding.
- Stop traversal when bounds are reached.
- Reuse shared subplans.
- Use cached indexes and plans.

Rules:

- Optimizer decisions MUST be deterministic.
- Optimizer MUST preserve canonical result ordering.
- Optimizer MUST report truncation caused by query limits.
- Optimizer MAY expose query plans for debugging.

Query plan:

```ts
interface QueryPlan {
  operation: string;
  graphHash: string;
  steps: QueryPlanStep[];
  estimatedCost?: number;
}
```

## Query Diagnostics

Query diagnostics report invalid or partially satisfied queries.

Examples:

- Missing seed node.
- Unknown relationship type.
- Unsupported extension predicate.
- Unbounded traversal rejected.
- Result limit reached.
- Invalid pattern binding.

Rules:

- Query diagnostics MUST be deterministic.
- Query diagnostics SHOULD reference query input paths.
- Query diagnostics MUST NOT be written into the Software Graph unless a
  caller explicitly stores query artifacts elsewhere.

## Query Explanations

Query explanations describe why a result was returned.

Explanation sources:

- Seed nodes.
- Traversed edges.
- Matched pattern bindings.
- Filters that admitted or rejected candidates.
- Path costs.
- Provenance records on returned graph facts.

Rules:

- Explanations MUST be derived from graph content and query execution
  metadata.
- Explanations MUST NOT introduce facts absent from the graph.
- Explanations SHOULD include edge IDs and provenance references rather
  than prose-only summaries.
- Explanations MAY be projected into human-readable text by consumers, but
  the canonical explanation is structured data.

```ts
interface QueryExplanation {
  seeds: NodeId[];
  resultIds: string[];
  steps: ExplanationStep[];
}

interface ExplanationStep {
  kind: "lookup" | "filter" | "traverse" | "match" | "path" | "project";
  input?: string[];
  output?: string[];
  edge?: EdgeId;
  predicate?: string;
  provenance?: string[];
}
```

## Public API

The public API is a projection of the graph-theoretic primitives above.

### Engine Creation

```ts
function createQueryEngine(
  graph: SoftwareGraph,
  options?: QueryEngineOptions
): QueryEngine;
```

Rules:

- The engine SHOULD require a validated graph by default.
- The engine MAY support tolerant loading with diagnostics.
- Engine creation SHOULD build required indexes lazily or eagerly according
  to options.

### Core API

```ts
interface QueryEngine {
  graph(): SoftwareGraph;
  stats(): QueryEngineStats;

  node(id: NodeId): SoftwareNode | undefined;
  edge(id: EdgeId): SoftwareEdge | undefined;

  nodes(filter?: NodeFilter, options?: ResultOptions): QueryResult<SoftwareNode[]>;
  edges(filter?: EdgeFilter, options?: ResultOptions): QueryResult<SoftwareEdge[]>;

  adjacent(node: NodeId, options?: AdjacencyOptions): QueryResult<AdjacencyResult>;
  walk(seeds: NodeId | NodeId[], options?: WalkOptions): QueryResult<WalkResult>;
  neighborhood(seeds: NodeId | NodeId[], options?: NeighborhoodOptions): QueryResult<WalkResult>;

  dependencies(seed: NodeId, options?: DependencyOptions): QueryResult<WalkResult>;
  reverseDependencies(seed: NodeId, options?: DependencyOptions): QueryResult<WalkResult>;
  dependencyTree(seed: NodeId, options?: DependencyTreeOptions): QueryResult<DependencyTree>;

  paths(from: NodeId | NodeId[], to: NodeId | NodeId[] | NodePredicate, options?: PathOptions): QueryResult<PathResult>;
  shortestPath(from: NodeId, to: NodeId, options?: PathOptions): QueryResult<GraphPath | undefined>;

  impact(seeds: NodeId | NodeId[], options?: ImpactOptions): QueryResult<ImpactResult>;
  match(pattern: GraphPattern, options?: MatchOptions): QueryResult<PatternMatch[]>;

  explain(result: ExplainableQueryResult): QueryResult<QueryExplanation>;
}
```

### Convenience API

Convenience methods MAY be provided when they are deterministic aliases for
core primitives.

Examples:

```ts
interface QueryEngineConvenience {
  callers(node: NodeId): QueryResult<SoftwareNode[]>;
  callees(node: NodeId): QueryResult<SoftwareNode[]>;
  imports(module: NodeId): QueryResult<SoftwareNode[]>;
  importedBy(module: NodeId): QueryResult<SoftwareNode[]>;
  exports(module: NodeId): QueryResult<SoftwareNode[]>;
  routes(filter?: NodeFilter): QueryResult<SoftwareNode[]>;
  models(filter?: NodeFilter): QueryResult<SoftwareNode[]>;
  services(filter?: NodeFilter): QueryResult<SoftwareNode[]>;
  diagnosticsFor(nodeOrEdge: NodeId | EdgeId): QueryResult<Diagnostic[]>;
}
```

Rules:

- Convenience APIs MUST be expressible through core primitives.
- Convenience APIs MUST document their relationship sets and defaults.
- Convenience APIs MUST preserve deterministic ordering.

## Serialized Query Documents

In addition to in-process APIs, the engine SHOULD support serialized query
documents for CLI, MCP, and other process boundaries.

Rules:

- Serialized query documents MUST be JSON.
- Serialized queries MUST NOT contain functions.
- Serialized queries MUST require explicit bounds for traversals and
  pattern edges.
- Serialized query results MUST include graph content hash.

Example:

```json
{
  "operation": "impact",
  "graph": { "contentHash": "sha256:..." },
  "seeds": ["fn:src/auth/service.ts:login"],
  "options": {
    "maxDepth": 3,
    "relationshipTypes": ["CALLS", "IMPORTS", "USES"]
  }
}
```

## Security and Resource Limits

The Query Engine can be embedded in long-running tools and servers.

Rules:

- Serialized queries from untrusted callers MUST be bounded.
- Engines SHOULD support max execution time.
- Engines SHOULD support max result size.
- Engines SHOULD support memory limits.
- Engines MUST avoid executing arbitrary code from serialized predicates.
- In-process predicate functions are trusted caller code and MUST NOT be
  accepted over process boundaries.

## Compatibility With RFC-0001 and RFC-0002

The Query Engine depends on RFC-0001 for:

- Graph document shape.
- Node and edge semantics.
- Stable IDs.
- Provenance and confidence.
- Diagnostics.
- Serialization and content hash.

The Query Engine depends on RFC-0002 for:

- The validated graph production lifecycle.
- Artifact and cache expectations.
- Plugin participation boundaries.

Query Engine changes require an RFC when they alter:

- Traversal semantics.
- Path finding semantics.
- Dependency or impact relationship sets.
- Pattern matching semantics.
- Public API contracts.
- Serialized query document shape.
- Query result ordering.

## Open Questions

- Should query documents become a formal public JSON Schema?
- Should relationship sets such as dependency and impact be configurable at
  graph-production time, query time, or both?
- Should the first implementation expose cost-based query plans publicly or
  keep them internal?
- Should pattern matching support captures over edge provenance in v1?
- Should query result explanations be standardized now or after initial
  consumers exist?
