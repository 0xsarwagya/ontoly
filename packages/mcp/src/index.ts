import type {
  JsonObject,
  JsonValue,
  RelationshipType,
  SoftwareGraph,
  SoftwareGraphDiagnostic,
  SoftwareGraphEdge,
  SoftwareGraphNode,
  SourceSpan,
} from "@0xsarwagya/ontoly-core";
import {
  CAPABILITY_NAMES as SEMANTIC_CAPABILITY_NAMES,
  capabilityResultToJson,
  createCapabilityEngine as createSemanticCapabilityEngine,
  type CapabilityInput,
  type CapabilityName,
} from "@0xsarwagya/ontoly-capabilities";
import {
  createSemanticIndex,
  findConfiguration as searchConfiguration,
  findFeature as searchFeature,
  findRepositoryConcept as searchRepositoryConcept,
  resolveIntent,
  type SemanticSearchResult,
} from "@0xsarwagya/ontoly-index";
import { createQueryEngine, type GraphTraversal, type QueryEngine } from "@0xsarwagya/ontoly-query";

const LEGACY_MCP_CAPABILITIES = [
  "FindFunction",
  "FindNode",
  "FindDependencies",
  "FindDependents",
  "TraceExecution",
  "InspectFile",
  "InspectModule",
  "InspectClass",
  "InspectFunction",
  "FindCycles",
  "FindDeadCode",
  "FindEntrypoints",
  "FindConfiguration",
  "FindResponsibleFunction",
  "ExplainArchitecture",
  "TraceRequestLifecycle",
  "FindFeatureOwner",
  "FindAuthenticationFlow",
  "ImpactAnalysis",
  "FindDatabaseAccess",
  "FindConfigurationUsage",
  "FindUnusedFeature",
  "GraphStatistics",
] as const;

const LEGACY_MCP_CAPABILITY_SET = new Set<string>(LEGACY_MCP_CAPABILITIES);
const SEARCH_MCP_CAPABILITIES = [
  "SearchConcept",
  "FindFeature",
  "FindRepositoryConcept",
  "ResolveIntent",
] as const;

export const MCP_CAPABILITIES = [
  ...LEGACY_MCP_CAPABILITIES,
  ...SEARCH_MCP_CAPABILITIES,
  ...SEMANTIC_CAPABILITY_NAMES.filter((name) => !LEGACY_MCP_CAPABILITY_SET.has(name)),
] as const;

export type McpCapabilityName = (typeof MCP_CAPABILITIES)[number];

export interface McpCapability {
  readonly name: McpCapabilityName;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
  readonly outputSchema: JsonObject;
  readonly examples: readonly JsonObject[];
}

export interface McpCapabilityRequest {
  readonly capability: McpCapabilityName;
  readonly input?: JsonObject | undefined;
}

export interface McpCapabilityResponse {
  readonly capability: McpCapabilityName;
  readonly result: JsonValue;
  readonly provenance: JsonObject;
  readonly confidence: JsonObject;
}

export interface McpCapabilityRegistry {
  readonly capabilities: () => readonly McpCapability[];
  readonly register: (capability: RegisteredCapability) => McpCapabilityRegistry;
  readonly execute: (request: McpCapabilityRequest) => McpCapabilityResponse;
}

export interface McpRuntime {
  readonly capabilities: readonly McpCapability[];
  readonly execute: (request: McpCapabilityRequest) => McpCapabilityResponse;
}

interface RegisteredCapability extends McpCapability {
  readonly execute: (query: QueryEngine, input: JsonObject) => JsonValue;
}

export class McpCapabilityError extends Error {
  readonly code: string;
  readonly explanation: string;
  readonly expectedSchema: JsonObject;
  readonly suggestedFix: string;

  constructor(input: {
    readonly code: string;
    readonly explanation: string;
    readonly expectedSchema: JsonObject;
    readonly suggestedFix: string;
  }) {
    super(input.explanation);
    this.name = "McpCapabilityError";
    this.code = input.code;
    this.explanation = input.explanation;
    this.expectedSchema = input.expectedSchema;
    this.suggestedFix = input.suggestedFix;
  }
}

export function createMcpRuntime(graph: SoftwareGraph): McpRuntime {
  const query = createQueryEngine(graph);
  const registry = createCapabilityRegistry(query, defaultCapabilities());

  return {
    capabilities: registry.capabilities(),
    execute: registry.execute,
  };
}

