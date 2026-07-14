import type {
  DiagnosticSeverity,
  JsonObject,
  JsonValue,
  NodeType,
  RelationshipType,
  SoftwareGraph,
  SoftwareGraphDiagnostic,
  SoftwareGraphEdge,
  SoftwareGraphNode,
  SourceSpan,
} from "@0xsarwagya/ontoly-core";
import {
  createSemanticIndex,
  findFeature,
  resolveIntent,
  type SemanticIndex,
  type SemanticSearchResult,
} from "@0xsarwagya/ontoly-index";
import { createQueryEngine, type GraphStatistics, type QueryEngine } from "@0xsarwagya/ontoly-query";

export const CAPABILITY_NAMES = [
  "RepositorySummary",
  "ArchitectureSummary",
  "ImpactAnalysis",
  "ImplementationPlan",
  "RequestTrace",
  "DependencyAnalysis",
  "OwnershipAnalysis",
  "AuthenticationFlow",
  "AuthorizationFlow",
  "ConfigurationUsage",
  "EnvironmentUsage",
  "CallHierarchy",
  "DependencyHierarchy",
  "ProviderGraph",
  "ModuleOverview",
  "ServiceOverview",
  "PackageOverview",
  "RepositoryHealth",
  "DeadCode",
  "CircularDependencies",
  "EntryPoints",
  "FrameworkSummary",
  "RiskAnalysis",
  "DataFlow",
  "FeatureTouchpoints",
] as const;

export type CapabilityName = (typeof CAPABILITY_NAMES)[number];

export interface CapabilityInput extends JsonObject {
  readonly id?: string | undefined;
  readonly query?: string | undefined;
  readonly task?: string | undefined;
  readonly depth?: number | undefined;
}

export interface SerializedNode {
  readonly id: string;
  readonly type: NodeType;
  readonly name: string;
  readonly file?: string | undefined;
  readonly package?: string | undefined;
  readonly span?: JsonObject | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface SerializedEdge {
  readonly id: string;
  readonly type: RelationshipType;
  readonly from: string;
  readonly to: string;
  readonly evidence?: readonly JsonObject[] | undefined;
}

export interface CapabilityEvidence {
  readonly kind: "node" | "edge" | "path" | "statistic" | "diagnostic";
  readonly description: string;
  readonly confidence: number;
  readonly nodes?: readonly SerializedNode[] | undefined;
  readonly edges?: readonly SerializedEdge[] | undefined;
  readonly stats?: JsonObject | undefined;
}

export interface CapabilityConfidence {
  readonly score: number;
  readonly level: "none" | "low" | "medium" | "high";
  readonly explanation: string;
  readonly factors: readonly JsonObject[];
}

export interface CapabilityDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly nodeId?: string | undefined;
  readonly edgeId?: string | undefined;
  readonly span?: JsonObject | undefined;
}

export interface CapabilityResult {
  readonly summary: string;
  readonly evidence: readonly CapabilityEvidence[];
  readonly affectedNodes: Record<string, readonly SerializedNode[]>;
  readonly affectedFiles: readonly string[];
  readonly affectedPackages: readonly string[];
  readonly statistics: Record<string, unknown>;
  readonly confidence: CapabilityConfidence;
  readonly diagnostics: readonly CapabilityDiagnostic[];
  readonly recommendations: readonly string[];
  readonly graph: JsonObject;
}

export interface Capability {
  readonly name: CapabilityName;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
  readonly execute: (context: CapabilityContext, input: CapabilityInput) => CapabilityResult;
}

export interface CapabilityContext {
  readonly graph: SoftwareGraph;
  readonly query: QueryEngine;
  readonly semanticIndex: SemanticIndex;
}

export interface CapabilityRegistry {
  readonly capabilities: () => readonly Capability[];
  readonly get: (name: CapabilityName) => Capability | undefined;
  readonly register: (capability: Capability) => CapabilityRegistry;
  readonly execute: (name: CapabilityName, input?: CapabilityInput) => CapabilityResult;
}

export interface CapabilityEngine {
  readonly registry: CapabilityRegistry;
  readonly execute: (name: CapabilityName, input?: CapabilityInput) => CapabilityResult;
}

const EXPANSION_RELATIONSHIPS: readonly RelationshipType[] = [
  "CALLS",
  "HANDLES",
  "READS",
  "WRITES",
  "IMPORTS",
  "EXPORTS",
  "CONFIGURES",
  "INJECTS",
  "CONTAINS",
  "DEPENDS_ON",
  "USES",
  "REFERENCES",
  "AUTHORIZES",
  "REGISTERED_IN",
  "PROVIDES",
  "MOUNTS",
  "EXPOSES",
];

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

const ARCHITECTURAL_GROUPS: readonly {
  readonly label: string;
  readonly types: readonly NodeType[];
  readonly namePatterns?: readonly RegExp[] | undefined;
}[] = [
  { label: "Routes", types: ["Route", "Operation"] },
  { label: "Controllers", types: ["Controller"] },
  { label: "Services", types: ["Service", "Provider", "Factory"] },
  { label: "Modules", types: ["Module", "Package", "Workspace", "Application"] },
  { label: "Persistence", types: ["Repository", "DatabaseTable", "Model", "Resource"], namePatterns: [/repository/i, /prisma/i, /database/i, /fhir/i] },
  { label: "Configuration", types: ["Configuration", "EnvironmentVariable", "BuildTarget"] },
  { label: "Authorization", types: ["Permission", "Guard", "Middleware"], namePatterns: [/auth/i, /permission/i, /guard/i] },
  { label: "Language", types: ["Function", "Method", "Class", "Interface", "TypeAlias", "Enum", "Field"] },
  { label: "External Boundaries", types: ["Dependency", "Framework", "Package"], namePatterns: [/^@/, /sdk/i, /api/i] },
  { label: "Tests", types: ["Module", "Function", "Method"], namePatterns: [/test/i, /spec/i] },
];

export function createCapabilityEngine(graph: SoftwareGraph): CapabilityEngine {
  const query = createQueryEngine(graph);
  const semanticIndex = createSemanticIndex(graph);
  const registry = createCapabilityRegistry({ graph, query, semanticIndex }, defaultCapabilities());
  return {
    registry,
    execute: registry.execute,
  };
}

