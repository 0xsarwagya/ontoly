import type {
  NodeType,
  RelationshipType,
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";

export type TraversalDirection = "inbound" | "outbound" | "both";
export type TraversalStrategy = "breadth-first" | "depth-first";

export interface FindOptions {
  readonly id?: string | undefined;
  readonly name?: string | undefined;
  readonly type?: NodeType | undefined;
  readonly kind?: NodeType | undefined;
  readonly file?: string | undefined;
  readonly query?: string | undefined;
}

export interface WalkOptions {
  readonly direction?: TraversalDirection | undefined;
  readonly strategy?: TraversalStrategy | undefined;
  readonly depth?: number | undefined;
  readonly relationships?: readonly RelationshipType[] | undefined;
  readonly nodeTypes?: readonly NodeType[] | undefined;
  readonly allowRevisit?: boolean | undefined;
  readonly predicate?: ((node: SoftwareGraphNode) => boolean) | undefined;
  readonly visitor?: ((event: TraversalVisit) => void) | undefined;
}

export interface TraversalVisit {
  readonly node: SoftwareGraphNode;
  readonly depth: number;
  readonly via?: SoftwareGraphEdge | undefined;
}

export interface GraphTraversal {
  readonly startId: string;
  readonly nodes: readonly SoftwareGraphNode[];
  readonly edges: readonly SoftwareGraphEdge[];
  readonly order: readonly string[];
}

export interface GraphPath {
  readonly nodes: readonly SoftwareGraphNode[];
  readonly edges: readonly SoftwareGraphEdge[];
}

export interface DependencyTree {
  readonly node: SoftwareGraphNode;
  readonly dependencies: readonly DependencyTree[];
}

export interface QueryCacheStats {
  readonly graphHash: string;
  readonly hits: number;
  readonly misses: number;
  readonly entries: number;
}

export interface GraphStatistics {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodeKinds: Record<string, number>;
  readonly relationshipCounts: Record<string, number>;
  readonly averageDegree: number;
  readonly maximumDegree: {
    readonly nodeId: string | null;
    readonly degree: number;
  };
  readonly disconnectedComponents: number;
  readonly cycles: readonly (readonly string[])[];
  readonly longestCallChain: readonly string[];
  readonly mostImportedModule: {
    readonly nodeId: string | null;
    readonly count: number;
  };
  readonly mostDependedUponService: {
    readonly nodeId: string | null;
    readonly count: number;
  };
  readonly graphDensity: number;
  readonly largestComponent: number;
  readonly averagePathLength: number | null;
}

export type GraphExportFormat = "json" | "mermaid" | "dot" | "graphml" | "architecture-tree" | "dependency-tree" | "call-tree";

export interface GraphExportOptions {
  readonly format: GraphExportFormat;
  readonly rootId?: string | undefined;
  readonly depth?: number | undefined;
}

export interface QueryIndexes {
  readonly nodeById: ReadonlyMap<string, SoftwareGraphNode>;
  readonly nodesByKind: ReadonlyMap<NodeType, readonly SoftwareGraphNode[]>;
  readonly nodesByName: ReadonlyMap<string, readonly SoftwareGraphNode[]>;
  readonly nodesByFile: ReadonlyMap<string, readonly SoftwareGraphNode[]>;
  readonly edgeById: ReadonlyMap<string, SoftwareGraphEdge>;
  readonly edgesByType: ReadonlyMap<RelationshipType, readonly SoftwareGraphEdge[]>;
  readonly incomingByNodeId: ReadonlyMap<string, readonly SoftwareGraphEdge[]>;
  readonly outgoingByNodeId: ReadonlyMap<string, readonly SoftwareGraphEdge[]>;
}

export interface QueryEngine {
  readonly graph: SoftwareGraph;
  readonly indexes: QueryIndexes;
  readonly cache: {
    readonly stats: () => QueryCacheStats;
    readonly clear: () => void;
  };
  readonly find: (options?: string | FindOptions) => readonly SoftwareGraphNode[];
  readonly findNode: (idOrQuery: string | FindOptions) => SoftwareGraphNode | undefined;
  readonly findNodes: (options?: string | FindOptions) => readonly SoftwareGraphNode[];
  readonly findFunction: (nameOrId: string) => SoftwareGraphNode | undefined;
  readonly findClass: (nameOrId: string) => SoftwareGraphNode | undefined;
  readonly findModule: (nameOrId: string) => SoftwareGraphNode | undefined;
  readonly findRoute: (nameOrId: string) => SoftwareGraphNode | undefined;
  readonly findService: (nameOrId: string) => SoftwareGraphNode | undefined;
  readonly findByFile: (file: string) => readonly SoftwareGraphNode[];
  readonly incoming: (nodeId: string, relationships?: readonly RelationshipType[]) => readonly SoftwareGraphEdge[];
  readonly outgoing: (nodeId: string, relationships?: readonly RelationshipType[]) => readonly SoftwareGraphEdge[];
  readonly callers: (nodeId: string) => readonly SoftwareGraphNode[];
  readonly callees: (nodeId: string) => readonly SoftwareGraphNode[];
  readonly dependencies: (nodeId: string, depth?: number) => GraphTraversal;
  readonly dependents: (nodeId: string, depth?: number) => GraphTraversal;
  readonly related: (
    nodeId: string,
    relationships?: readonly RelationshipType[],
  ) => readonly SoftwareGraphNode[];
  readonly walk: (startId: string, options?: WalkOptions) => GraphTraversal;
  readonly trace: (startId: string, options?: WalkOptions) => GraphTraversal;
  readonly shortestPath: (fromId: string, toId: string, options?: WalkOptions) => GraphPath | undefined;
  readonly descendants: (nodeId: string, relationships?: readonly RelationshipType[]) => readonly SoftwareGraphNode[];
  readonly ancestors: (nodeId: string, relationships?: readonly RelationshipType[]) => readonly SoftwareGraphNode[];
  readonly neighborhood: (
    nodeId: string,
    options?: Pick<WalkOptions, "depth" | "relationships" | "nodeTypes">,
  ) => GraphTraversal;
  readonly hasCycle: (relationships?: readonly RelationshipType[]) => boolean;
  readonly detectCycles: (relationships?: readonly RelationshipType[]) => readonly (readonly string[])[];
  readonly connectedComponents: (relationships?: readonly RelationshipType[]) => readonly (readonly SoftwareGraphNode[])[];
  readonly topologicalSort: (relationships?: readonly RelationshipType[]) => readonly SoftwareGraphNode[];
  readonly dependencyTree: (nodeId: string, depth?: number) => DependencyTree | undefined;
  readonly routes: () => readonly SoftwareGraphNode[];
  readonly models: () => readonly SoftwareGraphNode[];
  readonly services: () => readonly SoftwareGraphNode[];
  readonly stats: () => GraphStatistics;
}

type NormalizedWalkOptions = {
  readonly direction: TraversalDirection;
  readonly strategy: TraversalStrategy;
  readonly depth: number;
  readonly allowRevisit: boolean;
  readonly relationships?: readonly RelationshipType[] | undefined;
  readonly nodeTypes?: readonly NodeType[] | undefined;
  readonly predicate?: ((node: SoftwareGraphNode) => boolean) | undefined;
  readonly visitor?: ((event: TraversalVisit) => void) | undefined;
};

export const QUERY_COMPLEXITIES: Record<keyof Omit<QueryEngine, "graph" | "indexes" | "cache">, string> = {
  find: "O(1) for exact id/name/file/kind lookups, O(n) for free-text query merging index candidates.",
  findNode: "O(1) for exact id, otherwise O(k) for matching indexed candidates.",
  findNodes: "O(1) for exact id/name/file/kind lookups, O(n) for free-text query merging index candidates.",
  findFunction: "O(k) where k is the number of nodes with matching name or id candidates.",
  findClass: "O(k) where k is the number of nodes with matching name or id candidates.",
  findModule: "O(k) where k is the number of nodes with matching name or id candidates.",
  findRoute: "O(k) where k is the number of nodes with matching name or id candidates.",
  findService: "O(k) where k is the number of nodes with matching name or id candidates.",
  findByFile: "O(1 + k) where k is nodes in the file.",
  incoming: "O(d) where d is inbound degree of the node.",
  outgoing: "O(d) where d is outbound degree of the node.",
  callers: "O(d) where d is inbound CALLS degree.",
  callees: "O(d) where d is outbound CALLS degree.",
  dependencies: "O(V + E) within the requested traversal depth.",
  dependents: "O(V + E) within the requested traversal depth.",
  related: "O(d) where d is total adjacent degree.",
  walk: "O(V + E) within the requested traversal depth.",
  trace: "O(V + E) over CALLS edges within the requested depth.",
  shortestPath: "O(V + E) breadth-first over constrained edges.",
  descendants: "O(V + E) over outbound constrained edges.",
  ancestors: "O(V + E) over inbound constrained edges.",
  neighborhood: "O(V + E) within the requested radius.",
  hasCycle: "O(V + E).",
  detectCycles: "O(V + E + c log c) where c is discovered cycles after canonical de-duplication.",
  connectedComponents: "O(V + E).",
  topologicalSort: "O(V + E), throws if cycles exist.",
  dependencyTree: "O(V + E) within the requested depth.",
  routes: "O(1 + k) where k is route nodes.",
  models: "O(k) for model and interface nodes.",
  services: "O(k + n_name) using kind and name indexes.",
  stats: "O(V + E) on first call, O(1) cached afterward.",
};

const DEPENDENCY_RELATIONSHIPS: readonly RelationshipType[] = [
  "DEPENDS_ON",
  "IMPORTS",
  "USES",
  "CALLS",
  "CREATES",
  "INJECTS",
  "REFERENCES",
  "CONFIGURES",
  "REGISTERED_IN",
  "PROVIDES",
  "CONSUMES",
];

export function createQueryEngine(graph: SoftwareGraph): QueryEngine {
  const indexes = buildQueryIndexes(graph);
  const cache = createQueryCache(graph.metadata.deterministicHash);

  const engine: QueryEngine = {
    graph,
    indexes,
    cache: {
      stats: () => cache.stats(),
      clear: () => cache.clear(),
    },
    find: (options) => findNodes(indexes, options),
    findNode: (idOrQuery) => findNode(indexes, idOrQuery),
    findNodes: (options) => findNodes(indexes, options),
    findFunction: (nameOrId) => findNodeByType(indexes, "Function", nameOrId),
    findClass: (nameOrId) => findNodeByType(indexes, "Class", nameOrId),
    findModule: (nameOrId) => findNodeByType(indexes, "Module", nameOrId),
    findRoute: (nameOrId) => findNodeByType(indexes, "Route", nameOrId),
    findService: (nameOrId) => findService(indexes, nameOrId),
    findByFile: (file) => sortedNodes(indexes.nodesByFile.get(file) ?? []),
    incoming: (nodeId, relationships) => filterEdges(indexes.incomingByNodeId.get(nodeId) ?? [], relationships),
    outgoing: (nodeId, relationships) => filterEdges(indexes.outgoingByNodeId.get(nodeId) ?? [], relationships),
    callers: (nodeId) => adjacentByRelationship(indexes, nodeId, "CALLS", "inbound"),
    callees: (nodeId) => adjacentByRelationship(indexes, nodeId, "CALLS", "outbound"),
    dependencies: (nodeId, depth = 3) =>
      walk(indexes, nodeId, {
        direction: "outbound",
        depth,
        relationships: DEPENDENCY_RELATIONSHIPS,
      }, cache),
    dependents: (nodeId, depth = 3) =>
      walk(indexes, nodeId, {
        direction: "inbound",
        depth,
        relationships: DEPENDENCY_RELATIONSHIPS,
      }, cache),
    related: (nodeId, relationships) => related(indexes, nodeId, relationships),
    walk: (startId, options) => walk(indexes, startId, options, cache),
    trace: (startId, options) =>
      walk(indexes, startId, {
        direction: "outbound",
        depth: 10,
        relationships: ["CALLS"],
        ...options,
      }, cache),
    shortestPath: (fromId, toId, options) => shortestPath(indexes, fromId, toId, options, cache),
    descendants: (nodeId, relationships) =>
      walk(indexes, nodeId, { direction: "outbound", depth: Number.POSITIVE_INFINITY, relationships }, cache).nodes
        .filter((node) => node.id !== nodeId),
    ancestors: (nodeId, relationships) =>
      walk(indexes, nodeId, { direction: "inbound", depth: Number.POSITIVE_INFINITY, relationships }, cache).nodes
        .filter((node) => node.id !== nodeId),
    neighborhood: (nodeId, options) => walk(indexes, nodeId, { direction: "both", depth: 1, ...options }, cache),
    hasCycle: (relationships) => detectCycles(indexes, relationships, cache).length > 0,
    detectCycles: (relationships) => detectCycles(indexes, relationships, cache),
    connectedComponents: (relationships) => connectedComponents(indexes, relationships, cache),
    topologicalSort: (relationships) => topologicalSort(indexes, relationships, cache),
    dependencyTree: (nodeId, depth = 3) => dependencyTree(indexes, nodeId, depth),
    routes: () => byType(indexes, "Route"),
    models: () => sortedNodes([...byType(indexes, "Model"), ...byType(indexes, "Interface")]),
    services: () => services(indexes),
    stats: () => cache.memo("stats", () => graphStatistics(indexes)),
  };

  return engine;
}

export function buildQueryIndexes(graph: SoftwareGraph): QueryIndexes {
  const nodeById = new Map<string, SoftwareGraphNode>();
  const nodesByKind = new Map<NodeType, SoftwareGraphNode[]>();
  const nodesByName = new Map<string, SoftwareGraphNode[]>();
  const nodesByFile = new Map<string, SoftwareGraphNode[]>();
  const edgeById = new Map<string, SoftwareGraphEdge>();
  const edgesByType = new Map<RelationshipType, SoftwareGraphEdge[]>();
  const incomingByNodeId = new Map<string, SoftwareGraphEdge[]>();
  const outgoingByNodeId = new Map<string, SoftwareGraphEdge[]>();

  for (const node of graph.nodes) {
    nodeById.set(node.id, node);
    push(nodesByKind, node.type, node);
    push(nodesByName, node.name, node);

    if (node.file) {
      push(nodesByFile, node.file, node);
    }
  }

  for (const edge of graph.edges) {
    edgeById.set(edge.id, edge);
    push(edgesByType, edge.type, edge);
    push(outgoingByNodeId, edge.from, edge);
    push(incomingByNodeId, edge.to, edge);
  }

  return {
    nodeById,
    nodesByKind: sortMapValues(nodesByKind, compareNodes),
    nodesByName: sortMapValues(nodesByName, compareNodes),
    nodesByFile: sortMapValues(nodesByFile, compareNodes),
    edgeById,
    edgesByType: sortMapValues(edgesByType, compareEdges),
    incomingByNodeId: sortMapValues(incomingByNodeId, compareEdges),
    outgoingByNodeId: sortMapValues(outgoingByNodeId, compareEdges),
  };
}

function createQueryCache(graphHash: string) {
  let hits = 0;
  let misses = 0;
  const entries = new Map<string, unknown>();

  return {
    memo: <T>(key: string, create: () => T): T => {
      const versionedKey = `${graphHash}:${key}`;

      if (entries.has(versionedKey)) {
        hits += 1;
        return entries.get(versionedKey) as T;
      }

      misses += 1;
      const value = create();
      entries.set(versionedKey, value);
      return value;
    },
    stats: (): QueryCacheStats => ({
      graphHash,
      hits,
      misses,
      entries: entries.size,
    }),
    clear: (): void => {
      hits = 0;
      misses = 0;
      entries.clear();
    },
  };
}

function findNode(indexes: QueryIndexes, idOrQuery: string | FindOptions): SoftwareGraphNode | undefined {
  const nodes = findNodes(indexes, typeof idOrQuery === "string" ? { id: idOrQuery } : idOrQuery);

  if (nodes.length > 0) {
    return nodes[0];
  }

  return typeof idOrQuery === "string" ? findNodes(indexes, idOrQuery)[0] : undefined;
}

function findNodes(indexes: QueryIndexes, options?: string | FindOptions): readonly SoftwareGraphNode[] {
  if (!options) {
    return sortedNodes([...indexes.nodeById.values()]);
  }

  if (typeof options === "string") {
    const exact = indexes.nodeById.get(options);

    if (exact) {
      return [exact];
    }

    const byName = indexes.nodesByName.get(options);

    if (byName) {
      return sortedNodes(byName);
    }

    return sortedNodes([...indexes.nodeById.values()].filter((node) => matchesQuery(node, options)));
  }

  const candidates = candidateNodes(indexes, options);
  const type = options.kind ?? options.type;

  return sortedNodes(candidates.filter((node) => {
    if (options.id && node.id !== options.id) {
      return false;
    }

    if (options.name && node.name !== options.name) {
      return false;
    }

    if (type && node.type !== type) {
      return false;
    }

    if (options.file && node.file !== options.file) {
      return false;
    }

    if (options.query && !matchesQuery(node, options.query)) {
      return false;
    }

    return true;
  }));
}

function candidateNodes(indexes: QueryIndexes, options: FindOptions): readonly SoftwareGraphNode[] {
  if (options.id) {
    const node = indexes.nodeById.get(options.id);
    return node ? [node] : [];
  }

  if (options.file) {
    return indexes.nodesByFile.get(options.file) ?? [];
  }

  if (options.name) {
    return indexes.nodesByName.get(options.name) ?? [];
  }

  const type = options.kind ?? options.type;

  if (type) {
    return indexes.nodesByKind.get(type) ?? [];
  }

  return [...indexes.nodeById.values()];
}

function findNodeByType(
  indexes: QueryIndexes,
  type: NodeType,
  nameOrId: string,
): SoftwareGraphNode | undefined {
  const exact = indexes.nodeById.get(nameOrId);

  if (exact?.type === type) {
    return exact;
  }

  return findNodes(indexes, nameOrId).find((node) => node.type === type);
}

function findService(indexes: QueryIndexes, nameOrId: string): SoftwareGraphNode | undefined {
  const exact = indexes.nodeById.get(nameOrId);

  if (exact && (exact.type === "Service" || exact.name.endsWith("Service"))) {
    return exact;
  }

  return findNodes(indexes, nameOrId).find((node) => node.type === "Service" || node.name.endsWith("Service"));
}

function filterEdges(
  edges: readonly SoftwareGraphEdge[],
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphEdge[] {
  const relationshipSet = relationships ? new Set(relationships) : undefined;
  return edges.filter((edge) => !relationshipSet || relationshipSet.has(edge.type)).sort(compareEdges);
}

function adjacentByRelationship(
  indexes: QueryIndexes,
  nodeId: string,
  relationship: RelationshipType,
  direction: "inbound" | "outbound",
): readonly SoftwareGraphNode[] {
  const edges = direction === "inbound"
    ? indexes.incomingByNodeId.get(nodeId) ?? []
    : indexes.outgoingByNodeId.get(nodeId) ?? [];

  return sortedNodes(edges
    .filter((edge) => edge.type === relationship)
    .map((edge) => indexes.nodeById.get(direction === "outbound" ? edge.to : edge.from))
    .filter(isNode));
}

function related(
  indexes: QueryIndexes,
  nodeId: string,
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphNode[] {
  const ids = new Set<string>();

  for (const edge of adjacentEdges(indexes, nodeId, "both", relationships)) {
    if (edge.from !== nodeId) {
      ids.add(edge.from);
    }

    if (edge.to !== nodeId) {
      ids.add(edge.to);
    }
  }

  return sortedNodes([...ids].map((id) => indexes.nodeById.get(id)).filter(isNode));
}

function walk(
  indexes: QueryIndexes,
  startId: string,
  options: WalkOptions = {},
  cache?: ReturnType<typeof createQueryCache>,
): GraphTraversal {
  const normalized = normalizeWalkOptions(options);
  const cacheKey = `walk:${startId}:${stableWalkKey(normalized)}`;

  if (!normalized.predicate && !normalized.visitor && cache) {
    return cache.memo(cacheKey, () => performWalk(indexes, startId, normalized));
  }

  return performWalk(indexes, startId, normalized);
}

function performWalk(
  indexes: QueryIndexes,
  startId: string,
  options: NormalizedWalkOptions,
): GraphTraversal {
  const start = indexes.nodeById.get(startId);

  if (!start) {
    return { startId, nodes: [], edges: [], order: [] };
  }

  const relationshipSet = options.relationships ? new Set(options.relationships) : undefined;
  const nodeTypeSet = options.nodeTypes ? new Set(options.nodeTypes) : undefined;
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  const order: string[] = [];
  const queue: Array<{ readonly nodeId: string; readonly depth: number; readonly via?: SoftwareGraphEdge | undefined }> = [
    { nodeId: startId, depth: 0 },
  ];

  while (queue.length > 0) {
    const item = options.strategy === "depth-first" ? queue.pop() : queue.shift();

    if (!item || item.depth > options.depth) {
      continue;
    }

    if (!options.allowRevisit && visitedNodes.has(item.nodeId)) {
      continue;
    }

    const node = indexes.nodeById.get(item.nodeId);

    if (!node || (nodeTypeSet && !nodeTypeSet.has(node.type)) || (options.predicate && !options.predicate(node))) {
      continue;
    }

    visitedNodes.add(node.id);
    order.push(node.id);
    options.visitor?.({ node, depth: item.depth, via: item.via });

    const nextEdges = adjacentEdges(indexes, node.id, options.direction, options.relationships)
      .filter((edge) => !relationshipSet || relationshipSet.has(edge.type));

    for (const edge of nextEdges) {
      visitedEdges.add(edge.id);

      for (const nextId of nextNodeIds(edge, node.id, options.direction)) {
        if (options.allowRevisit || !visitedNodes.has(nextId)) {
          queue.push({ nodeId: nextId, depth: item.depth + 1, via: edge });
        }
      }
    }

    if (options.strategy === "depth-first") {
      queue.sort((left, right) => right.nodeId.localeCompare(left.nodeId));
    } else {
      queue.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    }
  }

  return {
    startId,
    nodes: sortedNodes([...visitedNodes].map((id) => indexes.nodeById.get(id)).filter(isNode)),
    edges: [...visitedEdges].map((id) => indexes.edgeById.get(id)).filter(isEdge).sort(compareEdges),
    order,
  };
}

function shortestPath(
  indexes: QueryIndexes,
  fromId: string,
  toId: string,
  options: WalkOptions = {},
  cache?: ReturnType<typeof createQueryCache>,
): GraphPath | undefined {
  const normalized = normalizeWalkOptions({ direction: "outbound", ...options });
  const cacheKey = `shortestPath:${fromId}:${toId}:${stableWalkKey(normalized)}`;

  return cache?.memo(cacheKey, () => performShortestPath(indexes, fromId, toId, normalized))
    ?? performShortestPath(indexes, fromId, toId, normalized);
}

function performShortestPath(
  indexes: QueryIndexes,
  fromId: string,
  toId: string,
  options: NormalizedWalkOptions,
): GraphPath | undefined {
  if (!indexes.nodeById.has(fromId) || !indexes.nodeById.has(toId)) {
    return undefined;
  }

  const queue: string[] = [fromId];
  const seen = new Set([fromId]);
  const previous = new Map<string, { readonly nodeId: string; readonly edge: SoftwareGraphEdge }>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    if (current === toId) {
      return reconstructPath(indexes, fromId, toId, previous);
    }

    for (const edge of adjacentEdges(indexes, current, options.direction, options.relationships)) {
      for (const nextId of nextNodeIds(edge, current, options.direction)) {
        if (seen.has(nextId)) {
          continue;
        }

        seen.add(nextId);
        previous.set(nextId, { nodeId: current, edge });
        queue.push(nextId);
      }
    }

    queue.sort();
  }

  return undefined;
}

function reconstructPath(
  indexes: QueryIndexes,
  fromId: string,
  toId: string,
  previous: ReadonlyMap<string, { readonly nodeId: string; readonly edge: SoftwareGraphEdge }>,
): GraphPath | undefined {
  const nodeIds = [toId];
  const edges: SoftwareGraphEdge[] = [];
  let current = toId;

  while (current !== fromId) {
    const entry = previous.get(current);

    if (!entry) {
      return undefined;
    }

    edges.push(entry.edge);
    current = entry.nodeId;
    nodeIds.push(current);
  }

  return {
    nodes: nodeIds.reverse().map((id) => indexes.nodeById.get(id)).filter(isNode),
    edges: edges.reverse(),
  };
}

function detectCycles(
  indexes: QueryIndexes,
  relationships?: readonly RelationshipType[],
  cache?: ReturnType<typeof createQueryCache>,
): readonly (readonly string[])[] {
  const key = `cycles:${relationships?.join(",") ?? "*"}`;
  return cache?.memo(key, () => performDetectCycles(indexes, relationships))
    ?? performDetectCycles(indexes, relationships);
}

function performDetectCycles(
  indexes: QueryIndexes,
  relationships?: readonly RelationshipType[],
): readonly (readonly string[])[] {
  const cycles = new Map<string, readonly string[]>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (nodeId: string): void => {
    if (visiting.has(nodeId)) {
      const index = stack.indexOf(nodeId);
      const cycle = stack.slice(index);
      const key = canonicalCycleKey(cycle);
      cycles.set(key, cycle);
      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    stack.push(nodeId);

    for (const edge of adjacentEdges(indexes, nodeId, "outbound", relationships)) {
      visit(edge.to);
    }

    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of sortedNodes([...indexes.nodeById.values()])) {
    visit(node.id);
  }

  return [...cycles.values()].sort(compareIdArrays);
}

function connectedComponents(
  indexes: QueryIndexes,
  relationships?: readonly RelationshipType[],
  cache?: ReturnType<typeof createQueryCache>,
): readonly (readonly SoftwareGraphNode[])[] {
  const key = `components:${relationships?.join(",") ?? "*"}`;
  return cache?.memo(key, () => performConnectedComponents(indexes, relationships))
    ?? performConnectedComponents(indexes, relationships);
}

function performConnectedComponents(
  indexes: QueryIndexes,
  relationships?: readonly RelationshipType[],
): readonly (readonly SoftwareGraphNode[])[] {
  const seen = new Set<string>();
  const components: SoftwareGraphNode[][] = [];

  for (const node of sortedNodes([...indexes.nodeById.values()])) {
    if (seen.has(node.id)) {
      continue;
    }

    const traversal = performWalk(indexes, node.id, normalizeWalkOptions({
      direction: "both",
      depth: Number.POSITIVE_INFINITY,
      relationships,
    }));

    for (const item of traversal.nodes) {
      seen.add(item.id);
    }

    components.push([...traversal.nodes]);
  }

  return components.sort((left, right) => right.length - left.length || compareNodes(left[0] as SoftwareGraphNode, right[0] as SoftwareGraphNode));
}

function topologicalSort(
  indexes: QueryIndexes,
  relationships?: readonly RelationshipType[],
  cache?: ReturnType<typeof createQueryCache>,
): readonly SoftwareGraphNode[] {
  const key = `topological:${relationships?.join(",") ?? "*"}`;
  return cache?.memo(key, () => performTopologicalSort(indexes, relationships))
    ?? performTopologicalSort(indexes, relationships);
}

function performTopologicalSort(
  indexes: QueryIndexes,
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphNode[] {
  const nodes = sortedNodes([...indexes.nodeById.values()]);
  const incomingCount = new Map<string, number>(nodes.map((node) => [node.id, 0] as const));
  const outgoing = new Map<string, SoftwareGraphEdge[]>();

  for (const edge of filterEdges([...indexes.edgeById.values()], relationships)) {
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
    push(outgoing, edge.from, edge);
  }

  const ready = nodes.filter((node) => incomingCount.get(node.id) === 0).map((node) => node.id).sort();
  const sorted: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift();

    if (!id) {
      continue;
    }

    sorted.push(id);

    for (const edge of (outgoing.get(id) ?? []).sort(compareEdges)) {
      const next = (incomingCount.get(edge.to) ?? 0) - 1;
      incomingCount.set(edge.to, next);

      if (next === 0) {
        ready.push(edge.to);
        ready.sort();
      }
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Graph contains a cycle and cannot be topologically sorted.");
  }

  return sorted.map((id) => indexes.nodeById.get(id)).filter(isNode);
}

function dependencyTree(
  indexes: QueryIndexes,
  nodeId: string,
  depth: number,
  seen: ReadonlySet<string> = new Set(),
): DependencyTree | undefined {
  const node = indexes.nodeById.get(nodeId);

  if (!node) {
    return undefined;
  }

  if (depth <= 0 || seen.has(nodeId)) {
    return { node, dependencies: [] };
  }

  const nextSeen = new Set([...seen, nodeId]);
  const dependencies = adjacentByRelationship(indexes, nodeId, "IMPORTS", "outbound")
    .map((dependency) => dependencyTree(indexes, dependency.id, depth - 1, nextSeen))
    .filter(isDependencyTree)
    .sort((left, right) => compareNodes(left.node, right.node));

  return { node, dependencies };
}

export function graphStatistics(graphOrIndexes: SoftwareGraph | QueryIndexes): GraphStatistics {
  const indexes = "nodeById" in graphOrIndexes ? graphOrIndexes : buildQueryIndexes(graphOrIndexes);
  const nodes = sortedNodes([...indexes.nodeById.values()]);
  const edges = [...indexes.edgeById.values()].sort(compareEdges);
  const components = performConnectedComponents(indexes);
  const cycles = performDetectCycles(indexes);
  const degreeByNode = new Map<string, number>();

  for (const node of nodes) {
    degreeByNode.set(
      node.id,
      (indexes.incomingByNodeId.get(node.id)?.length ?? 0) + (indexes.outgoingByNodeId.get(node.id)?.length ?? 0),
    );
  }

  const maximumDegree = [...degreeByNode.entries()]
    .sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId))[0];
  const mostImportedModule = mostTargeted(indexes, "IMPORTS", (node) => node.type === "Module");
  const mostDependedUponService = mostTargeted(indexes, "DEPENDS_ON", (node) =>
    node.type === "Service" || node.name.endsWith("Service"),
  );
  const largestComponent = components[0]?.length ?? 0;

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeKinds: countValues(nodes.map((node) => node.type)),
    relationshipCounts: countValues(edges.map((edge) => edge.type)),
    averageDegree: nodes.length === 0 ? 0 : round(sum([...degreeByNode.values()]) / nodes.length),
    maximumDegree: {
      nodeId: maximumDegree?.[0] ?? null,
      degree: maximumDegree?.[1] ?? 0,
    },
    disconnectedComponents: components.length,
    cycles,
    longestCallChain: longestCallChain(indexes),
    mostImportedModule,
    mostDependedUponService,
    graphDensity: nodes.length <= 1 ? 0 : round(edges.length / (nodes.length * (nodes.length - 1))),
    largestComponent,
    averagePathLength: averagePathLength(indexes, components),
  };
}

export function exportGraph(graph: SoftwareGraph, options: GraphExportOptions): string {
  const query = createQueryEngine(graph);

  switch (options.format) {
    case "json":
      return `${JSON.stringify(graph, null, 2)}\n`;
    case "mermaid":
      return exportMermaid(graph);
    case "dot":
      return exportDot(graph);
    case "graphml":
      return exportGraphML(graph);
    case "architecture-tree":
      return exportTree(query, options.rootId, ["CONTAINS"], options.depth ?? 10);
    case "dependency-tree":
      return exportTree(query, options.rootId, DEPENDENCY_RELATIONSHIPS, options.depth ?? 5);
    case "call-tree":
      return exportTree(query, options.rootId, ["CALLS"], options.depth ?? 10);
  }
}

export function exportTraversalMermaid(traversal: GraphTraversal): string {
  const lines = ["graph TD"];

  for (const node of traversal.nodes) {
    lines.push(`  "${escapeMermaid(node.id)}"["${escapeMermaid(`${node.name}\\n${node.type}`)}"]`);
  }

  for (const edge of traversal.edges) {
    lines.push(`  "${escapeMermaid(edge.from)}" -->|"${edge.type}"| "${escapeMermaid(edge.to)}"`);
  }

  return lines.join("\n");
}

function exportMermaid(graph: SoftwareGraph): string {
  const lines = ["graph TD"];
  const nodeNames = new Map(graph.nodes.map((node, index) => [node.id, `n${index}`] as const));

  for (const node of graph.nodes) {
    lines.push(`  ${nodeNames.get(node.id)}["${escapeMermaid(`${node.name}\\n${node.type}`)}"]`);
  }

  for (const edge of graph.edges) {
    lines.push(`  ${nodeNames.get(edge.from)} -->|"${edge.type}"| ${nodeNames.get(edge.to)}`);
  }

  return lines.join("\n");
}

function exportDot(graph: SoftwareGraph): string {
  return [
    "digraph SoftwareGraph {",
    ...graph.nodes.map((node) => `  "${escapeDot(node.id)}" [label="${escapeDot(`${node.name}\\n${node.type}`)}"];`),
    ...graph.edges.map((edge) => `  "${escapeDot(edge.from)}" -> "${escapeDot(edge.to)}" [label="${edge.type}"];`),
    "}",
  ].join("\n");
}

function exportGraphML(graph: SoftwareGraph): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '  <graph edgedefault="directed">',
    ...graph.nodes.map((node) => `    <node id="${escapeXml(node.id)}"><data key="label">${escapeXml(node.name)}</data><data key="type">${node.type}</data></node>`),
    ...graph.edges.map((edge) => `    <edge id="${escapeXml(edge.id)}" source="${escapeXml(edge.from)}" target="${escapeXml(edge.to)}"><data key="type">${edge.type}</data></edge>`),
    "  </graph>",
    "</graphml>",
  ].join("\n");
}