export function createCapabilityRegistry(
  query: QueryEngine,
  initialCapabilities: readonly RegisteredCapability[] = [],
): McpCapabilityRegistry {
  const capabilities = new Map<McpCapabilityName, RegisteredCapability>();

  const registry: McpCapabilityRegistry = {
    capabilities: () => [...capabilities.values()].map(publicCapability).sort(compareCapabilities),
    register: (capability) => {
      validateCapability(capability);
      capabilities.set(capability.name, capability);
      return registry;
    },
    execute: (request) => {
      const capability = capabilities.get(request.capability);

      if (!capability) {
        throw new McpCapabilityError({
          code: "MCP_UNKNOWN_CAPABILITY",
          explanation: `Unknown MCP capability: ${request.capability}`,
          expectedSchema: { capabilities: [...MCP_CAPABILITIES] },
          suggestedFix: "Call ontoly mcp --list and use one of the advertised capability names.",
        });
      }

      const input = request.input ?? {};
      validateInput(capability, input);
      const result = capability.execute(query, input);

      return {
        capability: request.capability,
        result,
        provenance: createProvenance(query, capability, result),
        confidence: deriveConfidence(result),
      };
    },
  };

  for (const capability of initialCapabilities) {
    registry.register(capability);
  }

  return registry;
}

export function createMcpCapabilities(): readonly McpCapability[] {
  return defaultCapabilities().map(publicCapability).sort(compareCapabilities);
}

