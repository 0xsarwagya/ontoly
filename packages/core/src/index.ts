export const SOFTWARE_GRAPH_VERSION = "1.0.0";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  readonly [key: string]: JsonValue | undefined;
};

export const NODE_TYPES = [
  "Workspace",
  "Application",
  "Function",
  "Method",
  "Class",
  "Interface",
  "TypeAlias",
  "Enum",
  "Namespace",
  "Module",
  "Package",
  "Script",
  "Dependency",
  "Task",
  "Pipeline",
  "BuildTarget",
  "Configuration",
  "Container",
  "Workflow",
  "Job",
  "Step",
  "Framework",
  "Decorator",
  "Import",
  "Export",
  "Route",
  "Resource",
  "Operation",
  "Model",
  "Field",
  "Middleware",
  "Provider",
  "Factory",
  "Service",
  "Repository",
  "DatabaseTable",
  "EnvironmentVariable",
  "Event",
  "Permission",
  "Exception",
  "Controller",
  "Guard",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  "CALLS",
  "IMPORTS",
  "EXPORTS",
  "USES",
  "RETURNS",
  "THROWS",
  "READS",
  "WRITES",
  "CREATES",
  "IMPLEMENTS",
  "EXTENDS",
  "DEPENDS_ON",
  "DECORATES",
  "INJECTS",
  "REGISTERED_IN",
  "REGISTERS",
  "DECLARES",
  "MOUNTS",
  "PROVIDES",
  "CONSUMES",
  "CONFIGURES",
  "EXECUTES",
  "GENERATES",
  "HANDLES",
  "OVERRIDES",
  "AUTHORIZES",
  "BELONGS_TO",
  "PUBLISHES",
  "SUBSCRIBES",
  "CONTAINS",
  "EXPOSES",
  "REFERENCES",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface SourceSpan {
  readonly file: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

export interface SoftwareGraphRepository {
  readonly root: string;
  readonly name: string;
  readonly packageManager?: string | undefined;
  readonly packageName?: string | undefined;
}

export interface SoftwareGraphNode {
  readonly id: string;
  readonly type: NodeType;
  readonly name: string;
  readonly file?: string | undefined;
  readonly package?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface EdgeEvidence {
  readonly kind: "syntax" | "resolver" | "config" | "semantic" | "plugin";
  readonly confidence: "exact" | "inferred" | "low";
  readonly span?: SourceSpan | undefined;
  readonly description?: string | undefined;
}

export interface SoftwareGraphEdge {
  readonly id: string;
  readonly type: RelationshipType;
  readonly from: string;
  readonly to: string;
  readonly evidence?: readonly EdgeEvidence[] | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface SoftwareGraphDiagnostic {
  readonly id: string;
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly nodeId?: string | undefined;
  readonly edgeId?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface GraphIndexes {
  readonly nodeIdsByType: Partial<Record<NodeType, readonly string[]>>;
  readonly edgeIdsByType: Partial<Record<RelationshipType, readonly string[]>>;
  readonly inboundEdgeIdsByNodeId: Record<string, readonly string[]>;
  readonly outboundEdgeIdsByNodeId: Record<string, readonly string[]>;
  readonly edgeIdsBySourceAndType: Record<string, readonly string[]>;
}

export interface SoftwareGraphMetadata {
  readonly generatedAt: string;
  readonly deterministicHash: string;
  readonly fileCount: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly parserVersions: Record<string, string>;
  readonly durationMs?: number | undefined;
}

export interface SoftwareGraph {
  readonly version: string;
  readonly repository: SoftwareGraphRepository;
  readonly nodes: readonly SoftwareGraphNode[];
  readonly edges: readonly SoftwareGraphEdge[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly indexes: GraphIndexes;
  readonly metadata: SoftwareGraphMetadata;
}

export interface CreateNodeIdInput {
  readonly type: NodeType;
  readonly name: string;
  readonly file?: string | undefined;
  readonly signature?: string | undefined;
}

export interface OntolyPluginContext {
  readonly graph: SoftwareGraph;
}

export interface OntolyPluginResult {
  readonly artifacts?: readonly PluginArtifact[] | undefined;
  readonly diagnostics?: readonly SoftwareGraphDiagnostic[] | undefined;
}

export interface PluginArtifact {
  readonly path: string;
  readonly contents: string;
  readonly mediaType: string;
}

export interface OntolyPlugin {
  readonly name: string;
  readonly version: string;
  readonly run: (context: OntolyPluginContext) => Promise<OntolyPluginResult> | OntolyPluginResult;
}

const NODE_TYPE_PREFIX: Record<NodeType, string> = {
  Workspace: "workspace",
  Application: "app",
  Function: "fn",
  Method: "method",
  Class: "class",
  Interface: "iface",
  TypeAlias: "type",
  Enum: "enum",
  Namespace: "ns",
  Module: "mod",
  Package: "pkg",
  Script: "script",
  Dependency: "dep",
  Task: "task",
  Pipeline: "pipeline",
  BuildTarget: "target",
  Configuration: "config",
  Container: "container",
  Workflow: "workflow",
  Job: "job",
  Step: "step",
  Framework: "framework",
  Decorator: "decorator",
  Import: "import",
  Export: "export",
  Route: "route",
  Resource: "resource",
  Operation: "op",
  Model: "model",
  Field: "field",
  Middleware: "middleware",
  Provider: "provider",
  Factory: "factory",
  Service: "service",
  Repository: "repo",
  DatabaseTable: "table",
  EnvironmentVariable: "env",
  Event: "event",
  Permission: "permission",
  Exception: "exception",
  Controller: "controller",
  Guard: "guard",
};

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

export function stableHash(input: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function createNodeId(input: CreateNodeIdInput): string {
  const prefix = NODE_TYPE_PREFIX[input.type];
  const name = input.name.trim();
  const normalizedFile = input.file ? normalizePath(input.file) : undefined;

  if (normalizedFile) {
    return `${prefix}:${normalizedFile}:${name}`;
  }

  if (input.signature) {
    return `${prefix}:${name}:${stableHash(input.signature)}`;
  }

  return `${prefix}:${name}`;
}

export function createEdgeId(type: RelationshipType, from: string, to: string): string {
  return `edge:${type.toLowerCase()}:${stableHash(`${type}|${from}|${to}`)}`;
}

export function createDiagnosticId(code: string, message: string, location = ""): string {
  return `diag:${code.toLowerCase()}:${stableHash(`${code}|${message}|${location}`)}`;
}

export function createSyntaxEvidence(
  span: SourceSpan,
  description?: string,
  confidence: EdgeEvidence["confidence"] = "exact",
): EdgeEvidence {
  const evidence: EdgeEvidence = {
    kind: "syntax",
    confidence,
    span,
  };

  if (description) {
    return { ...evidence, description };
  }

  return evidence;
}

export function createGraphBuilder(repository: SoftwareGraphRepository): GraphBuilder {
  return new GraphBuilder(repository);
}

export class GraphBuilder {
  readonly #repository: SoftwareGraphRepository;
  readonly #nodes = new Map<string, SoftwareGraphNode>();
  readonly #edges = new Map<string, SoftwareGraphEdge>();
  readonly #diagnostics = new Map<string, SoftwareGraphDiagnostic>();
  #fileCount = 0;
  #parserVersions: Record<string, string> = {};

  constructor(repository: SoftwareGraphRepository) {
    this.#repository = repository;
  }

  setFileCount(fileCount: number): void {
    this.#fileCount = fileCount;
  }

  setParserVersion(name: string, version: string): void {
    this.#parserVersions = {
      ...this.#parserVersions,
      [name]: version,
    };
  }

  addNode(node: SoftwareGraphNode): SoftwareGraphNode {
    const normalizedNode = normalizeNode(node);
    const existing = this.#nodes.get(normalizedNode.id);

    if (!existing) {
      this.#nodes.set(normalizedNode.id, normalizedNode);
      return normalizedNode;
    }

    const merged = mergeNode(existing, normalizedNode);
    this.#nodes.set(merged.id, merged);
    return merged;
  }

  addEdge(edge: Omit<SoftwareGraphEdge, "id"> & { readonly id?: string | undefined }): SoftwareGraphEdge {
    const normalizedEdge = normalizeEdge({
      ...edge,
      id: edge.id ?? createEdgeId(edge.type, edge.from, edge.to),
    });
    const existing = this.#edges.get(normalizedEdge.id);

    if (!existing) {
      this.#edges.set(normalizedEdge.id, normalizedEdge);
      return normalizedEdge;
    }

    const merged = mergeEdge(existing, normalizedEdge);
    this.#edges.set(merged.id, merged);
    return merged;
  }

  addDiagnostic(diagnostic: SoftwareGraphDiagnostic): SoftwareGraphDiagnostic {
    const existing = this.#diagnostics.get(diagnostic.id);

    if (existing) {
      return existing;
    }

    this.#diagnostics.set(diagnostic.id, diagnostic);
    return diagnostic;
  }

  toGraph(durationMs?: number): SoftwareGraph {
    return createSoftwareGraph({
      repository: this.#repository,
      nodes: [...this.#nodes.values()],
      edges: [...this.#edges.values()],
      diagnostics: [...this.#diagnostics.values()],
      fileCount: this.#fileCount,
      parserVersions: this.#parserVersions,
      durationMs,
    });
  }
}

export interface CreateSoftwareGraphInput {
  readonly repository: SoftwareGraphRepository;
  readonly nodes: readonly SoftwareGraphNode[];
  readonly edges: readonly SoftwareGraphEdge[];
  readonly diagnostics?: readonly SoftwareGraphDiagnostic[] | undefined;
  readonly fileCount?: number | undefined;
  readonly parserVersions?: Record<string, string> | undefined;
  readonly durationMs?: number | undefined;
}

export function createSoftwareGraph(input: CreateSoftwareGraphInput): SoftwareGraph {
  const nodes = [...input.nodes].map(normalizeNode).sort(compareNodes);
  const edges = [...input.edges].map(normalizeEdge).sort(compareEdges);
  const diagnostics = [...(input.diagnostics ?? [])].sort(compareDiagnostics);
  const indexes = buildIndexes(nodes, edges);
  const deterministicHash = stableHash(
    stableStringify({
      repository: input.repository,
      nodes,
      edges,
      diagnostics,
      version: SOFTWARE_GRAPH_VERSION,
    }),
  );

  const metadata: SoftwareGraphMetadata = {
    generatedAt: "1970-01-01T00:00:00.000Z",
    deterministicHash,
    fileCount: input.fileCount ?? 0,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    parserVersions: input.parserVersions ?? {},
  };

  const metadataWithDuration =
    input.durationMs === undefined ? metadata : { ...metadata, durationMs: input.durationMs };

  return {
    version: SOFTWARE_GRAPH_VERSION,
    repository: input.repository,
    nodes,
    edges,
    diagnostics,
    indexes,
    metadata: metadataWithDuration,
  };
}

export function buildIndexes(
  nodes: readonly SoftwareGraphNode[],
  edges: readonly SoftwareGraphEdge[],
): GraphIndexes {
  const nodeIdsByType: Partial<Record<NodeType, string[]>> = {};
  const edgeIdsByType: Partial<Record<RelationshipType, string[]>> = {};
  const inboundEdgeIdsByNodeId: Record<string, string[]> = {};
  const outboundEdgeIdsByNodeId: Record<string, string[]> = {};
  const edgeIdsBySourceAndType: Record<string, string[]> = {};

  for (const node of nodes) {
    pushIndexValue(nodeIdsByType, node.type, node.id);
  }

  for (const edge of edges) {
    pushIndexValue(edgeIdsByType, edge.type, edge.id);
    pushRecordValue(outboundEdgeIdsByNodeId, edge.from, edge.id);
    pushRecordValue(inboundEdgeIdsByNodeId, edge.to, edge.id);
    pushRecordValue(edgeIdsBySourceAndType, `${edge.from}:${edge.type}`, edge.id);
  }

  return {
    nodeIdsByType: sortIndex(nodeIdsByType),
    edgeIdsByType: sortIndex(edgeIdsByType),
    inboundEdgeIdsByNodeId: sortRecord(inboundEdgeIdsByNodeId),
    outboundEdgeIdsByNodeId: sortRecord(outboundEdgeIdsByNodeId),
    edgeIdsBySourceAndType: sortRecord(edgeIdsBySourceAndType),
  };
}

export function summarizeGraph(graph: SoftwareGraph): string {
  const nodeSummary = summarizeCounts(graph.nodes.map((node) => node.type));
  const edgeSummary = summarizeCounts(graph.edges.map((edge) => edge.type));

  return [
    `Repository: ${graph.repository.name}`,
    `Files: ${graph.metadata.fileCount}`,
    `Nodes: ${graph.nodes.length}${nodeSummary ? ` (${nodeSummary})` : ""}`,
    `Edges: ${graph.edges.length}${edgeSummary ? ` (${edgeSummary})` : ""}`,
    `Diagnostics: ${graph.diagnostics.length}`,
    `Hash: ${graph.metadata.deterministicHash}`,
  ].join("\n");
}

export function getNode(graph: SoftwareGraph, id: string): SoftwareGraphNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

export function getEdge(graph: SoftwareGraph, id: string): SoftwareGraphEdge | undefined {
  return graph.edges.find((edge) => edge.id === id);
}

function normalizeNode(node: SoftwareGraphNode): SoftwareGraphNode {
  const normalized: SoftwareGraphNode = {
    id: node.id,
    type: node.type,
    name: node.name,
  };

  return withOptionalProperties(normalized, {
    file: node.file ? normalizePath(node.file) : undefined,
    package: node.package,
    span: node.span ? normalizeSpan(node.span) : undefined,
    metadata: node.metadata,
  });
}

function normalizeEdge(edge: SoftwareGraphEdge): SoftwareGraphEdge {
  const normalized: SoftwareGraphEdge = {
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
  };

  return withOptionalProperties(normalized, {
    evidence: edge.evidence?.map((item) => ({
      ...item,
      span: item.span ? normalizeSpan(item.span) : undefined,
    })),
    metadata: edge.metadata,
  });
}

function normalizeSpan(span: SourceSpan): SourceSpan {
  return {
    ...span,
    file: normalizePath(span.file),
  };
}

function mergeNode(left: SoftwareGraphNode, right: SoftwareGraphNode): SoftwareGraphNode {
  const merged: SoftwareGraphNode = {
    ...left,
    metadata: mergeJsonObject(left.metadata, right.metadata),
  };

  return withOptionalProperties(merged, {
    span: left.span ?? right.span,
    file: left.file ?? right.file,
    package: left.package ?? right.package,
  });
}

function mergeEdge(left: SoftwareGraphEdge, right: SoftwareGraphEdge): SoftwareGraphEdge {
  const evidence = dedupeEvidence([...(left.evidence ?? []), ...(right.evidence ?? [])]);
  const merged: SoftwareGraphEdge = {
    ...left,
    metadata: mergeJsonObject(left.metadata, right.metadata),
  };

  return withOptionalProperties(merged, {
    evidence: evidence.length > 0 ? evidence : undefined,
  });
}

function mergeJsonObject(
  left: JsonObject | undefined,
  right: JsonObject | undefined,
): JsonObject | undefined {
  if (!left && !right) {
    return undefined;
  }

  return {
    ...(left ?? {}),
    ...(right ?? {}),
  };
}

function dedupeEvidence(evidence: readonly EdgeEvidence[]): readonly EdgeEvidence[] {
  const seen = new Set<string>();
  const deduped: EdgeEvidence[] = [];

  for (const item of evidence) {
    const key = stableStringify(item);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function pushIndexValue<T extends string>(
  index: Partial<Record<T, string[]>>,
  key: T,
  value: string,
): void {
  const values = index[key] ?? [];
  values.push(value);
  index[key] = values;
}

function pushRecordValue(index: Record<string, string[]>, key: string, value: string): void {
  const values = index[key] ?? [];
  values.push(value);
  index[key] = values;
}

function sortIndex<T extends string>(
  index: Partial<Record<T, string[]>>,
): Partial<Record<T, readonly string[]>> {
  const sortedEntries = Object.entries(index)
    .map(([key, values]) => [key, [...(values as string[])].sort()] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(sortedEntries) as unknown as Partial<Record<T, readonly string[]>>;
}

function sortRecord(index: Record<string, string[]>): Record<string, readonly string[]> {
  return Object.fromEntries(
    Object.entries(index)
      .map(([key, values]) => [key, [...values].sort()] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function summarizeCounts(values: readonly string[]): string {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => `${value} ${count}`)
    .join(", ");
}

function compareNodes(left: SoftwareGraphNode, right: SoftwareGraphNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function compareDiagnostics(
  left: SoftwareGraphDiagnostic,
  right: SoftwareGraphDiagnostic,
): number {
  return left.id.localeCompare(right.id);
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  const entries = Object.entries(optional).filter(([, value]) => value !== undefined);
  return {
    ...target,
    ...Object.fromEntries(entries),
  } as T & O;
}