export function createCapabilityRegistry(
  context: CapabilityContext,
  initialCapabilities: readonly Capability[] = [],
): CapabilityRegistry {
  const capabilities = new Map<CapabilityName, Capability>();

  const registry: CapabilityRegistry = {
    capabilities: () => [...capabilities.values()].sort((left, right) => left.name.localeCompare(right.name)),
    get: (name) => capabilities.get(name),
    register: (capability) => {
      if (!CAPABILITY_NAMES.includes(capability.name)) {
        throw new Error(`Unknown Ontoly capability: ${capability.name}`);
      }
      capabilities.set(capability.name, capability);
      return registry;
    },
    execute: (name, input = {}) => {
      const capability = capabilities.get(name);
      if (!capability) {
        return emptyResult(context, {
          summary: `Capability ${name} is not registered.`,
          diagnostics: [diagnostic("CAPABILITY_NOT_REGISTERED", "error", `Capability ${name} is not registered.`)],
          recommendations: ["Use the capability registry to list supported capabilities before execution."],
        });
      }
      return capability.execute(context, input);
    },
  };

  for (const capability of initialCapabilities) {
    registry.register(capability);
  }

  return registry;
}

export function defaultCapabilities(): readonly Capability[] {
  return [
    capability("RepositorySummary", "Summarize repository structure and graph scale.", {}, repositorySummary),
    capability("ArchitectureSummary", "Summarize architecture by concern rather than files.", {}, architectureSummary),
    capability("ImpactAnalysis", "Analyze deterministic blast radius for a node or concept.", targetInput(), impactAnalysis),
    capability("ImplementationPlan", "Plan a software change from graph touchpoints without generating code.", taskInput(), implementationPlan),
    capability("RequestTrace", "Trace route handling and downstream execution.", targetInput("query"), requestTrace),
    capability("DependencyAnalysis", "Analyze dependencies and dependents for a node or repository.", optionalTargetInput(), dependencyAnalysis),
    capability("OwnershipAnalysis", "Find graph owners for a feature, node, route, or service.", targetInput(), ownershipAnalysis),
    capability("AuthenticationFlow", "Summarize authentication-related graph evidence.", {}, authenticationFlow),
    capability("AuthorizationFlow", "Summarize authorization guards, permissions, and relationships.", {}, authorizationFlow),
    capability("ConfigurationUsage", "Summarize configuration and build setting usage.", {}, configurationUsage),
    capability("EnvironmentUsage", "Summarize environment variable usage.", {}, environmentUsage),
    capability("CallHierarchy", "Build caller and callee hierarchy around a node.", targetInput(), callHierarchy),
    capability("DependencyHierarchy", "Build dependency and dependent hierarchy around a node.", targetInput(), dependencyHierarchy),
    capability("ProviderGraph", "Summarize provider/service dependency injection topology.", {}, providerGraph),
    capability("ModuleOverview", "Summarize modules, packages, and contained entities.", optionalTargetInput(), moduleOverview),
    capability("ServiceOverview", "Summarize services and related controllers, modules, and dependencies.", optionalTargetInput(), serviceOverview),
    capability("PackageOverview", "Summarize package and dependency topology.", optionalTargetInput(), packageOverview),
    capability("RepositoryHealth", "Summarize health risks from diagnostics, cycles, hotspots, and orphan nodes.", {}, repositoryHealth),
    capability("DeadCode", "Find nodes with no deterministic inbound usage evidence.", {}, deadCode),
    capability("CircularDependencies", "Find circular dependency evidence.", {}, circularDependencies),
    capability("EntryPoints", "Find graph entrypoints.", {}, entryPoints),
    capability("FrameworkSummary", "Summarize detected frameworks and framework coverage nodes.", {}, frameworkSummary),
    capability("RiskAnalysis", "Summarize graph risk hotspots.", {}, riskAnalysis),
    capability("DataFlow", "Summarize READS and WRITES data-flow evidence.", optionalTargetInput(), dataFlow),
    capability("FeatureTouchpoints", "Find architectural touchpoints for a feature query.", targetInput("query"), featureTouchpoints),
  ];
}

function capability(
  name: CapabilityName,
  description: string,
  inputSchema: JsonObject,
  execute: Capability["execute"],
): Capability {
  return {
    name,
    version: "1.0.0",
    description,
    inputSchema,
    execute,
  };
}

function repositorySummary(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes();
  const stats = context.query.stats();
  const evidence = [
    statisticEvidence("Graph statistics summarize repository structure.", stats),
  ];

  return result(context, {
    summary: `${context.graph.repository.name} contains ${stats.nodeCount} graph nodes, ${stats.edgeCount} relationships, and ${stats.disconnectedComponents} component(s).`,
    evidence,
    affectedNodes: groupNodes(nodes),
    statistics: {
      ...serializeStats(stats),
      largestModules: mostConnected(context, ["Module", "Package"], 10),
      mostConnectedServices: mostConnected(context, ["Service", "Provider", "Repository"], 10),
    },
    recommendations: repositoryRecommendations(context, stats),
  });
}

function architectureSummary(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes();
  const groups = groupNodes(nodes);
  const frameworks = nodes.filter((node) => node.type === "Framework");
  const packages = nodes.filter((node) => node.type === "Package");
  const services = nodes.filter((node) => node.type === "Service" || node.type === "Provider");
  const routes = nodes.filter((node) => node.type === "Route");

  return result(context, {
    summary: `Architecture summary: ${packages.length} package(s), ${frameworks.length} framework marker(s), ${services.length} service/provider node(s), and ${routes.length} route(s).`,
    evidence: [
      nodeEvidence("Framework and package nodes define the top-level architecture boundary.", [...frameworks, ...packages]),
      nodeEvidence("Service and route nodes define application behavior boundaries.", [...services, ...routes]),
    ],
    affectedNodes: groups,
    statistics: {
      groupCounts: countGroups(groups),
      hotspots: mostConnected(context, ["Module", "Service", "Provider", "Controller"], 10),
    },
    recommendations: [
      "Use DependencyAnalysis for package and module direction.",
      "Use RepositoryHealth to inspect cycles, diagnostics, and orphan graph regions.",
    ],
  });
}

function impactAnalysis(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = resolveTarget(context, input);
  if (!resolved.node) {
    return notFoundResult(context, "ImpactAnalysis", resolved);
  }

  const depth = readDepth(input, 4);
  const dependents = context.query.dependents(resolved.node.id, depth);
  const dependencies = context.query.dependencies(resolved.node.id, Math.min(depth, 3));
  const expanded = expandSemanticBoundary(context, [resolved.node], depth);
  const nodes = uniqueNodes([resolved.node, ...dependents.nodes, ...dependencies.nodes, ...expanded.nodes]);
  const edges = uniqueEdges([...dependents.edges, ...dependencies.edges, ...expanded.edges]);
  const groups = groupNodes(nodes);

  return result(context, {
    summary: `${resolved.node.name} has ${dependents.nodes.length - 1} dependent node(s) within depth ${depth}; ${nodes.length} total graph node(s) are in the deterministic blast radius.`,
    evidence: [
      pathEvidence("Dependent traversal identifies consumers that may break.", dependents.nodes, dependents.edges),
      pathEvidence("Dependency traversal identifies required implementation boundaries.", dependencies.nodes, dependencies.edges),
      pathEvidence("Semantic expansion adds routes, services, configuration, packages, and resources.", nodes, edges),
    ],
    affectedNodes: groups,
    statistics: {
      target: serializeNode(resolved.node),
      traversalDepth: depth,
      directDependents: Math.max(0, dependents.nodes.length - 1),
      relationshipCounts: countEdges(edges),
      architecturalGroups: countGroups(groups),
      blastRadius: blastRadius(nodes.length),
    },
    recommendations: implementationOrder(groups),
  });
}