function defaultCapabilities(): readonly RegisteredCapability[] {
  return [
    capability("FindFunction", "Find functions and methods by id, name, file, or free-text query.", stringInput("query"), arrayOutput("nodes"), [
      { input: { query: "main" } },
    ], (query, input) =>
      query.findNodes(readString(input, "query"))
        .filter((node) => node.type === "Function" || node.type === "Method")
        .map(serializeNode)),
    capability("FindNode", "Find graph nodes by id, name, file, kind, or free-text query.", stringInput("query"), arrayOutput("nodes"), [
      { input: { query: "UserService" } },
    ], (query, input) => query.findNodes(readString(input, "query")).map(serializeNode)),
    capability("FindDependencies", "Trace outbound dependency relationships for a node.", idInput(), traversalOutput(), [
      { input: { id: "mod:src/index.ts", depth: 2 } },
    ], (query, input) => serializeTraversal(query.dependencies(resolveNode(query, input).id, readNumber(input, "depth", 3)))),
    capability("FindDependents", "Trace inbound dependency relationships for a node.", idInput(), traversalOutput(), [
      { input: { id: "mod:src/auth.ts", depth: 2 } },
    ], (query, input) => serializeTraversal(query.dependents(resolveNode(query, input).id, readNumber(input, "depth", 3)))),
    capability("TraceExecution", "Trace CALLS relationships from a function or method.", idInput(), traversalOutput(), [
      { input: { id: "fn:src/index.ts:main", depth: 5 } },
    ], (query, input) => serializeTraversal(query.trace(resolveNode(query, input, ["Function", "Method"]).id, { depth: readNumber(input, "depth", 5) }))),
    capability("InspectFile", "Inspect symbols and relationships for a source file.", stringInput("file"), objectOutput(), [
      { input: { file: "src/service.ts" } },
    ], (query, input) => inspectFile(query, readString(input, "file"))),
    capability("InspectModule", "Inspect a module node and its imports, exports, and contained symbols.", idInput(), objectOutput(), [
      { input: { id: "mod:src/service.ts" } },
    ], (query, input) => inspectNode(query, resolveNode(query, input, ["Module"]), ["CONTAINS", "IMPORTS", "EXPORTS"])),
    capability("InspectClass", "Inspect a class node and related methods.", idInput(), objectOutput(), [
      { input: { id: "class:src/service.ts:UserService" } },
    ], (query, input) => inspectNode(query, resolveNode(query, input, ["Class"]), ["CONTAINS", "CALLS"])),
    capability("InspectFunction", "Inspect a function or method node, callers, and callees.", idInput(), objectOutput(), [
      { input: { id: "fn:src/index.ts:main" } },
    ], (query, input) => inspectNode(query, resolveNode(query, input, ["Function", "Method"]), ["CALLS"])),
    capability("FindCycles", "Find deterministic graph cycles.", objectInput(), objectOutput(), [
      { input: {} },
    ], (query) => ({ cycles: query.detectCycles().map((cycle) => [...cycle]) })),
    capability("FindDeadCode", "Find functions and methods without inbound CALLS edges.", objectInput(), arrayOutput("nodes"), [
      { input: {} },
    ], (query) =>
      query.findNodes()
        .filter((node) => node.type === "Function" || node.type === "Method")
        .filter((node) => query.callers(node.id).length === 0)
        .map(serializeNode)),
    capability("FindEntrypoints", "Find functions, methods, and modules with no inbound structural or call edges.", objectInput(), arrayOutput("nodes"), [
      { input: {} },
    ], (query) =>
      query.findNodes()
        .filter((node) => ["Function", "Method", "Module"].includes(node.type))
        .filter((node) => query.incoming(node.id, ["CALLS", "IMPORTS"]).length === 0)
        .map(serializeNode)),
    capability("FindConfiguration", "Find configuration and environment variable nodes, optionally by natural concept.", optionalQueryInput(), objectOutput(), [
      { input: {} },
      { input: { query: "JWT secret" } },
    ], (query, input) => {
      const value = readString(input, "query");
      if (value) {
        return searchResultToJson(searchConfiguration(createSemanticIndex(query.graph), value));
      }
      return {
        nodes: query.findNodes()
          .filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable")
          .map(serializeNode),
      };
    }),
    capability("FindResponsibleFunction", "Find functions or methods responsible for a route, node, or search query.", stringInput("query"), objectOutput(), [
      { input: { query: "GET:/login" } },
    ], (query, input) => findResponsibleFunction(query, readString(input, "query"))),
    capability("ExplainArchitecture", "Summarize architecture-level graph structure.", objectInput(), objectOutput(), [
      { input: {} },
    ], (query) => architectureSummary(query)),
    capability("TraceRequestLifecycle", "Trace a route through handler and CALLS relationships.", stringInput("query"), objectOutput(), [
      { input: { query: "GET:/users" } },
    ], (query, input) => traceRequestLifecycle(query, readString(input, "query"), readNumber(input, "depth", 5))),
    capability("FindFeatureOwner", "Find likely owner nodes for a feature query using containment and inbound references.", stringInput("query"), objectOutput(), [
      { input: { query: "auth" } },
    ], (query, input) => findFeatureOwner(query, readString(input, "query"))),
    capability("FindAuthenticationFlow", "Find authorization relationships and auth-named code paths.", objectInput(), objectOutput(), [
      { input: {} },
    ], (query) => findAuthenticationFlow(query)),
	    capability("ImpactAnalysis", "Trace dependents and affected graph boundaries for a changed node.", idInput(), objectOutput(), [
	      { input: { id: "fn:src/auth.ts:requireUser", depth: 3 } },
	    ], (query, input) => executeSemanticCapability(query, "ImpactAnalysis", input)),
    capability("FindDatabaseAccess", "Find repository, database, and ORM/framework access nodes.", objectInput(), objectOutput(), [
      { input: {} },
    ], (query) => findDatabaseAccess(query)),
    capability("FindConfigurationUsage", "Find configuration and environment variable usage edges.", objectInput(), objectOutput(), [
      { input: {} },
    ], (query) => findConfigurationUsage(query)),
    capability("FindUnusedFeature", "Find services, routes, functions, and methods with no inbound semantic usage.", objectInput(), arrayOutput("nodes"), [
      { input: {} },
    ], (query) => findUnusedFeature(query).map(serializeNode)),
	    capability("GraphStatistics", "Return deterministic graph statistics.", objectInput(), objectOutput(), [
	      { input: {} },
	    ], (query) => serializeUnknown(query.stats())),
    capability("SearchConcept", "Resolve a natural software concept to ranked graph candidates.", stringInput("query"), searchOutput(), [
      { input: { query: "sleep thresholds" } },
    ], (query, input) => searchResultToJson(resolveIntent(createSemanticIndex(query.graph), readString(input, "query")))),
    capability("FindFeature", "Resolve a feature concept to routes, controllers, services, modules, and operations.", stringInput("query"), searchOutput(), [
      { input: { query: "authentication" } },
    ], (query, input) => searchResultToJson(searchFeature(createSemanticIndex(query.graph), readString(input, "query")))),
    capability("FindRepositoryConcept", "Resolve repository architecture concepts such as packages, modules, frameworks, and workspace terms.", stringInput("query"), searchOutput(), [
      { input: { query: "workspace packages" } },
    ], (query, input) => searchResultToJson(searchRepositoryConcept(createSemanticIndex(query.graph), readString(input, "query")))),
    capability("ResolveIntent", "Expand natural language intent into deterministic search terms and ranked graph evidence.", stringInput("query"), searchOutput(), [
      { input: { query: "what breaks if I remove PlanDefinition" } },
    ], (query, input) => searchResultToJson(resolveIntent(createSemanticIndex(query.graph), readString(input, "query")))),
	    ...semanticMcpCapabilities(),
	  ];
	}

function capability(
  name: McpCapabilityName,
  description: string,
  inputSchema: JsonObject,
  outputSchema: JsonObject,
  examples: readonly JsonObject[],
  execute: RegisteredCapability["execute"],
): RegisteredCapability {
  return {
    name,
    version: "1.0.0",
    description,
    inputSchema,
    outputSchema,
    examples,
    execute,
  };
}