function exportTree(
  query: QueryEngine,
  rootId: string | undefined,
  relationships: readonly RelationshipType[],
  depth: number,
): string {
  const roots = rootId
    ? [query.findNode(rootId)].filter(isNode)
    : query.findNodes().filter((node) => query.incoming(node.id, relationships).length === 0);
  const lines: string[] = [];

  for (const root of roots) {
    writeTree(query, root.id, relationships, depth, "", new Set(), lines);
  }

  return lines.join("\n");
}

function writeTree(
  query: QueryEngine,
  nodeId: string,
  relationships: readonly RelationshipType[],
  depth: number,
  indent: string,
  seen: ReadonlySet<string>,
  lines: string[],
): void {
  const node = query.findNode(nodeId);

  if (!node) {
    return;
  }

  lines.push(`${indent}${node.type} ${node.id}`);

  if (depth <= 0 || seen.has(node.id)) {
    return;
  }

  const nextSeen = new Set([...seen, node.id]);

  for (const edge of query.outgoing(node.id, relationships)) {
    writeTree(query, edge.to, relationships, depth - 1, `${indent}  `, nextSeen, lines);
  }
}

function mostTargeted(
  indexes: QueryIndexes,
  relationship: RelationshipType,
  predicate: (node: SoftwareGraphNode) => boolean,
): { readonly nodeId: string | null; readonly count: number } {
  const counts = new Map<string, number>();

  for (const edge of indexes.edgesByType.get(relationship) ?? []) {
    const target = indexes.nodeById.get(edge.to);

    if (target && predicate(target)) {
      counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
    }
  }

  const top = [...counts.entries()].sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId))[0];
  return { nodeId: top?.[0] ?? null, count: top?.[1] ?? 0 };
}