function implementationPlan(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const task = readText(input, "task") || readText(input, "query");
  const matches = featureMatches(context, task);
  const expanded = expandSemanticBoundary(context, matches, readDepth(input, 3));
  const nodes = uniqueNodes([...matches, ...expanded.nodes]);
  const groups = groupNodes(nodes);
  const recommendations = [
    `Start by confirming the ${matches.length > 0 ? "matched graph touchpoints" : "missing graph touchpoints"} for "${task}".`,
    ...implementationOrder(groups),
    "Add or update tests around affected routes, services, configuration, and persistence boundaries.",
  ];

  return result(context, {
    summary: `Implementation plan for "${task || "unspecified task"}" touches ${Object.keys(groups).length} architectural group(s) and ${nodes.length} graph node(s).`,
    evidence: [
      nodeEvidence("Lexical graph matches seed deterministic planning.", matches, 0.6),
      pathEvidence("Semantic expansion identifies adjacent implementation boundaries.", nodes, expanded.edges),
    ],
    affectedNodes: groups,
    statistics: {
      task,
      architecturalGroups: countGroups(groups),
      matchedTerms: tokenize(task),
      implementationOrder: implementationOrder(groups),
    },
    diagnostics: matches.length === 0
      ? [diagnostic("CAPABILITY_LOW_EVIDENCE", "warning", "No direct graph touchpoints matched the task text.")]
      : [],
    recommendations,
  });
}

function requestTrace(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const value = readText(input, "query") || readText(input, "id");
  const route = findRoute(context, value);
  if (!route) {
    return notFoundResult(context, "RequestTrace", {
      query: value,
      matches: [],
      diagnostics: [diagnostic("CAPABILITY_ROUTE_NOT_FOUND", "warning", `No route matched "${value}".`)],
    });
  }

  const handlers = context.query.outgoing(route.id, ["HANDLES"])
    .map((edge) => context.query.findNode(edge.to))
    .filter(isNode);
  const traces = handlers.flatMap((handler) =>
    handler.type === "Function" || handler.type === "Method"
      ? [context.query.trace(handler.id, { depth: readDepth(input, 5) })]
      : [],
  );
  const nodes = uniqueNodes([route, ...handlers, ...traces.flatMap((trace) => trace.nodes)]);
  const edges = uniqueEdges([
    ...context.query.outgoing(route.id, ["HANDLES", "USES", "AUTHORIZES"]),
    ...traces.flatMap((trace) => trace.edges),
  ]);

  return result(context, {
    summary: `${route.name} resolves to ${handlers.length} handler node(s) and ${edges.length} evidence edge(s).`,
    evidence: [
      pathEvidence("Route HANDLES edges identify responsible handler nodes.", [route, ...handlers], context.query.outgoing(route.id, ["HANDLES"])),
      pathEvidence("CALLS traversal follows downstream execution.", nodes, edges),
    ],
    affectedNodes: groupNodes(nodes),
    statistics: {
      route: serializeNode(route),
      handlers: handlers.map(serializeNode),
      callDepth: readDepth(input, 5),
      relationshipCounts: countEdges(edges),
    },
    recommendations: ["Inspect low-confidence or missing handler edges before changing request behavior."],
  });
}