function semanticMcpCapabilities(): readonly RegisteredCapability[] {
  return SEMANTIC_CAPABILITY_NAMES
    .filter((name) => !LEGACY_MCP_CAPABILITY_SET.has(name))
    .map((name) => capability(
      name as McpCapabilityName,
      `${titleCase(name)} from the Semantic Capability Engine.`,
      semanticCapabilityInput(),
      capabilityResultOutput(),
      semanticCapabilityExamples(name),
      (query, input) => executeSemanticCapability(query, name, input),
    ));
}

function executeSemanticCapability(query: QueryEngine, name: CapabilityName, input: JsonObject): JsonValue {
  const engine = createSemanticCapabilityEngine(query.graph);
  return capabilityResultToJson(engine.execute(name, input as CapabilityInput));
}

function semanticCapabilityExamples(name: CapabilityName): readonly JsonObject[] {
  if (name === "RequestTrace") {
    return [{ input: { query: "POST /login", depth: 5 } }];
  }

  if (name === "ImplementationPlan") {
    return [{ input: { task: "remove PlanDefinition support", depth: 3 } }];
  }

  if (name === "RepositorySummary" || name === "ArchitectureSummary" || name === "RepositoryHealth") {
    return [{ input: {} }];
  }

  return [{ input: { query: "AuthService", depth: 3 } }];
}

function inspectFile(query: QueryEngine, file: string): JsonObject {
  const nodes = query.findByFile(file);
  const module = nodes.find((node) => node.type === "Module");

  return {
    file,
    module: module ? serializeNode(module) : null,
    nodes: nodes.map(serializeNode),
    imports: module ? query.outgoing(module.id, ["IMPORTS"]).map(serializeEdge) : [],
    exports: module ? query.outgoing(module.id, ["EXPORTS"]).map(serializeEdge) : [],
    diagnostics: query.graph.diagnostics
      .filter((diagnostic) => diagnostic.span?.file === file)
      .map(serializeDiagnostic),
  };
}

function inspectNode(
  query: QueryEngine,
  node: SoftwareGraphNode,
  relationships: readonly RelationshipType[],
): JsonObject {
  return {
    node: serializeNode(node),
    metadata: node.metadata ?? {},
    source: node.span ? serializeSpan(node.span) : null,
    callers: query.callers(node.id).map(serializeNode),
    callees: query.callees(node.id).map(serializeNode),
    related: query.related(node.id, relationships).map(serializeNode),
    incoming: query.incoming(node.id, relationships).map(serializeEdge),
    outgoing: query.outgoing(node.id, relationships).map(serializeEdge),
  };
}

function findResponsibleFunction(query: QueryEngine, value: string): JsonObject {
  const route = findRoute(query, value);

  if (route) {
    const handlers = query.outgoing(route.id, ["HANDLES"])
      .map((edge) => query.findNode(edge.to))
      .filter(isNode)
      .filter((node) => node.type === "Function" || node.type === "Method" || node.type === "Operation");

    return {
      route: serializeNode(route),
      responsible: handlers.map(serializeNode),
    };
  }

  const responsible = query.findNodes(value)
    .filter((node) => node.type === "Function" || node.type === "Method" || node.type === "Service" || node.type === "Repository")
    .map(serializeNode);

  return {
    query: value,
    responsible,
  };
}

function architectureSummary(query: QueryEngine): JsonObject {
  const nodes = query.findNodes();

  return {
    repository: query.graph.repository.name,
    hash: query.graph.metadata.deterministicHash,
    statistics: serializeUnknown(query.stats()),
    frameworks: nodes.filter((node) => node.type === "Framework").map(serializeNode),
    packages: nodes.filter((node) => node.type === "Package").map(serializeNode),
    services: nodes.filter((node) => node.type === "Service").map(serializeNode),
    repositories: nodes.filter((node) => node.type === "Repository").map(serializeNode),
    routes: nodes.filter((node) => node.type === "Route").map(serializeNode),
    configuration: nodes
      .filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable")
      .map(serializeNode),
  };
}