function longestCallChain(indexes: QueryIndexes): readonly string[] {
  const calls = indexes.edgesByType.get("CALLS") ?? [];
  const outgoingCalls = new Map<string, SoftwareGraphEdge[]>();

  for (const edge of calls) {
    push(outgoingCalls, edge.from, edge);
  }

  const memo = new Map<string, readonly string[]>();
  const visit = (nodeId: string, active: ReadonlySet<string>): readonly string[] => {
    if (active.has(nodeId)) {
      return [nodeId];
    }

    const cached = memo.get(nodeId);

    if (cached) {
      return cached;
    }

    let best: readonly string[] = [nodeId];
    const nextActive = new Set([...active, nodeId]);

    for (const edge of (outgoingCalls.get(nodeId) ?? []).sort(compareEdges)) {
      const candidate = [nodeId, ...visit(edge.to, nextActive)];

      if (candidate.length > best.length || (candidate.length === best.length && candidate.join("\0") < best.join("\0"))) {
        best = candidate;
      }
    }

    memo.set(nodeId, best);
    return best;
  };

  return sortedNodes([...indexes.nodeById.values()])
    .map((node) => visit(node.id, new Set()))
    .sort((left, right) => right.length - left.length || left.join("\0").localeCompare(right.join("\0")))[0] ?? [];
}