function dependencyAnalysis(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = hasTarget(input) ? resolveTarget(context, input) : { node: undefined, query: "", matches: [], diagnostics: [] };
  if (hasTarget(input) && !resolved.node) {
    return notFoundResult(context, "DependencyAnalysis", resolved);
  }

  const depth = readDepth(input, 3);
  const seed = resolved.node ? [resolved.node] : context.query.findNodes().filter((node) => node.type === "Package" || node.type === "Module");
  const traversals = seed.map((node) => ({
    dependencies: context.query.walk(node.id, { direction: "outbound", relationships: DEPENDENCY_RELATIONSHIPS, depth }),
    dependents: context.query.walk(node.id, { direction: "inbound", relationships: DEPENDENCY_RELATIONSHIPS, depth }),
  }));
  const nodes = uniqueNodes([...seed, ...traversals.flatMap((item) => [...item.dependencies.nodes, ...item.dependents.nodes])]);
  const edges = uniqueEdges(traversals.flatMap((item) => [...item.dependencies.edges, ...item.dependents.edges]));

  return result(context, {
    summary: resolved.node
      ? `${resolved.node.name} participates in ${edges.length} dependency relationship(s) within depth ${depth}.`
      : `Repository dependency summary includes ${nodes.length} module/package node(s) and ${edges.length} dependency relationship(s).`,
    evidence: [pathEvidence("Dependency relationships include imports, calls, injects, references, and package dependencies.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: {
      target: resolved.node ? serializeNode(resolved.node) : null,
      relationshipCounts: countEdges(edges),
      hotspots: mostConnected(context, ["Package", "Module", "Service", "Provider"], 10),
    },
    recommendations: ["Review high-degree dependency hotspots before changing shared modules or packages."],
  });
}

function ownershipAnalysis(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = resolveTarget(context, input);
  if (!resolved.node && resolved.matches.length === 0) {
    return notFoundResult(context, "OwnershipAnalysis", resolved);
  }

  const seeds = resolved.node ? [resolved.node] : resolved.matches;
  const ownerEdges = seeds.flatMap((node) => context.query.incoming(node.id, ["CONTAINS", "PROVIDES", "REGISTERED_IN", "HANDLES", "DECLARES", "BELONGS_TO"]));
  const owners = uniqueNodes(ownerEdges.map((edge) => context.query.findNode(edge.from)).filter(isNode));

  return result(context, {
    summary: owners.length > 0
      ? `Found ${owners.length} owner candidate(s) for "${resolved.query}".`
      : `No direct owner candidates found for "${resolved.query}".`,
    evidence: [
      nodeEvidence("Matched graph nodes seed ownership analysis.", seeds),
      pathEvidence("Inbound ownership edges identify containing modules, providers, controllers, and packages.", [...seeds, ...owners], ownerEdges),
    ],
    affectedNodes: groupNodes([...seeds, ...owners]),
    statistics: { owners: owners.map(serializeNode), matches: seeds.map(serializeNode) },
    diagnostics: owners.length === 0 ? [diagnostic("CAPABILITY_OWNER_NOT_FOUND", "warning", "No direct owner relationship was present in the graph.")] : [],
    recommendations: ["Prefer owners with CONTAINS, PROVIDES, REGISTERED_IN, or HANDLES evidence over lexical matches."],
  });
}

function authenticationFlow(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes().filter((node) => /auth|login|session|jwt|guard|permission/i.test(`${node.id} ${node.name}`));
  const edges = context.graph.edges.filter((edge) => edge.type === "AUTHORIZES" || edge.type === "HANDLES" || edge.type === "READS")
    .filter((edge) => nodes.some((node) => node.id === edge.from || node.id === edge.to))
    .sort(compareEdges);

  return result(context, {
    summary: `Authentication flow contains ${nodes.length} auth-related node(s) and ${edges.length} supporting relationship(s).`,
    evidence: [
      nodeEvidence("Auth, login, session, JWT, guard, and permission names seed authentication analysis.", nodes, 0.6),
      pathEvidence("AUTHORIZES, HANDLES, and READS edges provide direct flow evidence.", nodes, edges),
    ],
    affectedNodes: groupNodes(nodes),
    statistics: { relationshipCounts: countEdges(edges) },
    recommendations: ["Use RequestTrace for route-specific authentication paths."],
  });
}

function authorizationFlow(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes().filter((node) => ["Permission", "Guard", "Middleware", "Route", "Controller"].includes(node.type) || /permission|authorize|guard|role|policy/i.test(node.name));
  const edges = context.graph.edges.filter((edge) => edge.type === "AUTHORIZES" || edge.type === "USES").sort(compareEdges);

  return result(context, {
    summary: `Authorization flow contains ${nodes.length} authorization node(s) and ${edges.length} authorization/usage edge(s).`,
    evidence: [
      nodeEvidence("Permission, guard, middleware, route, and controller nodes define authorization surfaces.", nodes),
      pathEvidence("AUTHORIZES and USES edges connect authorization checks to application nodes.", nodes, edges),
    ],
    affectedNodes: groupNodes(nodes),
    statistics: { relationshipCounts: countEdges(edges) },
    recommendations: ["Missing AUTHORIZES edges indicate framework analyzer coverage gaps or unmodeled authorization behavior."],
  });
}

function configurationUsage(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes().filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable" || node.type === "BuildTarget");
  const edges = nodes.flatMap((node) => [...context.query.incoming(node.id, ["CONFIGURES", "READS", "WRITES"]), ...context.query.outgoing(node.id, ["CONFIGURES", "READS", "WRITES"])]);

  return result(context, {
    summary: `Configuration usage includes ${nodes.length} configuration node(s) and ${edges.length} usage edge(s).`,
    evidence: [pathEvidence("CONFIGURES, READS, and WRITES edges define deterministic configuration usage.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { relationshipCounts: countEdges(edges), hotspots: hotspotNodes(context, nodes, 10) },
    recommendations: ["Review configuration nodes with no usage edges; they may be dead settings or analyzer gaps."],
  });
}

function environmentUsage(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes().filter((node) => node.type === "EnvironmentVariable");
  const edges = nodes.flatMap((node) => [...context.query.incoming(node.id, ["READS", "WRITES"]), ...context.query.outgoing(node.id, ["READS", "WRITES"])]);

  return result(context, {
    summary: `Environment usage includes ${nodes.length} environment variable node(s) and ${edges.length} read/write edge(s).`,
    evidence: [pathEvidence("READS and WRITES edges define deterministic environment usage.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { relationshipCounts: countEdges(edges) },
    recommendations: ["Environment variables without READS edges may be stale or not covered by the analyzer."],
  });
}

function callHierarchy(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = resolveTarget(context, input);
  if (!resolved.node) {
    return notFoundResult(context, "CallHierarchy", resolved);
  }
  const depth = readDepth(input, 4);
  const callers = context.query.walk(resolved.node.id, { direction: "inbound", relationships: ["CALLS"], depth });
  const callees = context.query.walk(resolved.node.id, { direction: "outbound", relationships: ["CALLS"], depth });
  const nodes = uniqueNodes([resolved.node, ...callers.nodes, ...callees.nodes]);
  const edges = uniqueEdges([...callers.edges, ...callees.edges]);

  return result(context, {
    summary: `${resolved.node.name} has ${callers.nodes.length - 1} caller node(s) and ${callees.nodes.length - 1} callee node(s) within depth ${depth}.`,
    evidence: [pathEvidence("CALLS edges define caller and callee hierarchy.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { target: serializeNode(resolved.node), relationshipCounts: countEdges(edges) },
    recommendations: ["Use ImpactAnalysis when call hierarchy changes may cross routes, services, configuration, or package boundaries."],
  });
}

function dependencyHierarchy(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  return dependencyAnalysis(context, input);
}

function providerGraph(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes().filter((node) => ["Provider", "Service", "Factory", "Repository", "Module"].includes(node.type));
  const edges = context.graph.edges.filter((edge) => ["INJECTS", "PROVIDES", "REGISTERED_IN", "DEPENDS_ON"].includes(edge.type)).sort(compareEdges);

  return result(context, {
    summary: `Provider graph contains ${nodes.length} provider/service node(s) and ${edges.length} provider relationship(s).`,
    evidence: [pathEvidence("INJECTS, PROVIDES, REGISTERED_IN, and DEPENDS_ON edges define provider topology.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { relationshipCounts: countEdges(edges), hotspots: hotspotNodes(context, nodes, 10) },
    recommendations: ["Provider nodes with no registration edge may indicate dead providers or analyzer coverage gaps."],
  });
}

function moduleOverview(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = hasTarget(input) ? resolveTarget(context, input) : { node: undefined, query: "", matches: [], diagnostics: [] };
  const modules = resolved.node ? [resolved.node] : context.query.findNodes().filter((node) => node.type === "Module" || node.type === "Package" || node.type === "Workspace");
  const edges = modules.flatMap((node) => [...context.query.outgoing(node.id, ["CONTAINS", "IMPORTS", "EXPORTS", "PROVIDES"]), ...context.query.incoming(node.id, ["IMPORTS", "REGISTERED_IN"])]);
  const related = uniqueNodes([...modules, ...edges.flatMap((edge) => [context.query.findNode(edge.from), context.query.findNode(edge.to)]).filter(isNode)]);

  return result(context, {
    summary: `Module overview includes ${modules.length} module/package node(s) and ${edges.length} relationship(s).`,
    evidence: [pathEvidence("Module relationships include contains, imports, exports, provides, and registrations.", related, edges)],
    affectedNodes: groupNodes(related),
    statistics: { moduleCount: modules.length, relationshipCounts: countEdges(edges) },
    recommendations: ["Use CircularDependencies to inspect module cycles before refactoring module boundaries."],
  });
}

function serviceOverview(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = hasTarget(input) ? resolveTarget(context, input) : { node: undefined, query: "", matches: [], diagnostics: [] };
  const services = resolved.node ? [resolved.node] : context.query.findNodes().filter((node) => node.type === "Service" || node.type === "Provider" || node.name.endsWith("Service"));
  const expanded = expandSemanticBoundary(context, services, readDepth(input, 2));
  const nodes = uniqueNodes([...services, ...expanded.nodes]);

  return result(context, {
    summary: `Service overview includes ${services.length} service/provider node(s) and ${expanded.edges.length} nearby relationship(s).`,
    evidence: [pathEvidence("Semantic expansion connects services to controllers, modules, repositories, and configuration.", nodes, expanded.edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { serviceCount: services.length, relationshipCounts: countEdges(expanded.edges) },
    recommendations: ["Use OwnershipAnalysis for service owners and ImpactAnalysis before removing a service."],
  });
}

function packageOverview(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = hasTarget(input) ? resolveTarget(context, input) : { node: undefined, query: "", matches: [], diagnostics: [] };
  const packages = resolved.node ? [resolved.node] : context.query.findNodes().filter((node) => node.type === "Package" || node.type === "Dependency");
  const edges = packages.flatMap((node) => [...context.query.outgoing(node.id, ["DEPENDS_ON", "IMPORTS", "EXPORTS"]), ...context.query.incoming(node.id, ["DEPENDS_ON", "IMPORTS", "USES"])]);
  const nodes = uniqueNodes([...packages, ...edges.flatMap((edge) => [context.query.findNode(edge.from), context.query.findNode(edge.to)]).filter(isNode)]);

  return result(context, {
    summary: `Package overview includes ${packages.length} package/dependency node(s) and ${edges.length} package relationship(s).`,
    evidence: [pathEvidence("Package topology is derived from dependency, import, export, and usage edges.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { packageCount: packages.length, relationshipCounts: countEdges(edges) },
    recommendations: ["Review packages with high inbound dependency before changing public exports."],
  });
}

function repositoryHealth(context: CapabilityContext): CapabilityResult {
  const stats = context.query.stats();
  const cycles = context.query.detectCycles(["IMPORTS", "DEPENDS_ON"]);
  const dead = deadCodeNodes(context);
  const diagnostics = context.graph.diagnostics.map(serializeDiagnostic);
  const hotspots = mostConnected(context, ["Module", "Package", "Service", "Provider", "Route"], 10);

  return result(context, {
    summary: `Repository health: ${diagnostics.length} diagnostic(s), ${cycles.length} import/dependency cycle(s), ${dead.length} potential dead node(s).`,
    evidence: [
      statisticEvidence("Graph statistics and diagnostics define repository health.", stats),
      nodeEvidence("Potential dead code has no inbound semantic usage evidence.", dead),
    ],
    affectedNodes: groupNodes(dead),
    statistics: { ...serializeStats(stats), cycles: cycles.map((cycle) => [...cycle]), hotspots },
    diagnostics,
    recommendations: repositoryRecommendations(context, stats),
  });
}

function deadCode(context: CapabilityContext): CapabilityResult {
  const nodes = deadCodeNodes(context);

  return result(context, {
    summary: `Found ${nodes.length} potential dead code node(s) with no inbound semantic usage evidence.`,
    evidence: [nodeEvidence("Dead-code candidates lack inbound CALLS, HANDLES, USES, REFERENCES, INJECTS, or AUTHORIZES edges.", nodes)],
    affectedNodes: groupNodes(nodes),
    statistics: { candidates: nodes.length },
    recommendations: ["Treat dead-code results as candidates; public APIs, dynamic registration, and reflection can require fallback confirmation."],
  });
}

function circularDependencies(context: CapabilityContext): CapabilityResult {
  const cycles = context.query.detectCycles(["IMPORTS", "DEPENDS_ON"]);
  const nodes = uniqueNodes(cycles.flatMap((cycle) => cycle.map((id) => context.query.findNode(id)).filter(isNode)));

  return result(context, {
    summary: `Found ${cycles.length} circular import/dependency cycle(s).`,
    evidence: cycles.map((cycle) => nodeEvidence(`Cycle: ${cycle.join(" -> ")}`, cycle.map((id) => context.query.findNode(id)).filter(isNode))),
    affectedNodes: groupNodes(nodes),
    statistics: { cycles: cycles.map((cycle) => [...cycle]) },
    recommendations: cycles.length > 0
      ? ["Break cycles by moving shared contracts to a lower-level module or reversing dependency direction."]
      : ["No import/dependency cycles detected in the current graph."],
  });
}

function entryPoints(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes()
    .filter((node) => ["Function", "Method", "Module", "Route", "Application"].includes(node.type))
    .filter((node) => context.query.incoming(node.id, ["CALLS", "IMPORTS", "HANDLES", "REGISTERED_IN"]).length === 0)
    .sort(compareNodes);

  return result(context, {
    summary: `Found ${nodes.length} graph entrypoint candidate(s).`,
    evidence: [nodeEvidence("Entrypoints have no inbound CALLS, IMPORTS, HANDLES, or REGISTERED_IN edges.", nodes)],
    affectedNodes: groupNodes(nodes),
    statistics: { entrypoints: nodes.length },
    recommendations: ["Use entrypoints as roots for request tracing, package summaries, and dead-code false-positive checks."],
  });
}

function frameworkSummary(context: CapabilityContext): CapabilityResult {
  const nodes = context.query.findNodes().filter((node) => node.type === "Framework" || node.metadata?.framework !== undefined);
  const edges = nodes.flatMap((node) => [...context.query.incoming(node.id), ...context.query.outgoing(node.id)]);

  return result(context, {
    summary: `Framework summary includes ${nodes.length} framework-related node(s).`,
    evidence: [pathEvidence("Framework nodes and metadata define deterministic framework evidence.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { frameworks: nodes.map(serializeNode), relationshipCounts: countEdges(edges) },
    recommendations: ["Use framework analyzer docs for coverage expectations when framework nodes are missing."],
  });
}

function riskAnalysis(context: CapabilityContext): CapabilityResult {
  const stats = context.query.stats();
  const cycles = context.query.detectCycles(["IMPORTS", "DEPENDS_ON"]);
  const hotspots = mostConnected(context, ["Module", "Package", "Service", "Provider", "Controller", "Route"], 15);
  const hotspotNodesResolved = hotspots.map((item) => context.query.findNode(String(item.nodeId))).filter(isNode);

  return result(context, {
    summary: `Risk analysis found ${cycles.length} cycle(s), ${context.graph.diagnostics.length} diagnostic(s), and ${hotspots.length} hotspot node(s).`,
    evidence: [
      statisticEvidence("Graph statistics expose degree and component risk.", stats),
      nodeEvidence("High-degree nodes are change-risk hotspots.", hotspotNodesResolved),
    ],
    affectedNodes: groupNodes(hotspotNodesResolved),
    statistics: { cycles: cycles.map((cycle) => [...cycle]), diagnostics: context.graph.diagnostics.length, hotspots },
    diagnostics: context.graph.diagnostics.map(serializeDiagnostic),
    recommendations: ["Prioritize high-degree services, modules, and packages for impact checks before release."],
  });
}

function dataFlow(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const resolved = hasTarget(input) ? resolveTarget(context, input) : { node: undefined, query: "", matches: [], diagnostics: [] };
  const seed = resolved.node ? [resolved.node] : context.query.findNodes().filter((node) => ["EnvironmentVariable", "Configuration", "Resource", "Model", "Repository"].includes(node.type));
  const edges = seed.flatMap((node) => [...context.query.incoming(node.id, ["READS", "WRITES", "CALLS"]), ...context.query.outgoing(node.id, ["READS", "WRITES", "CALLS"])]);
  const nodes = uniqueNodes([...seed, ...edges.flatMap((edge) => [context.query.findNode(edge.from), context.query.findNode(edge.to)]).filter(isNode)]);

  return result(context, {
    summary: `Data flow includes ${nodes.length} node(s) and ${edges.length} READS/WRITES/CALLS edge(s).`,
    evidence: [pathEvidence("READS, WRITES, and CALLS relationships provide deterministic data-flow evidence.", nodes, edges)],
    affectedNodes: groupNodes(nodes),
    statistics: { relationshipCounts: countEdges(edges) },
    recommendations: ["Use ConfigurationUsage for configuration-specific data flow and RequestTrace for route-specific execution flow."],
  });
}

function featureTouchpoints(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const value = readText(input, "query") || readText(input, "task") || readText(input, "id");
  const matches = featureMatches(context, value);
  const expanded = expandSemanticBoundary(context, matches, readDepth(input, 3));
  const nodes = uniqueNodes([...matches, ...expanded.nodes]);

  return result(context, {
    summary: `Feature "${value}" has ${matches.length} direct graph touchpoint(s) and ${nodes.length} expanded touchpoint(s).`,
    evidence: [
      nodeEvidence("Direct feature matches come from deterministic Query Engine lookup.", matches),
      pathEvidence("Semantic expansion connects feature touchpoints to architecture boundaries.", nodes, expanded.edges),
    ],
    affectedNodes: groupNodes(nodes),
    statistics: { query: value, directMatches: matches.length, architecturalGroups: countGroups(groupNodes(nodes)) },
    diagnostics: matches.length === 0 ? [diagnostic("CAPABILITY_LOW_EVIDENCE", "warning", `No direct graph touchpoints matched "${value}".`)] : [],
    recommendations: implementationOrder(groupNodes(nodes)),
  });
}

function result(
  context: CapabilityContext,
  input: {
    readonly summary: string;
    readonly evidence?: readonly CapabilityEvidence[] | undefined;
    readonly affectedNodes?: Record<string, readonly SerializedNode[]> | undefined;
    readonly statistics?: Record<string, unknown> | undefined;
    readonly diagnostics?: readonly CapabilityDiagnostic[] | undefined;
    readonly recommendations?: readonly string[] | undefined;
  },
): CapabilityResult {
  const evidence = input.evidence ?? [];
  const affectedNodes = input.affectedNodes ?? {};
  const diagnostics = input.diagnostics ?? [];
  const allNodes = Object.values(affectedNodes).flat();

  return {
    summary: input.summary,
    evidence,
    affectedNodes,
    affectedFiles: [...new Set(allNodes.map((node) => node.file).filter(isString))].sort(),
    affectedPackages: [...new Set(allNodes.map((node) => node.package).filter(isString))].sort(),
    statistics: input.statistics ?? {},
    confidence: confidenceFromEvidence(evidence, diagnostics),
    diagnostics,
    recommendations: input.recommendations ?? [],
    graph: graphProvenance(context),
  };
}

function emptyResult(
  context: CapabilityContext,
  input: {
    readonly summary: string;
    readonly diagnostics?: readonly CapabilityDiagnostic[] | undefined;
    readonly recommendations?: readonly string[] | undefined;
  },
): CapabilityResult {
  return result(context, {
    summary: input.summary,
    diagnostics: input.diagnostics,
    recommendations: input.recommendations,
  });
}

function notFoundResult(
  context: CapabilityContext,
  capabilityName: string,
  resolved: {
    readonly query: string;
    readonly matches: readonly SoftwareGraphNode[];
    readonly diagnostics: readonly CapabilityDiagnostic[];
  },
): CapabilityResult {
  return result(context, {
    summary: `${capabilityName} could not resolve "${resolved.query}" to graph evidence.`,
    evidence: resolved.matches.length > 0 ? [nodeEvidence("Query produced ambiguous or insufficient matches.", resolved.matches, 0.4)] : [],
    affectedNodes: groupNodes(resolved.matches),
    diagnostics: resolved.diagnostics.length > 0 ? resolved.diagnostics : [diagnostic("CAPABILITY_NOT_FOUND", "warning", `No graph node matched "${resolved.query}".`)],
    recommendations: ["Run FeatureTouchpoints or query find first, then retry with a stable node id."],
  });
}

function resolveTarget(
  context: CapabilityContext,
  input: CapabilityInput,
): {
  readonly query: string;
  readonly node?: SoftwareGraphNode | undefined;
  readonly matches: readonly SoftwareGraphNode[];
  readonly diagnostics: readonly CapabilityDiagnostic[];
} {
  const value = readText(input, "id") || readText(input, "query") || readText(input, "task");
  if (!value) {
    return {
      query: "",
      matches: [],
      diagnostics: [diagnostic("CAPABILITY_MISSING_TARGET", "warning", "A node id, query, or task is required.")],
    };
  }

  const direct = context.query.findNode(value);
  if (direct?.id === value) {
    return { query: value, node: direct, matches: [direct], diagnostics: [] };
  }

  const intent = resolveIntent(context.semanticIndex, value, { limit: 10 });
  const intentMatches = nodesFromSearch(context, intent);
  const intentTop = intentMatches[0];
  const secondScore = intent.candidates[1]?.score ?? 0;

  if (intentTop && isConfidentIntentMatch(intent, secondScore)) {
    return { query: value, node: intentTop, matches: intentMatches, diagnostics: [] };
  }

  const matches = uniqueNodes([...intentMatches, ...context.query.findNodes(value)]);
  if (matches.length === 1 && matches[0]) {
    return { query: value, node: matches[0], matches, diagnostics: [] };
  }

  if (matches.length > 1) {
    return {
      query: value,
      matches,
      diagnostics: [diagnostic("CAPABILITY_AMBIGUOUS_TARGET", "warning", `"${value}" matched ${matches.length} graph nodes; retry with a stable node id.`)],
    };
  }

  return {
    query: value,
    matches: [],
    diagnostics: [diagnostic("CAPABILITY_NOT_FOUND", "warning", `No graph node matched "${value}".`)],
  };
}

function expandSemanticBoundary(
  context: CapabilityContext,
  seeds: readonly SoftwareGraphNode[],
  depth: number,
): { readonly nodes: readonly SoftwareGraphNode[]; readonly edges: readonly SoftwareGraphEdge[] } {
  const traversals = seeds.map((node) => context.query.walk(node.id, {
    direction: "both",
    depth,
    relationships: EXPANSION_RELATIONSHIPS,
  }));
  return {
    nodes: uniqueNodes(traversals.flatMap((traversal) => traversal.nodes)),
    edges: uniqueEdges(traversals.flatMap((traversal) => traversal.edges)),
  };
}

function groupNodes(nodes: readonly SoftwareGraphNode[]): Record<string, readonly SerializedNode[]> {
  const groups = new Map<string, SoftwareGraphNode[]>();
  for (const group of ARCHITECTURAL_GROUPS) {
    groups.set(group.label, []);
  }
  groups.set("Other", []);

  for (const node of uniqueNodes(nodes)) {
    const group = ARCHITECTURAL_GROUPS.find((candidate) =>
      candidate.types.includes(node.type) ||
      Boolean(candidate.namePatterns?.some((pattern) => pattern.test(`${node.id} ${node.name} ${node.file ?? ""}`))),
    );
    const label = group?.label ?? "Other";
    groups.get(label)?.push(node);
  }

  return Object.fromEntries(
    [...groups.entries()]
      .map(([label, groupNodes]) => [label, groupNodes.sort(compareNodes).map(serializeNode)] as const)
      .filter(([, groupNodes]) => groupNodes.length > 0),
  );
}

function countGroups(groups: Record<string, readonly SerializedNode[]>): JsonObject {
  return Object.fromEntries(Object.entries(groups).map(([label, nodes]) => [label, nodes.length]));
}

function implementationOrder(groups: Record<string, readonly SerializedNode[]>): readonly string[] {
  const order = [
    "Routes",
    "Controllers",
    "Services",
    "Persistence",
    "Configuration",
    "Authorization",
    "Modules",
    "External Boundaries",
    "Tests",
  ];
  return order
    .filter((label) => (groups[label]?.length ?? 0) > 0)
    .map((label) => `Update ${label.toLowerCase()} after reviewing ${groups[label]?.length ?? 0} graph node(s).`);
}

function repositoryRecommendations(context: CapabilityContext, stats: GraphStatistics): readonly string[] {
  const recommendations = [
    "Use ImpactAnalysis before removing or renaming high-degree nodes.",
  ];
  if (stats.cycles.length > 0) {
    recommendations.push("Resolve circular dependencies before public alpha release.");
  }
  if (context.graph.diagnostics.some((item) => item.severity === "error")) {
    recommendations.push("Fix graph diagnostics with severity error.");
  }
  return recommendations;
}

function featureMatches(context: CapabilityContext, value: string): readonly SoftwareGraphNode[] {
  const matches = new Map<string, SoftwareGraphNode>();
  const semantic = findFeature(context.semanticIndex, value, { limit: 30 });
  for (const node of nodesFromSearch(context, semantic)) {
    matches.set(node.id, node);
  }
  for (const node of context.query.findNodes(value)) {
    matches.set(node.id, node);
  }
  const terms = tokenize(value);
  for (const term of terms) {
    for (const node of context.query.findNodes(term)) {
      matches.set(node.id, node);
    }
  }
  return [...matches.values()].sort(compareNodes);
}

function nodesFromSearch(context: CapabilityContext, search: SemanticSearchResult): readonly SoftwareGraphNode[] {
  return search.candidates
    .map((candidate) => context.query.findNode(candidate.nodeId))
    .filter(isNode)
    .sort(compareNodes);
}

function isConfidentIntentMatch(search: SemanticSearchResult, secondScore: number): boolean {
  const top = search.candidates[0];
  if (!top) {
    return false;
  }
  if (top.reasons.some((reason) => reason.factor === "exact-symbol" || reason.factor === "exact-normalized-name")) {
    return true;
  }
  return top.confidence >= 0.62 && top.score - secondScore >= 90;
}

function deadCodeNodes(context: CapabilityContext): readonly SoftwareGraphNode[] {
  const relationships: readonly RelationshipType[] = ["CALLS", "HANDLES", "USES", "REFERENCES", "INJECTS", "AUTHORIZES", "REGISTERED_IN"];
  return context.query.findNodes()
    .filter((node) => ["Function", "Method", "Service", "Provider", "Repository", "Route"].includes(node.type))
    .filter((node) => context.query.incoming(node.id, relationships).length === 0)
    .sort(compareNodes);
}

function mostConnected(context: CapabilityContext, types: readonly NodeType[], limit: number): readonly JsonObject[] {
  const typeSet = new Set(types);
  return context.query.findNodes()
    .filter((node) => typeSet.has(node.type))
    .map((node) => ({
      nodeId: node.id,
      name: node.name,
      type: node.type,
      degree: context.query.incoming(node.id).length + context.query.outgoing(node.id).length,
    }))
    .sort((left, right) => Number(right.degree) - Number(left.degree) || String(left.nodeId).localeCompare(String(right.nodeId)))
    .slice(0, limit);
}

function hotspotNodes(context: CapabilityContext, nodes: readonly SoftwareGraphNode[], limit: number): readonly JsonObject[] {
  return nodes
    .map((node) => ({
      nodeId: node.id,
      name: node.name,
      type: node.type,
      degree: context.query.incoming(node.id).length + context.query.outgoing(node.id).length,
    }))
    .sort((left, right) => Number(right.degree) - Number(left.degree) || String(left.nodeId).localeCompare(String(right.nodeId)))
    .slice(0, limit);
}

function findRoute(context: CapabilityContext, value: string): SoftwareGraphNode | undefined {
  const direct = context.query.findNode(value);
  if (direct?.type === "Route") {
    return direct;
  }
  const normalized = value.toLowerCase();
  return context.query.routes().find((route) =>
    route.id.toLowerCase().includes(normalized) ||
    route.name.toLowerCase().includes(normalized) ||
    `${route.metadata?.method ?? ""}:${route.metadata?.path ?? ""}`.toLowerCase().includes(normalized),
  );
}

function nodeEvidence(description: string, nodes: readonly SoftwareGraphNode[], confidence = 1): CapabilityEvidence {
  return {
    kind: "node",
    description,
    confidence,
    nodes: uniqueNodes(nodes).map(serializeNode),
  };
}

function pathEvidence(description: string, nodes: readonly SoftwareGraphNode[], edges: readonly SoftwareGraphEdge[], fallbackConfidence = 0.9): CapabilityEvidence {
  return {
    kind: "path",
    description,
    confidence: edgeConfidence(edges, fallbackConfidence),
    nodes: uniqueNodes(nodes).map(serializeNode),
    edges: uniqueEdges(edges).map(serializeEdge),
  };
}

function statisticEvidence(description: string, stats: GraphStatistics): CapabilityEvidence {
  return {
    kind: "statistic",
    description,
    confidence: 1,
    nodes: [],
    edges: [],
    stats: serializeStats(stats),
  };
}

function confidenceFromEvidence(
  evidence: readonly CapabilityEvidence[],
  diagnostics: readonly CapabilityDiagnostic[],
): CapabilityConfidence {
  if (evidence.length === 0) {
    return {
      score: 0,
      level: "none",
      explanation: "No graph evidence was available.",
      factors: diagnostics.map((item) => ({ code: item.code, severity: item.severity })),
    };
  }

  const penalty = diagnostics.filter((item) => item.severity === "warning").length * 0.05 +
    diagnostics.filter((item) => item.severity === "error").length * 0.2;
  const score = Math.max(0, Math.min(1, average(evidence.map((item) => item.confidence)) - penalty));
  return {
    score,
    level: score >= 0.9 ? "high" : score >= 0.6 ? "medium" : score > 0 ? "low" : "none",
    explanation: `Computed from ${evidence.length} evidence item(s) and ${diagnostics.length} diagnostic(s).`,
    factors: evidence.map((item) => ({ kind: item.kind, confidence: item.confidence, description: item.description })),
  };
}

function edgeConfidence(edges: readonly SoftwareGraphEdge[], fallback: number): number {
  if (edges.length === 0) {
    return fallback;
  }
  return average(edges.map((edge) => {
    const evidence = edge.evidence?.[0];
    if (!evidence) {
      return 0.9;
    }
    const kindScore = evidence.kind === "syntax" ? 1 :
      evidence.kind === "semantic" ? 0.98 :
      evidence.kind === "resolver" ? 0.95 :
      evidence.kind === "config" ? 0.92 :
      evidence.kind === "plugin" ? 0.9 : 0.6;
    const confidenceScore = evidence.confidence === "exact" ? 1 : evidence.confidence === "inferred" ? 0.85 : 0.6;
    return Math.min(kindScore, confidenceScore);
  }));
}

function serializeNode(node: SoftwareGraphNode): SerializedNode {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    ...(node.file ? { file: node.file } : {}),
    ...(node.package ? { package: node.package } : {}),
    ...(node.span ? { span: serializeSpan(node.span) } : {}),
    ...(node.metadata ? { metadata: node.metadata } : {}),
  };
}

function serializeEdge(edge: SoftwareGraphEdge): SerializedEdge {
  return {
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
    ...(edge.evidence ? { evidence: edge.evidence.map((item) => ({ ...item, span: item.span ? serializeSpan(item.span) : undefined })) } : {}),
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

function serializeDiagnostic(diagnosticInput: SoftwareGraphDiagnostic | CapabilityDiagnostic): CapabilityDiagnostic {
  return {
    code: diagnosticInput.code,
    severity: diagnosticInput.severity,
    message: diagnosticInput.message,
    ...(diagnosticInput.nodeId ? { nodeId: diagnosticInput.nodeId } : {}),
    ...(diagnosticInput.edgeId ? { edgeId: diagnosticInput.edgeId } : {}),
    ...(diagnosticInput.span ? { span: serializeSpanLike(diagnosticInput.span) } : {}),
  };
}

function serializeSpanLike(span: SourceSpan | JsonObject): JsonObject {
  if (!("file" in span) || typeof span.file !== "string") {
    return {};
  }
  return {
    file: span.file,
    ...(typeof span.startLine === "number" ? { startLine: span.startLine } : {}),
    ...(typeof span.startColumn === "number" ? { startColumn: span.startColumn } : {}),
    ...(typeof span.endLine === "number" ? { endLine: span.endLine } : {}),
    ...(typeof span.endColumn === "number" ? { endColumn: span.endColumn } : {}),
  };
}

function serializeStats(stats: GraphStatistics): JsonObject {
  return JSON.parse(JSON.stringify(stats)) as JsonObject;
}

function graphProvenance(context: CapabilityContext): JsonObject {
  return {
    source: "Ontoly Software Graph",
    repository: context.graph.repository.name,
    root: context.graph.repository.root,
    graphHash: context.graph.metadata.deterministicHash,
    graphVersion: context.graph.version,
    nodeCount: context.graph.metadata.nodeCount,
    edgeCount: context.graph.metadata.edgeCount,
  };
}

function countEdges(edges: readonly SoftwareGraphEdge[]): JsonObject {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function uniqueNodes(nodes: readonly SoftwareGraphNode[]): readonly SoftwareGraphNode[] {
  return [...new Map(nodes.map((node) => [node.id, node] as const)).values()].sort(compareNodes);
}

function uniqueEdges(edges: readonly SoftwareGraphEdge[]): readonly SoftwareGraphEdge[] {
  return [...new Map(edges.map((edge) => [edge.id, edge] as const)).values()].sort(compareEdges);
}

function compareNodes(left: SoftwareGraphNode, right: SoftwareGraphNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function diagnostic(code: string, severity: DiagnosticSeverity, message: string): CapabilityDiagnostic {
  return { code, severity, message };
}

function targetInput(field = "id"): JsonObject {
  return {
    type: "object",
    properties: {
      [field]: { type: "string" },
      depth: { type: "number" },
    },
    required: [field],
  };
}

function optionalTargetInput(): JsonObject {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      query: { type: "string" },
      depth: { type: "number" },
    },
  };
}

function taskInput(): JsonObject {
  return {
    type: "object",
    properties: {
      task: { type: "string" },
      query: { type: "string" },
      depth: { type: "number" },
    },
    required: ["task"],
  };
}

function hasTarget(input: CapabilityInput): boolean {
  return Boolean(readText(input, "id") || readText(input, "query") || readText(input, "task"));
}

function readText(input: CapabilityInput, key: "id" | "query" | "task"): string {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function readDepth(input: CapabilityInput, fallback: number): number {
  const value = input.depth;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), 10) : fallback;
}

function tokenize(value: string): readonly string[] {
  return [...new Set(value
    .split(/[^A-Za-z0-9]+|(?=[A-Z])/g)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 2)
    .filter((part) => !["add", "the", "and", "for", "with", "from", "into"].includes(part)))]
    .sort();
}

function blastRadius(count: number): string {
  if (count >= 100) {
    return "large";
  }
  if (count >= 25) {
    return "medium";
  }
  return count > 0 ? "small" : "none";
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isNode(value: SoftwareGraphNode | undefined): value is SoftwareGraphNode {
  return Boolean(value);
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function capabilityResultToJson(resultInput: CapabilityResult): JsonValue {
  return JSON.parse(JSON.stringify(resultInput)) as JsonValue;
}