function traceRequestLifecycle(query: QueryEngine, value: string, depth: number): JsonObject {
  const route = findRoute(query, value);

  if (!route) {
    return {
      status: "NOT_FOUND",
      query: value,
      route: null,
      diagnostics: [{
        code: "MCP_NOT_FOUND",
        message: `No route matched "${value}".`,
        suggestedFix: "Use FindNode or GraphStatistics to list known route nodes, then retry with a stable route id or route name.",
      }],
      traversals: [],
    };
  }

  const handlers = query.outgoing(route.id, ["HANDLES"])
    .map((edge) => query.findNode(edge.to))
    .filter(isNode);
  const traversals = handlers
    .filter((node) => node.type === "Function" || node.type === "Method")
    .map((node) => serializeTraversal(query.trace(node.id, { depth })));

  return {
    route: serializeNode(route),
    handlers: handlers.map(serializeNode),
    middleware: query.outgoing(route.id, ["USES"]).map(serializeEdge),
    authorization: query.incoming(route.id, ["AUTHORIZES"]).map(serializeEdge),
    traversals,
  };
}

function findFeatureOwner(query: QueryEngine, value: string): JsonObject {
  const semantic = searchFeature(createSemanticIndex(query.graph), value, { limit: 10 });
  const semanticMatches = semantic.candidates
    .map((candidate) => query.findNode(candidate.nodeId))
    .filter(isNode);
  const matches = uniqueNodes([...semanticMatches, ...query.findNodes(value)]);
  const owners = new Map<string, SoftwareGraphNode>();

  for (const node of matches) {
    for (const edge of query.incoming(node.id, ["CONTAINS", "PROVIDES", "REFERENCES", "HANDLES"])) {
      const owner = query.findNode(edge.from);

      if (owner) {
        owners.set(owner.id, owner);
      }
    }
  }

  return {
    query: value,
    matches: matches.map(serializeNode),
    owners: [...owners.values()].sort(compareNodes).map(serializeNode),
  };
}

function findAuthenticationFlow(query: QueryEngine): JsonObject {
  const authorizationEdges = query.graph.edges
    .filter((edge) => edge.type === "AUTHORIZES")
    .sort(compareEdges);
  const authNodes = query.findNodes()
    .filter((node) => isAuthName(node.name) || isAuthName(node.id))
    .map(serializeNode);

  return {
    authorization: authorizationEdges.map(serializeEdge),
    authNodes,
  };
}

function findDatabaseAccess(query: QueryEngine): JsonObject {
  const databaseFrameworks = new Set(["Prisma", "Drizzle", "TypeORM", "Mongoose"]);
  const nodes = query.findNodes()
    .filter((node) =>
      node.type === "Repository" ||
      node.type === "DatabaseTable" ||
      node.name.endsWith("Repository") ||
      (node.type === "Framework" && databaseFrameworks.has(node.name)) ||
      (node.type === "Dependency" && ["@prisma/client", "prisma", "drizzle-orm", "typeorm", "mongoose"].includes(node.name)),
    )
    .map((node) => ({
      ...serializeNode(node),
      incoming: query.incoming(node.id).map(serializeEdge),
      outgoing: query.outgoing(node.id).map(serializeEdge),
    }));

  return { nodes };
}

function findConfigurationUsage(query: QueryEngine): JsonObject {
  const nodes = query.findNodes()
    .filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable" || node.type === "BuildTarget")
    .map((node) => ({
      ...serializeNode(node),
      incoming: query.incoming(node.id, ["CONFIGURES", "READS", "WRITES"]).map(serializeEdge),
      outgoing: query.outgoing(node.id, ["CONFIGURES", "READS", "WRITES"]).map(serializeEdge),
    }));

  return { nodes };
}

function findUnusedFeature(query: QueryEngine): readonly SoftwareGraphNode[] {
  const relationshipTypes: readonly RelationshipType[] = ["CALLS", "HANDLES", "USES", "REFERENCES", "INJECTS", "AUTHORIZES"];

  return query.findNodes()
    .filter((node) => ["Function", "Method", "Service", "Repository", "Route"].includes(node.type))
    .filter((node) => query.incoming(node.id, relationshipTypes).length === 0)
    .sort(compareNodes);
}

function impactAnalysis(query: QueryEngine, node: SoftwareGraphNode, depth: number): JsonObject {
  const dependents = query.dependents(node.id, depth);
  const dependencies = query.dependencies(node.id, Math.max(1, Math.min(depth, 2)));
  const impactedNodes = uniqueNodes([...dependents.nodes, ...dependencies.nodes]);
  const evidenceEdges = uniqueEdges([...dependents.edges, ...dependencies.edges]);
  const traversal = serializeTraversal(dependents);

  return {
    ...traversal,
    node: serializeNodeWithMetadata(node),
    traversal,
    dependents: traversal,
    dependencies: serializeTraversal(dependencies),
    affected: {
      routes: serializeNodesByType(impactedNodes, ["Route"]),
      controllers: serializeNodesByType(impactedNodes, ["Controller"]),
      services: serializeNodesByType(impactedNodes, ["Service"]),
      modules: serializeNodesByType(impactedNodes, ["Module"]),
      repositories: serializeNodesByType(impactedNodes, ["Repository"]),
      configuration: serializeNodesByType(impactedNodes, ["Configuration", "EnvironmentVariable"]),
      permissions: serializeNodesByType(impactedNodes, ["Permission"]),
      resources: serializeNodesByType(impactedNodes, ["Resource", "Model", "DatabaseTable"]),
      externalBoundaries: impactedNodes
        .filter(isExternalBoundaryNode)
        .sort(compareNodes)
        .map(serializeNodeWithMetadata),
    },
    evidence: evidenceEdges.map(serializeEdge),
  };
}