function averagePathLength(
  indexes: QueryIndexes,
  components: readonly (readonly SoftwareGraphNode[])[],
): number | null {
  if (indexes.nodeById.size > 250) {
    return null;
  }

  let pathCount = 0;
  let totalLength = 0;

  for (const component of components) {
    for (const start of component) {
      const distances = shortestDistances(indexes, start.id);

      for (const target of component) {
        if (target.id === start.id) {
          continue;
        }

        const distance = distances.get(target.id);

        if (distance !== undefined) {
          pathCount += 1;
          totalLength += distance;
        }
      }
    }
  }

  return pathCount === 0 ? 0 : round(totalLength / pathCount);
}

function shortestDistances(indexes: QueryIndexes, startId: string): ReadonlyMap<string, number> {
  const distances = new Map([[startId, 0]]);
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    for (const edge of adjacentEdges(indexes, current, "both")) {
      for (const nextId of nextNodeIds(edge, current, "both")) {
        if (!distances.has(nextId)) {
          distances.set(nextId, (distances.get(current) ?? 0) + 1);
          queue.push(nextId);
        }
      }
    }

    queue.sort();
  }

  return distances;
}

function services(indexes: QueryIndexes): readonly SoftwareGraphNode[] {
  return sortedNodes([
    ...(indexes.nodesByKind.get("Service") ?? []),
    ...[...indexes.nodeById.values()].filter((node) => node.name.endsWith("Service")),
  ]);
}