function serializeNodesByType(
  nodes: readonly SoftwareGraphNode[],
  types: readonly SoftwareGraphNode["type"][],
): JsonObject[] {
  const typeSet = new Set(types);
  return nodes.filter((node) => typeSet.has(node.type)).sort(compareNodes).map(serializeNodeWithMetadata);
}

function isExternalBoundaryNode(node: SoftwareGraphNode): boolean {
  return (
    node.metadata?.external === true ||
    node.type === "Package" ||
    node.type === "Dependency" ||
    node.type === "Framework" ||
    node.type === "Resource" ||
    node.type === "DatabaseTable" ||
    node.type === "EnvironmentVariable" ||
    node.type === "Configuration"
  );
}

function uniqueNodes(nodes: readonly SoftwareGraphNode[]): readonly SoftwareGraphNode[] {
  return [...new Map(nodes.map((node) => [node.id, node] as const)).values()].sort(compareNodes);
}

function uniqueEdges(edges: readonly SoftwareGraphEdge[]): readonly SoftwareGraphEdge[] {
  return [...new Map(edges.map((edge) => [edge.id, edge] as const)).values()]
    .sort(compareEdges);
}

function findRoute(query: QueryEngine, value: string): SoftwareGraphNode | undefined {
  const direct = query.findNode(value);

  if (direct?.type === "Route") {
    return direct;
  }

  const normalized = value.toLowerCase();
  return query.routes().find((route) =>
    route.id.toLowerCase().includes(normalized) ||
    route.name.toLowerCase().includes(normalized),
  );
}

function resolveNode(
  query: QueryEngine,
  input: JsonObject,
  expectedTypes: readonly SoftwareGraphNode["type"][] = [],
): SoftwareGraphNode {
  const value = readString(input, "id") || readString(input, "query") || readString(input, "name");
  const exact = query.graph.nodes.find((node) => node.id === value);

  if (exact) {
    if (expectedTypes.length > 0 && !expectedTypes.includes(exact.type)) {
      throw invalidNodeTypeError(value, exact, expectedTypes);
    }
    return exact;
  }

  const semantic = resolveIntent(createSemanticIndex(query.graph), value, {
    limit: 10,
    kinds: expectedTypes.length > 0 ? expectedTypes : undefined,
  });
  const semanticMatches = semantic.candidates
    .map((candidate) => query.findNode(candidate.nodeId))
    .filter(isNode);
  const top = semantic.candidates[0];
  const secondScore = semantic.candidates[1]?.score ?? 0;

  if (top && semanticMatches[0] && top.confidence >= 0.62 && top.score - secondScore >= 90) {
    return semanticMatches[0];
  }

  const matches = uniqueNodes([...semanticMatches, ...query.findNodes(value)]);
  const typedMatches = expectedTypes.length > 0
    ? matches.filter((node) => expectedTypes.includes(node.type))
    : matches;

  if (typedMatches.length === 1 && typedMatches[0]) {
    return typedMatches[0];
  }

  if (typedMatches.length > 1) {
    throw ambiguousNodeError(value, typedMatches);
  }

  if (matches.length === 1 && matches[0]) {
    if (expectedTypes.length > 0) {
      throw invalidNodeTypeError(value, matches[0], expectedTypes);
    }
    return matches[0];
  }

  if (matches.length > 1) {
    throw ambiguousNodeError(value, matches);
  }

  throw new McpCapabilityError({
    code: "MCP_NOT_FOUND",
    explanation: `Node not found: ${value}`,
    expectedSchema: idInput(),
    suggestedFix: "Call FindNode first and retry with one of the returned stable node ids.",
  });
}

function serializeTraversal(traversal: GraphTraversal): JsonObject {
  return {
    startId: traversal.startId,
    order: [...traversal.order],
    nodes: traversal.nodes.map(serializeNode),
    edges: traversal.edges.map(serializeEdge),
  };
}