function byType(indexes: QueryIndexes, type: NodeType): readonly SoftwareGraphNode[] {
  return sortedNodes(indexes.nodesByKind.get(type) ?? []);
}

function adjacentEdges(
  indexes: QueryIndexes,
  nodeId: string,
  direction: TraversalDirection,
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphEdge[] {
  const relationshipSet = relationships ? new Set(relationships) : undefined;
  const edges = direction === "inbound"
    ? indexes.incomingByNodeId.get(nodeId) ?? []
    : direction === "outbound"
      ? indexes.outgoingByNodeId.get(nodeId) ?? []
      : [...(indexes.incomingByNodeId.get(nodeId) ?? []), ...(indexes.outgoingByNodeId.get(nodeId) ?? [])];

  return edges.filter((edge) => !relationshipSet || relationshipSet.has(edge.type)).sort(compareEdges);
}

function nextNodeIds(
  edge: SoftwareGraphEdge,
  currentNodeId: string,
  direction: TraversalDirection,
): readonly string[] {
  if (direction === "inbound") {
    return [edge.from];
  }

  if (direction === "outbound") {
    return [edge.to];
  }

  return [edge.from, edge.to].filter((id) => id !== currentNodeId).sort();
}

function normalizeWalkOptions(options: WalkOptions): NormalizedWalkOptions {
  return {
    direction: options.direction ?? "outbound",
    strategy: options.strategy ?? "breadth-first",
    depth: options.depth ?? 2,
    allowRevisit: options.allowRevisit ?? false,
    relationships: options.relationships,
    nodeTypes: options.nodeTypes,
    predicate: options.predicate,
    visitor: options.visitor,
  };
}

function stableWalkKey(options: WalkOptions): string {
  return [
    options.direction ?? "outbound",
    options.strategy ?? "breadth-first",
    String(options.depth ?? 2),
    String(options.allowRevisit ?? false),
    [...(options.relationships ?? [])].sort().join(","),
    [...(options.nodeTypes ?? [])].sort().join(","),
  ].join("|");
}

function matchesQuery(node: SoftwareGraphNode, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const haystacks = searchHaystacks(node);

  if (haystacks.some((haystack) => haystack.includes(normalizedQuery))) {
    return true;
  }

  const queryTokens = searchTokens(normalizedQuery);

  if (queryTokens.length === 0) {
    return false;
  }

  return haystacks.some((haystack) => queryTokens.every((token) => haystack.includes(token)));
}

function searchHaystacks(node: SoftwareGraphNode): readonly string[] {
  return [
    normalizeSearchText(node.id),
    normalizeSearchText(node.name),
    normalizeSearchText(node.type),
    normalizeSearchText(node.file ?? ""),
    normalizeSearchText(`${node.name} ${node.type}`),
    normalizeSearchText(`${node.id} ${node.name} ${node.type} ${node.file ?? ""} ${metadataSearchText(node.metadata)}`),
  ].filter(Boolean);
}

function normalizeSearchText(value: string): string {
  return splitCamelCase(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitCamelCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function searchTokens(value: string): readonly string[] {
  return [...new Set(value.split(" ").filter((token) => token.length > 0))].sort();
}

function metadataSearchText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(metadataSearchText).join(" ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key} ${metadataSearchText(entry)}`)
      .join(" ");
  }

  return "";
}

function canonicalCycleKey(cycle: readonly string[]): string {
  if (cycle.length === 0) {
    return "";
  }

  const rotations = cycle.map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)].join("\0"));
  return rotations.sort()[0] ?? cycle.join("\0");
}

function compareIdArrays(left: readonly string[], right: readonly string[]): number {
  return left.join("\0").localeCompare(right.join("\0"));
}

function countValues(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function sortMapValues<K, V>(
  map: ReadonlyMap<K, readonly V[]>,
  compare: (left: V, right: V) => number,
): ReadonlyMap<K, readonly V[]> {
  return new Map([...map.entries()].map(([key, values]) => [key, [...values].sort(compare)] as const));
}

function sortedNodes(nodes: readonly SoftwareGraphNode[]): readonly SoftwareGraphNode[] {
  const seen = new Set<string>();
  const result: SoftwareGraphNode[] = [];

  for (const node of [...nodes].sort(compareNodes)) {
    if (!seen.has(node.id)) {
      seen.add(node.id);
      result.push(node);
    }
  }

  return result;
}

function compareNodes(left: SoftwareGraphNode, right: SoftwareGraphNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function isNode(node: SoftwareGraphNode | undefined): node is SoftwareGraphNode {
  return Boolean(node);
}

function isEdge(edge: SoftwareGraphEdge | undefined): edge is SoftwareGraphEdge {
  return Boolean(edge);
}

function isDependencyTree(tree: DependencyTree | undefined): tree is DependencyTree {
  return Boolean(tree);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, "'");
}

function escapeDot(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