function serializeNode(node: SoftwareGraphNode): JsonObject {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    file: node.file,
    span: node.span ? serializeSpan(node.span) : undefined,
  };
}

function serializeNodeWithMetadata(node: SoftwareGraphNode): JsonObject {
  return {
    ...serializeNode(node),
    metadata: node.metadata,
  };
}

function serializeEdge(edge: SoftwareGraphEdge): JsonObject {
  return {
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
  };
}

function serializeSpan(span: SourceSpan): JsonObject {
  return {
    file: span.file,
    startLine: span.startLine,
    startColumn: span.startColumn,
    endLine: span.endLine,
    endColumn: span.endColumn,
  };
}

function serializeDiagnostic(diagnostic: SoftwareGraphDiagnostic): JsonObject {
  return {
    id: diagnostic.id,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    nodeId: diagnostic.nodeId,
    edgeId: diagnostic.edgeId,
    span: diagnostic.span ? serializeSpan(diagnostic.span) : undefined,
    metadata: diagnostic.metadata,
  };
}

function validateInput(capability: RegisteredCapability, input: JsonObject): void {
  const required = capability.inputSchema.required;
  if (!Array.isArray(required)) {
    return;
  }

  for (const key of required) {
    if (typeof key !== "string") {
      continue;
    }

    const value = input[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new McpCapabilityError({
        code: "MCP_INVALID_INPUT",
        explanation: `Capability ${capability.name} requires a non-empty "${key}" string.`,
        expectedSchema: capability.inputSchema,
        suggestedFix: `Retry ${capability.name} with input.${key}; use FindNode first when you need a stable id.`,
      });
    }
  }
}

function invalidNodeTypeError(
  value: string,
  node: SoftwareGraphNode,
  expectedTypes: readonly string[],
): McpCapabilityError {
  return new McpCapabilityError({
    code: "MCP_INVALID_NODE_TYPE",
    explanation: `Node "${value}" resolved to type ${node.type}, but expected ${expectedTypes.join(" or ")}.`,
    expectedSchema: {
      id: "stable node id",
      expectedTypes: [...expectedTypes],
      resolvedNode: serializeNode(node),
    },
    suggestedFix: `Retry with a stable id for a ${expectedTypes.join(" or ")} node.`,
  });
}

function ambiguousNodeError(value: string, matches: readonly SoftwareGraphNode[]): McpCapabilityError {
  return new McpCapabilityError({
    code: "MCP_AMBIGUOUS_NODE",
    explanation: `Node query "${value}" matched ${matches.length} nodes.`,
    expectedSchema: {
      id: "stable node id",
      candidates: matches.slice(0, 20).map(serializeNode),
    },
    suggestedFix: "Retry with one of the candidate stable ids.",
  });
}

function createProvenance(
  query: QueryEngine,
  capability: RegisteredCapability,
  result: JsonValue,
): JsonObject {
  return {
    source: "Ontoly Software Graph",
    capability: capability.name,
    capabilityVersion: capability.version,
    graphHash: query.graph.metadata.deterministicHash,
    repository: query.graph.repository.name,
    evidence: evidenceSummary(result),
  };
}

function deriveConfidence(result: JsonValue): JsonObject {
  const evidence = collectEvidence(result);

  if (isStatus(result, "NOT_FOUND") || isStatus(result, "AMBIGUOUS")) {
    return {
      level: "low",
      score: 0,
      reason: "The capability did not find direct graph evidence.",
    };
  }

  if (evidence.nodes > 0 || evidence.edges > 0 || evidence.statistics) {
    return {
      level: "high",
      score: 1,
      reason: "The response is backed by direct Software Graph evidence.",
    };
  }

  return {
    level: "medium",
    score: 0.5,
    reason: "The capability executed deterministically but returned limited graph evidence.",
  };
}

interface EvidenceCounts {
  readonly nodes: number;
  readonly edges: number;
  readonly diagnostics: number;
  readonly statistics: boolean;
}

function evidenceSummary(value: JsonValue): JsonObject {
  const evidence = collectEvidence(value);
  return {
    nodes: evidence.nodes,
    edges: evidence.edges,
    diagnostics: evidence.diagnostics,
    statistics: evidence.statistics,
  };
}

function collectEvidence(value: JsonValue): EvidenceCounts {
  const counts = { nodes: 0, edges: 0, diagnostics: 0, statistics: false };
  countEvidence(value, counts);
  return counts;
}

function countEvidence(
  value: JsonValue,
  counts: { nodes: number; edges: number; diagnostics: number; statistics: boolean },
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      countEvidence(item, counts);
    }
    return;
  }

  const object = value as JsonObject;
  if (typeof object.id === "string" && typeof object.type === "string" && typeof object.name === "string") {
    counts.nodes += 1;
  }
  if (typeof object.id === "string" && typeof object.from === "string" && typeof object.to === "string") {
    counts.edges += 1;
  }
  if (typeof object.code === "string" && typeof object.message === "string") {
    counts.diagnostics += 1;
  }
  if (typeof object.nodeCount === "number" && typeof object.edgeCount === "number") {
    counts.statistics = true;
  }

  for (const nested of Object.values(object)) {
    countEvidence(nested as JsonValue, counts);
  }
}

function isStatus(value: JsonValue, status: string): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as JsonObject).status === status);
}

function serializeUnknown(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}

function readString(input: JsonObject, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value : "";
}

function readNumber(input: JsonObject, key: string, fallback: number): number {
  const value = input[key];
  return typeof value === "number" ? value : fallback;
}

function validateCapability(capability: RegisteredCapability): void {
  if (!MCP_CAPABILITIES.includes(capability.name)) {
    throw new Error(`Capability ${capability.name} is not part of the Ontoly MCP surface.`);
  }
}

function publicCapability(capability: RegisteredCapability): McpCapability {
  return {
    name: capability.name,
    version: capability.version,
    description: capability.description,
    inputSchema: capability.inputSchema,
    outputSchema: capability.outputSchema,
    examples: capability.examples,
  };
}

function compareCapabilities(left: McpCapability, right: McpCapability): number {
  return left.name.localeCompare(right.name);
}

function compareNodes(left: SoftwareGraphNode, right: SoftwareGraphNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function isNode(value: SoftwareGraphNode | undefined): value is SoftwareGraphNode {
  return Boolean(value);
}

function titleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function isAuthName(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("auth") || normalized.includes("permission") || normalized.includes("guard");
}

function stringInput(name: string): JsonObject {
  return {
    type: "object",
    properties: {
      [name]: { type: "string" },
      depth: { type: "number" },
    },
    required: [name],
  };
}

function idInput(): JsonObject {
  return stringInput("id");
}

function objectInput(): JsonObject {
  return {
    type: "object",
    properties: {},
  };
}

function semanticCapabilityInput(): JsonObject {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      query: { type: "string" },
      task: { type: "string" },
      depth: { type: "number" },
    },
  };
}

function optionalQueryInput(): JsonObject {
  return {
    type: "object",
    properties: {
      query: { type: "string" },
      depth: { type: "number" },
    },
  };
}

function objectOutput(): JsonObject {
  return {
    type: "object",
  };
}

function searchOutput(): JsonObject {
  return {
    type: "object",
    properties: {
      query: { type: "string" },
      matchedConcepts: { type: "array" },
      candidates: { type: "array" },
      confidence: { type: "number" },
      recommendedCapability: { type: "string" },
      evidence: { type: "array" },
    },
  };
}

function capabilityResultOutput(): JsonObject {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      evidence: { type: "array" },
      affectedNodes: { type: "object" },
      affectedFiles: { type: "array" },
      affectedPackages: { type: "array" },
      statistics: { type: "object" },
      confidence: { type: "object" },
      diagnostics: { type: "array" },
      recommendations: { type: "array" },
      graph: { type: "object" },
    },
  };
}

function arrayOutput(name: string): JsonObject {
  return {
    type: "object",
    properties: {
      [name]: { type: "array" },
    },
  };
}

function traversalOutput(): JsonObject {
  return {
    type: "object",
    properties: {
      startId: { type: "string" },
      order: { type: "array" },
      nodes: { type: "array" },
      edges: { type: "array" },
    },
  };
}

function searchResultToJson(result: SemanticSearchResult): JsonObject {
  return {
    query: result.query,
    category: result.category,
    matchedConcepts: [...result.matchedConcepts],
    confidence: result.confidence,
    recommendedCapability: result.recommendedCapability,
    latencyMs: result.latencyMs,
    intent: {
      normalized: result.intent.normalized,
      tokens: [...result.intent.tokens],
      expandedTerms: [...result.intent.expandedTerms],
    },
    candidates: result.candidates.map((candidate) => ({
      id: candidate.nodeId,
      type: candidate.kind,
      name: candidate.displayName,
      score: candidate.score,
      confidence: candidate.confidence,
      matchedTerms: [...candidate.matchedTerms],
      file: candidate.entry.filePath,
      package: candidate.entry.package,
      aliases: candidate.entry.aliases.slice(0, 12),
      reasons: candidate.reasons.map((reason) => ({
        factor: reason.factor,
        score: reason.score,
        evidence: reason.evidence,
      })),
    })),
    evidence: [...result.evidence],
  };
}
