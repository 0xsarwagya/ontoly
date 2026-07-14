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
} from "@0xsarwagya/ontoly-core";
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
  "EvidencePack",
] as const;

export type CapabilityName = (typeof CAPABILITY_NAMES)[number];

export interface CapabilityInput extends JsonObject {
  readonly id?: string | undefined;
  readonly query?: string | undefined;
  readonly task?: string | undefined;
  readonly depth?: number | undefined;
  readonly mode?: string | undefined;
  readonly limit?: number | undefined;
  readonly budget?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxTime?: number | undefined;
  readonly maxTimeMs?: number | undefined;
  readonly maxNodes?: number | undefined;
  readonly maxEdges?: number | undefined;
  readonly maxDepth?: number | undefined;
  readonly maxEvidence?: number | undefined;
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

export interface EvidencePackItem {
  readonly stableId: string;
  readonly kind: NodeType;
  readonly name: string;
  readonly confidence: number;
  readonly sourceSpan?: JsonObject | undefined;
  readonly whySelected: readonly string[];
  readonly relationships: JsonObject;
  readonly nextCommands: readonly string[];
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

export interface EvidencePack {
  readonly version: "1.0.0";
  readonly query: string;
  readonly answer: string;
  readonly graphFacts: JsonObject;
  readonly topNodes: readonly SerializedNode[];
  readonly topEdges: readonly SerializedEdge[];
  readonly relevantFiles: readonly string[];
  readonly relationships: JsonObject;
  readonly items: readonly EvidencePackItem[];
  readonly diagnostics: readonly CapabilityDiagnostic[];
  readonly confidence: CapabilityConfidence;
  readonly suggestedCommands: readonly string[];
  readonly stableIds: readonly string[];
  readonly filesToInspect: readonly string[];
  readonly fallbacks: readonly string[];
  readonly provenance: JsonObject;
}

interface PlanEvidencePack {
  readonly version: "1.0.0";
  readonly query: string;
  readonly topNodes: readonly SerializedNode[];
  readonly topEdges: readonly SerializedEdge[];
  readonly stableIds: readonly string[];
  readonly filesToInspect: readonly string[];
  readonly items: readonly EvidencePackItem[];
  readonly confidence: CapabilityConfidence;
  readonly limits: JsonObject;
  readonly truncated: boolean;
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

const IMPACT_MODE_SETTINGS = {
  direct: { depth: 1, nodeLimit: 20, edgeLimit: 40 },
  local: { depth: 2, nodeLimit: 50, edgeLimit: 100 },
  feature: { depth: 3, nodeLimit: 80, edgeLimit: 160 },
  semantic: { depth: 4, nodeLimit: 120, edgeLimit: 240 },
  "blast-radius": { depth: 5, nodeLimit: 200, edgeLimit: 400 },
} as const;

const EVIDENCE_PACK_NODE_LIMIT = 20;
const EVIDENCE_PACK_EDGE_LIMIT = 50;
const EVIDENCE_PACK_FILE_LIMIT = 10;
const EVIDENCE_PACK_SEMANTIC_LIMIT = 80;
const EVIDENCE_PACK_LEXICAL_LIMIT = 20;
const SERIALIZED_METADATA_DEPTH_LIMIT = 3;
const SERIALIZED_METADATA_ARRAY_LIMIT = 4;
const SERIALIZED_METADATA_ENTRY_LIMIT = 12;
const SERIALIZED_METADATA_STRING_LIMIT = 160;
const SERIALIZED_EDGE_EVIDENCE_LIMIT = 3;
const SERIALIZED_EDGE_DESCRIPTION_LIMIT = 240;

type ImpactMode = keyof typeof IMPACT_MODE_SETTINGS;

type BoundaryDirection = "inbound" | "outbound" | "both";

interface ExecutionBudget {
  readonly startedAt: number;
  readonly maxTimeMs: number;
  readonly maxNodes: number;
  readonly maxEdges: number;
  readonly maxDepth: number;
  readonly maxEvidence: number;
  readonly perNodeEdges: number;
}

interface BoundaryResult {
  readonly nodes: readonly SoftwareGraphNode[];
  readonly edges: readonly SoftwareGraphEdge[];
  readonly truncated: boolean;
  readonly reason: "COMPLETE" | "TIME_BUDGET_EXCEEDED" | "NODE_BUDGET_EXCEEDED" | "EDGE_BUDGET_EXCEEDED" | "DEPTH_BUDGET_EXCEEDED";
  readonly visitedNodes: number;
  readonly visitedEdges: number;
  readonly maxDepthReached: number;
}

interface ProfileStage {
  readonly name: string;
  readonly durationMs: number;
  readonly nodesVisited?: number | undefined;
  readonly edgesVisited?: number | undefined;
  readonly cacheHits?: number | undefined;
  readonly status: "complete" | "partial";
}

const OWNER_RELATIONSHIPS: readonly RelationshipType[] = [
  "CONTAINS",
  "PROVIDES",
  "REGISTERED_IN",
  "HANDLES",
  "DECLARES",
  "BELONGS_TO",
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
    capability("EvidencePack", "Create a compact deterministic evidence pack for agent workflows.", evidencePackInput(), evidencePackCapability),
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
  const resolved = resolveImpactTarget(context, input);
  if (!resolved.node) {
    return notFoundResult(context, "ImpactAnalysis", resolved);
  }

  const mode = readImpactMode(input);
  const settings = IMPACT_MODE_SETTINGS[mode];
  const depth = input.depth === undefined ? settings.depth : readDepth(input, settings.depth);
  const budget = createExecutionBudget(input, {
    maxTimeMs: 2_000,
    maxNodes: settings.nodeLimit,
    maxEdges: settings.edgeLimit,
    maxDepth: depth,
    maxEvidence: 20,
    perNodeEdges: 32,
  });
  const dependents = walkBoundary(context, [resolved.node], {
    direction: "inbound",
    depth,
    relationships: DEPENDENCY_RELATIONSHIPS,
    budget: sliceBudget(budget, Math.ceil(settings.nodeLimit / 2), Math.ceil(settings.edgeLimit / 2)),
  });
  const dependencies = walkBoundary(context, [resolved.node], {
    direction: "outbound",
    depth: Math.min(depth, 3),
    relationships: DEPENDENCY_RELATIONSHIPS,
    budget: sliceBudget(budget, Math.ceil(settings.nodeLimit / 2), Math.ceil(settings.edgeLimit / 2)),
  });
  const expanded = expandSemanticBoundary(context, [resolved.node], depth, {
    budget,
    seedLimit: 1,
  });
  const allNodes = uniqueNodes([resolved.node, ...dependents.nodes, ...dependencies.nodes, ...expanded.nodes]);
  const nodes = limitNodes([resolved.node], allNodes, settings.nodeLimit);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const allEdges = uniqueEdges([...dependents.edges, ...dependencies.edges, ...expanded.edges]);
  const edges = allEdges
    .filter((edge) => nodeIds.has(edge.from) || nodeIds.has(edge.to))
    .slice(0, settings.edgeLimit);
  const groups = groupNodes(nodes);
  const truncated = dependents.truncated || dependencies.truncated || expanded.truncated || allNodes.length > nodes.length || allEdges.length > edges.length;

  return result(context, {
    summary: `${resolved.node.name} has ${dependents.nodes.length - 1} dependent node(s) within ${mode} impact mode; ${nodes.length} graph node(s) are in the deterministic scope${truncated ? " after budget limits" : ""}.`,
    evidence: [
      pathEvidence("Dependent traversal identifies consumers that may break.", dependents.nodes, dependents.edges),
      pathEvidence("Dependency traversal identifies required implementation boundaries.", dependencies.nodes, dependencies.edges),
      pathEvidence("Semantic expansion adds routes, services, configuration, packages, and resources.", nodes, edges),
    ],
    affectedNodes: groups,
    statistics: {
      target: serializeNode(resolved.node),
      mode,
      traversalDepth: depth,
      nodeLimit: settings.nodeLimit,
      edgeLimit: settings.edgeLimit,
      truncated,
      budget: budgetStatistics(budget, [dependents, dependencies, expanded], truncated),
      unboundedNodeCount: allNodes.length,
      unboundedEdgeCount: allEdges.length,
      directDependents: Math.max(0, dependents.nodes.length - 1),
      relationshipCounts: countEdges(edges),
      architecturalGroups: countGroups(groups),
      blastRadius: blastRadius(nodes.length),
    },
    diagnostics: truncated ? [diagnostic("CAPABILITY_SCOPE_TRUNCATED", "warning", `Impact scope exceeded the ${mode} mode budget; returned deterministic partial evidence.`)] : [],
    recommendations: implementationOrder(groups),
  });
}

function implementationPlan(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const task = readText(input, "task") || readText(input, "query");
  const budget = createExecutionBudget(input, {
    maxTimeMs: 2_000,
    maxNodes: 80,
    maxEdges: 160,
    maxDepth: 3,
    maxEvidence: 20,
    perNodeEdges: 28,
  });
  const stages: ProfileStage[] = [];

  const semantic = profileStage(stages, "search", () =>
    resolveIntent(context.semanticIndex, task, { category: "feature", limit: Math.min(30, budget.maxEvidence * 2) }),
  );
  updateLastProfileStage(stages, { nodesVisited: semantic.candidates.length, cacheHits: 0 });
  const semanticScores = new Map(semantic.candidates.map((candidate) => [candidate.nodeId, candidate.score] as const));
  const resolvedSeed = profileStage(stages, "seed resolution", () =>
    resolveStableSemanticTarget(context, task, "ImplementationPlan", semantic),
  );
  const matches = uniqueNodesInOrder([
    ...(resolvedSeed.node ? [resolvedSeed.node] : []),
    ...resolvedSeed.matches,
    ...featureMatches(context, task, Math.min(budget.maxEvidence * 2, budget.maxNodes), semantic),
  ]).slice(0, Math.min(budget.maxEvidence, budget.maxNodes));
  updateLastProfileStage(stages, { nodesVisited: matches.length });
  const inspection = profileStage(stages, "inspect", () =>
    expandSemanticBoundary(context, matches, 1, {
      budget: sliceBudget(budget, Math.max(1, Math.min(budget.maxNodes, budget.maxEvidence)), Math.max(1, Math.min(budget.maxEdges, budget.maxEvidence * 2))),
      seedLimit: Math.min(budget.maxEvidence, matches.length),
    }),
  );
  updateLastProfileStage(stages, {
    nodesVisited: inspection.visitedNodes,
    edgesVisited: inspection.visitedEdges,
    status: inspection.truncated ? "partial" : "complete",
  });
  const impact = profileStage(stages, "scoped impact", () =>
    expandSemanticBoundary(context, uniqueNodesInOrder([...matches, ...inspection.nodes]), budget.maxDepth, {
      budget,
      seedLimit: Math.min(budget.maxEvidence, matches.length),
    }),
  );
  updateLastProfileStage(stages, {
    nodesVisited: impact.visitedNodes,
    edgesVisited: impact.visitedEdges,
    status: impact.truncated ? "partial" : "complete",
  });

  const owners = profileStage(stages, "ownership", () =>
    ownershipBoundary(context, uniqueNodesInOrder([...matches, ...impact.nodes]), budget),
  );
  updateLastProfileStage(stages, {
    nodesVisited: owners.visitedNodes,
    edgesVisited: owners.visitedEdges,
    status: owners.truncated ? "partial" : "complete",
  });

  const scopedNodes = uniqueNodesInOrder([...matches, ...inspection.nodes, ...impact.nodes, ...owners.nodes]);
  const scopedEdges = uniqueEdges([...inspection.edges, ...impact.edges, ...owners.edges]);
  const planEvidencePack = profileStage(stages, "evidence pack", () =>
    evidencePackForPlan(context, task, scopedNodes, scopedEdges, matches, semanticScores, budget),
  );
  updateLastProfileStage(stages, {
    nodesVisited: planEvidencePack.topNodes.length,
    edgesVisited: planEvidencePack.topEdges.length,
    status: planEvidencePack.truncated ? "partial" : "complete",
  });
  const repositoryIntelligence = profileStage(stages, "repository intelligence", () =>
    repositoryIntelligenceForPlan(context, scopedNodes, budget),
  );
  updateLastProfileStage(stages, { nodesVisited: scopedNodes.length });
  const rankedNodes = profileStage(stages, "plan", () =>
    rankEvidenceNodes(
      context,
      task,
      scopedNodes,
      matches,
      semanticScores,
    ),
  );
  updateLastProfileStage(stages, { nodesVisited: rankedNodes.length, edgesVisited: scopedEdges.length });
  const allNodes = uniqueNodesInOrder([...matches, ...rankedNodes]);
  const nodes = limitNodes(matches, allNodes, budget.maxNodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = scopedEdges
    .filter((edge) => nodeIds.has(edge.from) || nodeIds.has(edge.to))
    .slice(0, budget.maxEdges);
  const groups = groupNodes(nodes);
  const remainingNodes = Math.max(0, allNodes.length - nodes.length);
  const remainingEdges = Math.max(0, scopedEdges.length - edges.length);
  const partial = inspection.truncated || impact.truncated || owners.truncated || planEvidencePack.truncated || remainingNodes > 0 || remainingEdges > 0;
  const partialReason = inspection.truncated
    ? inspection.reason
    : impact.truncated
    ? impact.reason
    : owners.truncated
      ? owners.reason
      : planEvidencePack.truncated
        ? "NODE_BUDGET_EXCEEDED"
        : remainingEdges > 0
          ? "EDGE_BUDGET_EXCEEDED"
          : "NODE_BUDGET_EXCEEDED";
  if (partial) {
    updateLastProfileStage(stages, { status: "partial" });
  }
  const nextCommands = nextImplementationPlanCommands(task, matches, budget, partial);
  const recommendations = [
    `Start by confirming the ${matches.length > 0 ? "matched graph touchpoints" : "missing graph touchpoints"} for "${task}".`,
    ...implementationOrder(groups),
    "Add or update tests around affected routes, services, configuration, and persistence boundaries.",
    ...(partial ? nextCommands.map((command) => `Next command: ${command}`) : []),
  ];

  return result(context, {
    summary: `${partial ? "PARTIAL implementation plan" : "Implementation plan"} for "${task || "unspecified task"}" touches ${Object.keys(groups).length} architectural group(s), ${nodes.length} graph node(s), and ${edges.length} relationship(s).`,
    evidence: [
      nodeEvidence("Search and seed resolution identify deterministic planning touchpoints.", matches.slice(0, budget.maxEvidence), matches.length > 0 ? 0.75 : 0.2),
      pathEvidence("Inspect and scoped impact use bounded expansion over existing graph relationships.", nodes.slice(0, budget.maxEvidence), edges.slice(0, budget.maxEvidence), edges.length > 0 ? 0.9 : 0.35),
      nodeEvidence("Ownership uses direct inbound owner relationships from scoped graph nodes.", owners.nodes.slice(0, budget.maxEvidence), owners.nodes.length > 0 ? 0.7 : 0.35),
    ],
    affectedNodes: groups,
    statistics: {
      task,
      depth: budget.maxDepth,
      architecturalGroups: countGroups(groups),
      matchedTerms: tokenize(task),
      implementationOrder: implementationOrder(groups),
      progress: stages.map((stage) => `${stage.name}: ${stage.status}`),
      profile: stages,
      evidencePack: planEvidencePack,
      repositoryIntelligence,
      nextCommands,
      budget: {
        ...budgetStatistics(budget, [inspection, impact, owners], partial),
        status: partial ? "PARTIAL" : "COMPLETE",
        nodeBudget: budget.maxNodes,
        edgeBudget: budget.maxEdges,
        timeoutMs: budget.maxTimeMs,
        remainingNodes,
        remainingEdges,
        reason: partial ? partialReason : "COMPLETE",
      },
    },
    diagnostics: [
      ...(matches.length === 0 ? [diagnostic("CAPABILITY_LOW_EVIDENCE", "warning", "No direct graph touchpoints matched the task text.")] : []),
      ...(partial ? [
        diagnostic("CAPABILITY_PARTIAL_PLAN", "warning", `Implementation plan returned PARTIAL after hitting a deterministic execution budget (${partialReason}).`),
        diagnostic(`CAPABILITY_${partialReason}`, "warning", `Budgeted planner stopped at ${budget.maxNodes} node(s), ${budget.maxEdges} edge(s), depth ${budget.maxDepth}, and ${budget.maxEvidence} evidence item(s).`),
      ] : []),
    ],
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
  const expanded = expandSemanticBoundary(context, services, readDepth(input, 2), {
    budget: createExecutionBudget(input, {
      maxTimeMs: 1_500,
      maxNodes: 120,
      maxEdges: 240,
      maxDepth: 2,
      maxEvidence: 20,
      perNodeEdges: 20,
    }),
    seedLimit: 25,
  });
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
  const matches = featureMatches(context, value, 40);
  const expanded = expandSemanticBoundary(context, matches, readDepth(input, 3), {
    budget: createExecutionBudget(input, {
      maxTimeMs: 2_000,
      maxNodes: 120,
      maxEdges: 240,
      maxDepth: 3,
      maxEvidence: 20,
      perNodeEdges: 28,
    }),
    seedLimit: 20,
  });
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

function evidencePackCapability(context: CapabilityContext, input: CapabilityInput): CapabilityResult {
  const query = readText(input, "query") || readText(input, "task") || readText(input, "id") || context.graph.repository.name;
  const limit = readNumberLimit(input.limit, 12, 5, EVIDENCE_PACK_NODE_LIMIT);
  const budget = createExecutionBudget(input, {
    maxTimeMs: 1_500,
    maxNodes: EVIDENCE_PACK_NODE_LIMIT,
    maxEdges: EVIDENCE_PACK_EDGE_LIMIT,
    maxDepth: 2,
    maxEvidence: limit,
    perNodeEdges: 18,
  });
  const semantic = findFeature(context.semanticIndex, query, { limit: EVIDENCE_PACK_SEMANTIC_LIMIT });
  const semanticScores = new Map(semantic.candidates.map((candidate) => [candidate.nodeId, candidate.score] as const));
  const resolved = resolveStableSemanticTarget(context, query, "EvidencePack", semantic);
  const directId = readText(input, "id");
  const direct = directId ? context.query.findNode(directId) : undefined;
  const candidateNodes = evidencePackCandidates(context, query, semantic, direct);
  const seedNodes = uniqueNodesInOrder([
    ...(direct ? [direct] : []),
    ...(resolved.node ? [resolved.node] : []),
    ...resolved.matches.slice(0, Math.min(3, limit)),
  ]);
  const rankedNodes = rankEvidenceNodes(context, query, candidateNodes, seedNodes, semanticScores);
  const topNodes = limitNodes(seedNodes.slice(0, Math.min(3, limit)), clusterEvidenceCandidates(context, query, rankedNodes, semanticScores), limit);
  const expanded = expandSemanticBoundary(context, topNodes, readDepth(input, 2), {
    budget,
    seedLimit: Math.min(EVIDENCE_PACK_NODE_LIMIT, topNodes.length),
  });
  const topNodeIds = new Set(topNodes.map((node) => node.id));
  const topEdges = uniqueEdges([
    ...expanded.edges,
    ...topNodes.flatMap((node) => [...context.query.incoming(node.id), ...context.query.outgoing(node.id)]),
  ])
    .filter((edge) => topNodeIds.has(edge.from) || topNodeIds.has(edge.to))
    .slice(0, EVIDENCE_PACK_EDGE_LIMIT);
  const evidenceFileIds = new Set(topNodes.map((node) => node.file).filter(isString));
  const graphDiagnostics = context.graph.diagnostics
    .filter((item) => Boolean(item.nodeId && topNodeIds.has(item.nodeId)) || Boolean(item.span?.file && evidenceFileIds.has(item.span.file)))
    .map(serializeDiagnostic)
    .slice(0, 10);
  const diagnostics = [
    ...(topNodes.length === 0 ? [diagnostic("CAPABILITY_LOW_EVIDENCE", "warning", `No graph evidence matched "${query}".`)] : []),
    ...(expanded.truncated || candidateNodes.length > topNodes.length ? [diagnostic("CAPABILITY_EVIDENCE_TRUNCATED", "warning", "Evidence pack was bounded to 20 nodes, 50 edges, and 10 files.")] : []),
    ...resolved.diagnostics.filter((item) => item.code !== "CAPABILITY_AMBIGUOUS_TARGET"),
    ...graphDiagnostics,
  ];
  const evidence = [
    nodeEvidence("Top ranked graph nodes for the requested software concept.", topNodes, topNodes.length > 0 ? 0.9 : 0),
    pathEvidence("Nearby relationships provide compact agent-ready evidence.", topNodes, topEdges, topEdges.length > 0 ? 0.9 : 0.55),
  ];
  const confidence = confidenceFromEvidence(evidence, diagnostics);
  const serializedNodes = topNodes.map(serializeNode);
  const serializedEdges = topEdges.map(serializeEdge);
  const files = evidencePackFiles(context, serializedNodes, serializedEdges);
  const commands = suggestedEvidenceCommands(query, topNodes);
  const items = evidencePackItems(context, query, topNodes, topEdges, semanticScores);
  const pack: EvidencePack = {
    version: "1.0.0",
    query,
    answer: topNodes.length > 0
      ? `Ontoly found ${topNodes.length} graph node(s) and ${topEdges.length} relationship(s) relevant to "${query}".`
      : `Ontoly could not find deterministic graph evidence for "${query}".`,
    graphFacts: {
      repository: context.graph.repository.name,
      graphHash: context.graph.metadata.deterministicHash,
      graphVersion: context.graph.version,
      nodeCount: context.graph.metadata.nodeCount,
      edgeCount: context.graph.metadata.edgeCount,
      evidenceLimits: {
        nodes: EVIDENCE_PACK_NODE_LIMIT,
        edges: EVIDENCE_PACK_EDGE_LIMIT,
        files: EVIDENCE_PACK_FILE_LIMIT,
      },
    },
    topNodes: serializedNodes,
    topEdges: serializedEdges,
    relevantFiles: files,
    relationships: countEdges(topEdges),
    items,
    diagnostics,
    confidence,
    suggestedCommands: commands,
    stableIds: serializedNodes.map((node) => node.id),
    filesToInspect: files,
    fallbacks: confidence.score < 0.6
      ? ["Inspect listed files only after confirming Ontoly graph evidence is insufficient."]
      : ["Use repository search only if the evidence pack does not contain the needed graph fact."],
    provenance: graphProvenance(context),
  };

  return result(context, {
    summary: pack.answer,
    evidence,
    affectedNodes: groupNodes(topNodes),
    statistics: {
      evidencePack: pack,
      query,
      entities: topNodes.length,
      relationships: topEdges.length,
      budget: budgetStatistics(budget, [expanded], expanded.truncated),
      semanticCandidates: semantic.candidates.length,
      candidateNodes: candidateNodes.length,
      relationshipCounts: countEdges(topEdges),
    },
    diagnostics,
    recommendations: commands,
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

function resolveImpactTarget(
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

  return resolveStableSemanticTarget(context, value, "ImpactAnalysis");
}

function resolveStableSemanticTarget(
  context: CapabilityContext,
  value: string,
  capabilityName: string,
  search?: SemanticSearchResult | undefined,
): {
  readonly query: string;
  readonly node?: SoftwareGraphNode | undefined;
  readonly matches: readonly SoftwareGraphNode[];
  readonly diagnostics: readonly CapabilityDiagnostic[];
} {
  const semantic = search ?? findFeature(context.semanticIndex, value, { limit: 20 });
  const semanticNodes = nodesFromSearch(context, semantic);
  const semanticScores = new Map(semantic.candidates.map((candidate) => [candidate.nodeId, candidate.score] as const));
  const rankedMatches = rankSeedNodes(context, value, semanticNodes, semanticScores);
  const preferredMatches = rankedMatches.filter(isPreferredNaturalSeedNode);
  const matches = preferredMatches.length > 0
    ? uniqueNodesInOrder([...preferredMatches, ...rankedMatches])
    : rankedMatches;
  const top = matches[0];
  const topCandidate = top ? semantic.candidates.find((candidate) => candidate.nodeId === top.id) : undefined;
  const topSeedScore = top ? seedResolutionScore(context, value, top, semanticScores) : 0;
  const second = matches[1];
  const secondSeedScore = second ? seedResolutionScore(context, value, second, semanticScores) : 0;
  const topConfidence = top && topCandidate
    ? seedResolutionConfidence(context, value, top, topCandidate.confidence, topSeedScore, secondSeedScore)
    : 0;

  if (top && topCandidate && isStableSemanticTarget(top, topCandidate, topConfidence, topSeedScore, secondSeedScore)) {
    return { query: value, node: top, matches, diagnostics: [] };
  }

  if (top && matches.length === 1 && topCandidate && topConfidence >= 0.55 && isRepositoryLocalNode(top)) {
    return { query: value, node: top, matches, diagnostics: [] };
  }

  if (matches.length > 1) {
    return {
      query: value,
      matches,
      diagnostics: [diagnostic("CAPABILITY_AMBIGUOUS_TARGET", "warning", `${capabilityName} could not resolve "${value}" to one stable semantic node. Alternatives: ${semanticAlternatives(semantic)}.`)],
    };
  }

  return {
    query: value,
    matches,
    diagnostics: [diagnostic("CAPABILITY_NOT_FOUND", "warning", `No semantic graph node matched "${value}".`)],
  };
}

function semanticAlternatives(search: SemanticSearchResult): string {
  return search.candidates
    .slice(0, 5)
    .map((candidate) => `${candidate.nodeId} (${candidate.displayName}, confidence ${candidate.confidence.toFixed(3)})`)
    .join("; ");
}

function isStableSemanticTarget(
  node: SoftwareGraphNode,
  candidate: SemanticSearchResult["candidates"][number],
  confidence: number,
  score: number,
  secondScore: number,
): boolean {
  if (candidate.reasons.some((reason) => reason.factor === "exact-symbol" || reason.factor === "exact-normalized-name")) {
    return true;
  }
  if (!isRepositoryLocalNode(node)) {
    return false;
  }
  const margin = score - secondScore;
  if (confidence >= 0.74) {
    return true;
  }
  if (confidence >= 0.62 && margin >= 35) {
    return true;
  }
  return confidence >= 0.55 && ["Route", "Controller", "Service", "Provider", "Repository", "Module", "Model", "Configuration", "Method", "Function", "Guard", "EnvironmentVariable", "Class", "Interface", "TypeAlias"].includes(node.type);
}

function isPreferredNaturalSeedNode(node: SoftwareGraphNode): boolean {
  return isRepositoryLocalNode(node) && [
    "Route",
    "Controller",
    "Service",
    "Provider",
    "Repository",
    "Model",
    "Resource",
    "Configuration",
    "EnvironmentVariable",
    "Method",
    "Function",
    "Guard",
    "TypeAlias",
    "Interface",
    "Class",
  ].includes(node.type);
}

function expandSemanticBoundary(
  context: CapabilityContext,
  seeds: readonly SoftwareGraphNode[],
  depth: number,
  options: {
    readonly budget?: ExecutionBudget | undefined;
    readonly direction?: BoundaryDirection | undefined;
    readonly seedLimit?: number | undefined;
  } = {},
): BoundaryResult {
  const budget = options.budget ?? createExecutionBudget({}, {
    maxTimeMs: 1_500,
    maxNodes: 120,
    maxEdges: 240,
    maxDepth: depth,
    maxEvidence: 20,
    perNodeEdges: 28,
  });
  return walkBoundary(context, uniqueNodesInOrder(seeds).slice(0, options.seedLimit ?? budget.maxNodes), {
    direction: options.direction ?? "both",
    depth,
    relationships: EXPANSION_RELATIONSHIPS,
    budget,
  });
}

function ownershipBoundary(
  context: CapabilityContext,
  seeds: readonly SoftwareGraphNode[],
  budget: ExecutionBudget,
): BoundaryResult {
  const seedIds = new Set(seeds.map((node) => node.id));
  const traversal = walkBoundary(context, seeds.slice(0, budget.maxEvidence), {
    direction: "inbound",
    depth: 1,
    relationships: OWNER_RELATIONSHIPS,
    budget: sliceBudget(budget, budget.maxEvidence, budget.maxEvidence * 2),
  });

  return {
    ...traversal,
    nodes: traversal.nodes.filter((node) => !seedIds.has(node.id)),
  };
}

function repositoryIntelligenceForPlan(
  context: CapabilityContext,
  nodes: readonly SoftwareGraphNode[],
  budget: ExecutionBudget,
): JsonObject {
  const scopedNodes = uniqueNodes(nodes).slice(0, budget.maxNodes);
  const scopedFiles = orderedUnique(scopedNodes.map((node) => node.file).filter(isString))
    .slice(0, budget.maxEvidence);
  const scopedPackages = orderedUnique(scopedNodes.map((node) => node.package).filter(isString))
    .slice(0, budget.maxEvidence);

  return {
    repository: context.graph.repository.name,
    graphHash: context.graph.metadata.deterministicHash,
    graphNodes: context.graph.metadata.nodeCount,
    graphEdges: context.graph.metadata.edgeCount,
    scopedFiles,
    scopedPackages,
    scopedHotspots: hotspotNodes(context, scopedNodes, Math.min(10, budget.maxEvidence)) as JsonValue,
    diagnostics: context.graph.diagnostics.length,
  };
}

function evidencePackForPlan(
  context: CapabilityContext,
  task: string,
  nodes: readonly SoftwareGraphNode[],
  edges: readonly SoftwareGraphEdge[],
  seeds: readonly SoftwareGraphNode[],
  semanticScores: ReadonlyMap<string, number>,
  budget: ExecutionBudget,
): PlanEvidencePack {
  const nodeLimit = Math.min(EVIDENCE_PACK_NODE_LIMIT, budget.maxEvidence);
  const edgeLimit = Math.min(EVIDENCE_PACK_EDGE_LIMIT, budget.maxEdges);
  const ownerSeedNodes = planOwnerEvidenceNodes(context, seeds, nodes);
  const rankedNodes = limitNodes(
    uniqueNodesInOrder([...seeds.slice(0, 3), ...ownerSeedNodes]).slice(0, Math.min(nodeLimit, Math.max(1, 3 + ownerSeedNodes.length))),
    rankEvidenceNodes(context, task, nodes, seeds, semanticScores),
    nodeLimit,
  );
  const nodeIds = new Set(rankedNodes.map((node) => node.id));
  const rankedEdges = uniqueEdges(edges)
    .filter((edge) => nodeIds.has(edge.from) || nodeIds.has(edge.to))
    .slice(0, edgeLimit);
  const serializedNodes = rankedNodes.map(serializeNode);
  const serializedEdges = rankedEdges.map(serializeEdge);
  const filesToInspect = evidencePackFiles(context, serializedNodes, serializedEdges);
  const items = evidencePackItems(context, task, rankedNodes, rankedEdges, semanticScores);
  const diagnostics = rankedNodes.length === 0
    ? [diagnostic("CAPABILITY_LOW_EVIDENCE", "warning", `No graph evidence matched "${task}".`)]
    : [];
  const confidence = confidenceFromEvidence([
    nodeEvidence("Plan evidence pack stable nodes.", rankedNodes, rankedNodes.length > 0 ? 0.9 : 0),
    pathEvidence("Plan evidence pack scoped relationships.", rankedNodes, rankedEdges, rankedEdges.length > 0 ? 0.85 : 0.45),
  ], diagnostics);

  return {
    version: "1.0.0",
    query: task,
    topNodes: serializedNodes,
    topEdges: serializedEdges,
    stableIds: serializedNodes.map((node) => node.id),
    filesToInspect,
    items,
    confidence,
    limits: {
      nodes: nodeLimit,
      edges: edgeLimit,
      files: EVIDENCE_PACK_FILE_LIMIT,
    },
    truncated: nodes.length > rankedNodes.length || edges.length > rankedEdges.length,
  };
}

function planOwnerEvidenceNodes(
  context: CapabilityContext,
  seeds: readonly SoftwareGraphNode[],
  scopedNodes: readonly SoftwareGraphNode[],
): readonly SoftwareGraphNode[] {
  const scopedIds = new Set(scopedNodes.map((node) => node.id));
  const ownerIds = new Set<string>();
  for (const seed of seeds.slice(0, EVIDENCE_PACK_NODE_LIMIT)) {
    for (const edge of [
      ...context.query.incoming(seed.id, OWNER_RELATIONSHIPS),
      ...context.query.incoming(seed.id, ["READS", "WRITES", "REFERENCES", "USES", "CALLS"]),
    ]) {
      if (scopedIds.has(edge.from)) {
        ownerIds.add(edge.from);
        for (const parentEdge of context.query.incoming(edge.from, ["CONTAINS", "CALLS", "HANDLES", "USES", "PROVIDES"])) {
          if (scopedIds.has(parentEdge.from)) {
            ownerIds.add(parentEdge.from);
          }
        }
      }
    }
  }
  return [...ownerIds]
    .map((id) => context.query.findNode(id))
    .filter(isNode)
    .filter((node) => ["Service", "Provider", "Controller", "Method", "Function", "Repository", "Class"].includes(node.type))
    .sort(compareNodes);
}

function walkBoundary(
  context: CapabilityContext,
  seeds: readonly SoftwareGraphNode[],
  options: {
    readonly direction: BoundaryDirection;
    readonly depth: number;
    readonly relationships: readonly RelationshipType[];
    readonly budget: ExecutionBudget;
  },
): BoundaryResult {
  const budget = options.budget;
  const maxDepth = Math.min(options.depth, budget.maxDepth);
  const nodeMap = new Map<string, SoftwareGraphNode>();
  const edgeMap = new Map<string, SoftwareGraphEdge>();
  const queue: { node: SoftwareGraphNode; depth: number }[] = [];
  let truncated = false;
  let reason: BoundaryResult["reason"] = "COMPLETE";
  let maxDepthReached = 0;
  const orderedSeeds = uniqueNodesInOrder(seeds);

  for (const seed of orderedSeeds.slice(0, budget.maxNodes)) {
    nodeMap.set(seed.id, seed);
    queue.push({ node: seed, depth: 0 });
  }
  if (orderedSeeds.length > budget.maxNodes) {
    truncated = true;
    reason = "NODE_BUDGET_EXCEEDED";
  }

  while (queue.length > 0) {
    if (timeExceeded(budget)) {
      truncated = true;
      reason = "TIME_BUDGET_EXCEEDED";
      break;
    }

    const current = queue.shift();
    if (!current) {
      break;
    }
    maxDepthReached = Math.max(maxDepthReached, current.depth);
    if (current.depth >= maxDepth) {
      continue;
    }

    const allAdjacentEdges = edgesForDirection(context, current.node.id, options.direction, options.relationships);
    const adjacentEdges = allAdjacentEdges.slice(0, budget.perNodeEdges);
    if (allAdjacentEdges.length > adjacentEdges.length && reason === "COMPLETE") {
      truncated = true;
      reason = "EDGE_BUDGET_EXCEEDED";
    }

    for (const edge of adjacentEdges) {
      if (timeExceeded(budget)) {
        truncated = true;
        reason = "TIME_BUDGET_EXCEEDED";
        break;
      }
      if (!edgeMap.has(edge.id)) {
        if (edgeMap.size >= budget.maxEdges) {
          truncated = true;
          reason = "EDGE_BUDGET_EXCEEDED";
          break;
        }
        edgeMap.set(edge.id, edge);
      }

      for (const nextId of neighborIds(edge, current.node.id, options.direction)) {
        if (nodeMap.has(nextId)) {
          continue;
        }
        if (nodeMap.size >= budget.maxNodes) {
          truncated = true;
          reason = "NODE_BUDGET_EXCEEDED";
          break;
        }
        const next = context.query.findNode(nextId);
        if (!next) {
          continue;
        }
        nodeMap.set(next.id, next);
        queue.push({ node: next, depth: current.depth + 1 });
        maxDepthReached = Math.max(maxDepthReached, current.depth + 1);
      }
      if (truncated) {
        break;
      }
    }
    if (truncated) {
      break;
    }
  }

  return {
    nodes: [...nodeMap.values()].sort(compareNodes),
    edges: [...edgeMap.values()].sort(compareEdges),
    truncated,
    reason,
    visitedNodes: nodeMap.size,
    visitedEdges: edgeMap.size,
    maxDepthReached,
  };
}

function edgesForDirection(
  context: CapabilityContext,
  nodeId: string,
  direction: BoundaryDirection,
  relationships: readonly RelationshipType[],
): readonly SoftwareGraphEdge[] {
  if (direction === "inbound") {
    return [...context.query.incoming(nodeId, relationships)].sort(compareEdges);
  }
  if (direction === "outbound") {
    return [...context.query.outgoing(nodeId, relationships)].sort(compareEdges);
  }
  return uniqueEdges([
    ...context.query.incoming(nodeId, relationships),
    ...context.query.outgoing(nodeId, relationships),
  ]);
}

function neighborIds(edge: SoftwareGraphEdge, currentId: string, direction: BoundaryDirection): readonly string[] {
  if (direction === "inbound") {
    return edge.from === currentId ? [] : [edge.from];
  }
  if (direction === "outbound") {
    return edge.to === currentId ? [] : [edge.to];
  }
  return [edge.from, edge.to].filter((id) => id !== currentId);
}

function createExecutionBudget(
  input: Partial<CapabilityInput>,
  defaults: Omit<ExecutionBudget, "startedAt">,
): ExecutionBudget {
  return {
    startedAt: Date.now(),
    maxTimeMs: readNumberLimit(input.maxTimeMs ?? input.maxTime ?? input.timeoutMs, defaults.maxTimeMs, 0, 30_000),
    maxNodes: readNumberLimit(input.maxNodes ?? input.budget, defaults.maxNodes, 1, 250),
    maxEdges: readNumberLimit(input.maxEdges, defaults.maxEdges, 1, 1_000),
    maxDepth: readNumberLimit(input.maxDepth ?? input.depth, defaults.maxDepth, 0, 8),
    maxEvidence: readNumberLimit(input.maxEvidence ?? input.limit, defaults.maxEvidence, 1, 50),
    perNodeEdges: readNumberLimit(undefined, defaults.perNodeEdges, 1, 100),
  };
}

function sliceBudget(budget: ExecutionBudget, maxNodes: number, maxEdges: number): ExecutionBudget {
  return {
    ...budget,
    maxNodes: Math.max(1, Math.min(budget.maxNodes, maxNodes)),
    maxEdges: Math.max(0, Math.min(budget.maxEdges, maxEdges)),
  };
}

function timeExceeded(budget: ExecutionBudget): boolean {
  return budget.maxTimeMs <= 0 || Date.now() - budget.startedAt > budget.maxTimeMs;
}

function budgetStatistics(
  budget: ExecutionBudget,
  traversals: readonly BoundaryResult[],
  partial: boolean,
): JsonObject {
  const visitedNodes = Math.max(0, ...traversals.map((item) => item.visitedNodes));
  const visitedEdges = Math.max(0, ...traversals.map((item) => item.visitedEdges));
  const maxDepthReached = Math.max(0, ...traversals.map((item) => item.maxDepthReached));
  const reason = traversals.find((item) => item.truncated)?.reason ?? "COMPLETE";
  return {
    status: partial ? "PARTIAL" : "COMPLETE",
    maxTimeMs: budget.maxTimeMs,
    maxNodes: budget.maxNodes,
    maxEdges: budget.maxEdges,
    maxDepth: budget.maxDepth,
    maxEvidence: budget.maxEvidence,
    visitedNodes,
    visitedEdges,
    maxDepthReached,
    reason: partial ? reason : "COMPLETE",
  };
}

function profileStage<T>(
  stages: ProfileStage[],
  name: string,
  run: () => T,
  metrics: Partial<Omit<ProfileStage, "name" | "durationMs" | "status">> = {},
): T {
  const started = Date.now();
  const value = run();
  stages.push({
    name,
    durationMs: Math.max(0, Date.now() - started),
    status: "complete",
    ...metrics,
  });
  return value;
}

function updateLastProfileStage(stages: ProfileStage[], metrics: Partial<Omit<ProfileStage, "name" | "durationMs">>): void {
  const current = stages[stages.length - 1];
  if (current) {
    stages[stages.length - 1] = { ...current, ...metrics };
  }
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

function featureMatches(
  context: CapabilityContext,
  value: string,
  limit = 30,
  search?: SemanticSearchResult | undefined,
): readonly SoftwareGraphNode[] {
  if (!value) {
    return [];
  }
  const matches = new Map<string, SoftwareGraphNode>();
  const semantic = search ?? findFeature(context.semanticIndex, value, { limit: Math.max(limit, 10) });
  const semanticScores = new Map(semantic.candidates.map((candidate) => [candidate.nodeId, candidate.score] as const));
  for (const node of nodesFromSearch(context, semantic)) {
    matches.set(node.id, node);
  }
  return rankEvidenceNodes(context, value, [...matches.values()], nodesFromSearch(context, semantic), semanticScores).slice(0, limit);
}

function evidencePackCandidates(
  context: CapabilityContext,
  query: string,
  semantic: SemanticSearchResult,
  direct: SoftwareGraphNode | undefined,
): readonly SoftwareGraphNode[] {
  return uniqueNodesInOrder([
    ...(direct ? [direct] : []),
    ...nodesFromSearch(context, semantic),
    ...featureMatches(context, query, EVIDENCE_PACK_LEXICAL_LIMIT, semantic),
  ]);
}

function evidencePackFiles(
  context: CapabilityContext,
  nodes: readonly SerializedNode[],
  edges: readonly SerializedEdge[],
): readonly string[] {
  const files = new Set<string>();
  for (const node of nodes) {
    if (node.file) {
      files.add(node.file);
    }
  }
  for (const edge of edges) {
    for (const nodeId of [edge.from, edge.to]) {
      const node = context.query.findNode(nodeId);
      if (node?.file) {
        files.add(node.file);
      }
    }
  }
  return [...files].sort().slice(0, EVIDENCE_PACK_FILE_LIMIT);
}

function evidencePackItems(
  context: CapabilityContext,
  query: string,
  nodes: readonly SoftwareGraphNode[],
  edges: readonly SoftwareGraphEdge[],
  semanticScores: ReadonlyMap<string, number>,
): readonly EvidencePackItem[] {
  return nodes.map((node) => {
    const incoming = edges.filter((edge) => edge.to === node.id);
    const outgoing = edges.filter((edge) => edge.from === node.id);
    return {
      stableId: node.id,
      kind: node.type,
      name: node.name,
      confidence: evidenceItemConfidence(query, node, semanticScores),
      ...(node.span ? { sourceSpan: serializeSpan(node.span) } : node.file ? { sourceSpan: { file: node.file } } : {}),
      whySelected: evidenceItemReasons(query, node, semanticScores),
      relationships: {
        incoming: countEdges(incoming),
        outgoing: countEdges(outgoing),
        incomingCount: incoming.length,
        outgoingCount: outgoing.length,
      },
      nextCommands: nodeEvidenceCommands(query, node),
    };
  });
}

function evidenceItemConfidence(
  query: string,
  node: SoftwareGraphNode,
  semanticScores: ReadonlyMap<string, number>,
): number {
  const terms = tokenize(query);
  const coverage = semanticNodeCoverage(node, terms);
  const semantic = Math.min(1, (semanticScores.get(node.id) ?? 0) / 850);
  const locality = isRepositoryLocalNode(node) ? 1 : 0.2;
  const confidence = semantic * 0.45 + coverage.ratio * 0.35 + locality * 0.2;
  return Math.round(Math.max(0, Math.min(0.98, confidence)) * 1_000) / 1_000;
}

function evidenceItemReasons(
  query: string,
  node: SoftwareGraphNode,
  semanticScores: ReadonlyMap<string, number>,
): readonly string[] {
  const coverage = semanticNodeCoverage(node, tokenize(query));
  const reasons = [
    `${node.type} ${isRepositoryLocalNode(node) ? "from repository-local graph evidence" : "from external boundary"}`,
  ];
  if (coverage.matched.length > 0) {
    reasons.push(`matched query token(s): ${coverage.matched.join(", ")}`);
  }
  const score = semanticScores.get(node.id);
  if (score !== undefined) {
    reasons.push(`semantic score ${Math.round(score)}`);
  }
  if (node.file) {
    reasons.push(`source file ${node.file}`);
  }
  return reasons;
}

function nodeEvidenceCommands(query: string, node: SoftwareGraphNode): readonly string[] {
  const escaped = query.replaceAll("\"", "\\\"");
  return [
    `ontoly inspect ${node.id}`,
    `ontoly impact ${node.id} --mode local`,
    `ontoly evidence "${escaped}" --limit ${EVIDENCE_PACK_NODE_LIMIT}`,
  ];
}

function rankEvidenceNodes(
  context: CapabilityContext,
  query: string,
  nodes: readonly SoftwareGraphNode[],
  seeds: readonly SoftwareGraphNode[],
  semanticScores: ReadonlyMap<string, number>,
): readonly SoftwareGraphNode[] {
  const terms = tokenize(query);
  const seedIds = new Set(seeds.map((node) => node.id));
  return [...nodes].sort((left, right) =>
    evidenceNodeScore(context, right, terms, seedIds, semanticScores) - evidenceNodeScore(context, left, terms, seedIds, semanticScores) ||
    left.id.localeCompare(right.id),
  );
}

function evidenceNodeScore(
  context: CapabilityContext,
  node: SoftwareGraphNode,
  terms: readonly string[],
  seedIds: ReadonlySet<string>,
  semanticScores: ReadonlyMap<string, number>,
): number {
  const haystack = tokenize(nodeSemanticText(node));
  const typeWeight = node.type === "Service" || node.type === "Provider" ? 96 :
    node.type === "Class" && /service$/i.test(node.name) ? 90 :
    node.type === "Controller" ? 82 :
    node.type === "Route" ? 70 :
    node.type === "Repository" ? 58 :
    node.type === "Model" || node.type === "Resource" ? 54 :
    node.type === "Module" || node.type === "Package" ? 50 :
    node.type === "Interface" || node.type === "TypeAlias" ? 46 :
    node.type === "Configuration" || node.type === "EnvironmentVariable" ? 45 :
    node.type === "Function" || node.type === "Method" ? 36 : 20;
  const matchWeight = terms.filter((term) => haystack.includes(term)).length * 25;
  const seedWeight = seedIds.has(node.id) ? 100 : 0;
  const semanticWeight = Math.min(300, semanticScores.get(node.id) ?? 0);
  const degreeWeight = Math.min(45, (context.query.incoming(node.id).length + context.query.outgoing(node.id).length) * 4);
  const localityWeight = isRepositoryLocalNode(node) ? 70 : -120;
  const dtoWeight = /\bdto\b|dto$|schema|request|response|payload/i.test(`${node.name} ${node.file ?? ""}`) && isRepositoryLocalNode(node) ? 34 : 0;
  const mapperWeight = /\bmapper\b|mapper$/i.test(`${node.name} ${node.file ?? ""}`) && isRepositoryLocalNode(node) ? 24 : 0;
  const testWeight = /(^|[/.])(test|tests|spec|__tests__)([/.]|$)|\.(test|spec)\./i.test(node.file ?? "") ? 20 : 0;
  const featureWeight = /module|feature|controller|service|repository|threshold|configuration/i.test(`${node.id} ${node.name}`) && isRepositoryLocalNode(node) ? 26 : 0;
  const frameworkPenalty = isExternalFrameworkNode(node) ? 220 : 0;
  const utilityPenalty = /(^|[/.])(utils?|helpers?|common|shared)([/.]|$)|util(ity)?$/i.test(`${node.name} ${node.file ?? ""}`) ? 34 : 0;
  const coverage = semanticNodeCoverage(node, terms);
  const coverageWeight = Math.round(coverage.ratio * 150);
  const missingPenalty = coverage.missing.length * 55;
  const featurePenalty = semanticFeaturePenalty(node, terms);
  return semanticWeight + seedWeight + typeWeight + matchWeight + degreeWeight + localityWeight + dtoWeight + mapperWeight + testWeight + featureWeight + coverageWeight - frameworkPenalty - utilityPenalty - missingPenalty - featurePenalty;
}

function rankSeedNodes(
  context: CapabilityContext,
  query: string,
  nodes: readonly SoftwareGraphNode[],
  semanticScores: ReadonlyMap<string, number>,
): readonly SoftwareGraphNode[] {
  return [...nodes].sort((left, right) =>
    seedResolutionScore(context, query, right, semanticScores) - seedResolutionScore(context, query, left, semanticScores) ||
    left.id.localeCompare(right.id),
  );
}

function seedResolutionScore(
  context: CapabilityContext,
  query: string,
  node: SoftwareGraphNode,
  semanticScores: ReadonlyMap<string, number>,
): number {
  const terms = tokenize(query);
  const seedIds = new Set([node.id]);
  const coverage = semanticNodeCoverage(node, terms);
  const coverageWeight = Math.round(coverage.ratio * 160);
  const missingPenalty = coverage.missing.length * 55;
  const featurePenalty = semanticFeaturePenalty(node, terms);
  return evidenceNodeScore(context, node, terms, seedIds, semanticScores) + coverageWeight - missingPenalty - featurePenalty;
}

function seedResolutionConfidence(
  context: CapabilityContext,
  query: string,
  node: SoftwareGraphNode,
  semanticConfidence: number,
  score: number,
  secondScore: number,
): number {
  const terms = tokenize(query);
  const coverage = semanticNodeCoverage(node, terms);
  const connectivity = Math.min(1, (context.query.incoming(node.id).length + context.query.outgoing(node.id).length + 1) / 8);
  const architecture = ["Route", "Controller", "Service", "Provider", "Repository", "Module", "Model", "Configuration", "Method", "Function", "TypeAlias", "Interface", "Guard", "EnvironmentVariable"].includes(node.type) ? 1 : 0.55;
  const locality = isRepositoryLocalNode(node) ? 1 : 0.1;
  const margin = secondScore > 0 ? Math.min(1, Math.max(0, (score - secondScore) / 140)) : 1;
  let confidence = semanticConfidence * 0.32 + coverage.ratio * 0.24 + locality * 0.2 + architecture * 0.12 + connectivity * 0.06 + margin * 0.06;
  if (!isRepositoryLocalNode(node)) {
    confidence = Math.min(confidence, 0.46);
  }
  if (coverage.missing.length > 0) {
    confidence = Math.min(confidence, 0.8 - Math.min(0.28, coverage.missing.length * 0.09));
  }
  if (secondScore > 0 && score - secondScore < 35) {
    confidence = Math.min(confidence, 0.78);
  }
  if (semanticFeaturePenalty(node, terms) > 0) {
    confidence = Math.min(confidence, 0.62);
  }
  return Math.max(0, Math.min(0.98, confidence));
}

function semanticNodeCoverage(
  node: SoftwareGraphNode,
  terms: readonly string[],
): { readonly matched: readonly string[]; readonly missing: readonly string[]; readonly ratio: number } {
  const required = [...new Set(terms.filter((term) => term.length > 2))];
  if (required.length === 0) {
    return { matched: [], missing: [], ratio: 1 };
  }
  const haystack = new Set(tokenize(nodeSemanticText(node)));
  const matched = required.filter((term) => haystack.has(term));
  const missing = required.filter((term) => !matched.includes(term));
  return { matched, missing, ratio: matched.length / required.length };
}

function semanticFeaturePenalty(node: SoftwareGraphNode, terms: readonly string[]): number {
  const termSet = new Set(terms);
  const haystack = new Set(tokenize(nodeSemanticText(node)));
  let penalty = 0;
  if ((termSet.has("threshold") || termSet.has("thresholds")) && !haystack.has("threshold")) {
    penalty += 120;
  }
  if ((termSet.has("threshold") || termSet.has("thresholds")) && (haystack.has("statistics") || haystack.has("statistic") || haystack.has("observation")) && !haystack.has("threshold")) {
    penalty += 220;
  }
  if (termSet.has("duration") && !haystack.has("duration")) {
    penalty += 55;
  }
  if (termSet.has("sleep") && !haystack.has("sleep")) {
    penalty += 35;
  }
  return penalty;
}

function nodeSemanticText(node: SoftwareGraphNode): string {
  return `${node.id} ${node.name} ${node.file ?? ""} ${node.package ?? ""} ${metadataSeedText(node.metadata)}`;
}

function metadataSeedText(value: unknown, remaining = 16): string {
  if (remaining <= 0 || value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value.slice(0, 512);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 4).map((item) => metadataSeedText(item, remaining - 1)).join(" ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /doc|description|comment|summary|name|type|resource|path|method/i.test(key))
      .slice(0, 8)
      .map(([key, item]) => `${key} ${metadataSeedText(item, remaining - 1)}`)
      .join(" ");
  }
  return "";
}

function clusterEvidenceCandidates(
  context: CapabilityContext,
  query: string,
  nodes: readonly SoftwareGraphNode[],
  semanticScores: ReadonlyMap<string, number>,
): readonly SoftwareGraphNode[] {
  const ranked = rankEvidenceNodes(context, query, nodes, nodes, semanticScores);
  const buckets = new Map<string, SoftwareGraphNode[]>();
  for (const node of ranked) {
    const label = ARCHITECTURAL_GROUPS.find((group) =>
      group.types.includes(node.type) ||
      Boolean(group.namePatterns?.some((pattern) => pattern.test(`${node.id} ${node.name} ${node.file ?? ""}`))),
    )?.label ?? "Other";
    const current = buckets.get(label) ?? [];
    current.push(node);
    buckets.set(label, current);
  }

  const clustered: SoftwareGraphNode[] = [];
  const labels = [...ARCHITECTURAL_GROUPS.map((group) => group.label), "Other"].filter((label) => buckets.has(label));
  let index = 0;
  while (clustered.length < ranked.length) {
    let added = false;
    for (const label of labels) {
      const node = buckets.get(label)?.[index];
      if (node) {
        clustered.push(node);
        added = true;
      }
    }
    if (!added) {
      break;
    }
    index += 1;
  }
  return uniqueNodesInOrder(clustered);
}

function limitNodes(
  seeds: readonly SoftwareGraphNode[],
  nodes: readonly SoftwareGraphNode[],
  limit: number,
): readonly SoftwareGraphNode[] {
  const ordered = new Map<string, SoftwareGraphNode>();
  for (const node of seeds) {
    ordered.set(node.id, node);
  }
  for (const node of nodes) {
    ordered.set(node.id, node);
  }
  return [...ordered.values()].slice(0, limit);
}

function suggestedEvidenceCommands(query: string, nodes: readonly SoftwareGraphNode[]): readonly string[] {
  const escaped = query.replaceAll("\"", "\\\"");
  const commands = [
    `ontoly search "${escaped}"`,
    `ontoly evidence "${escaped}"`,
  ];
  const top = nodes[0];
  if (top) {
    commands.push(`ontoly inspect ${top.id}`);
    commands.push(`ontoly impact ${top.id} --mode local`);
    commands.push(`ontoly trace ${top.id} --depth 3`);
  }
  commands.push(`ontoly implementation-plan "${escaped}" --budget 80`);
  return commands;
}

function nextImplementationPlanCommands(
  task: string,
  seeds: readonly SoftwareGraphNode[],
  budget: ExecutionBudget,
  partial: boolean,
): readonly string[] {
  const escaped = task.replaceAll("\"", "\\\"");
  const commands = [
    `ontoly evidence "${escaped}"`,
  ];
  const topSeed = seeds[0];
  if (topSeed) {
    commands.push(`ontoly inspect ${topSeed.id}`);
    commands.push(`ontoly impact ${topSeed.id} --mode local`);
  }
  if (partial) {
    commands.push(
      `ontoly implementation-plan "${escaped}" --max-nodes ${Math.min(250, Math.max(budget.maxNodes + 20, budget.maxNodes * 2))} --max-edges ${Math.min(1000, Math.max(budget.maxEdges + 40, budget.maxEdges * 2))} --max-depth ${budget.maxDepth} --max-evidence ${budget.maxEvidence}`,
    );
  }
  return commands;
}

function isRepositoryLocalNode(node: SoftwareGraphNode): boolean {
  return !isExternalFrameworkNode(node);
}

function isExternalFrameworkNode(node: SoftwareGraphNode): boolean {
  const text = `${node.id} ${node.name} ${node.file ?? ""} ${node.package ?? ""}`;
  return /node_modules|^dep:|^framework:|@nestjs\/|@medplum\/|next\/dist|typescript\/lib|@types\//i.test(text) ||
    node.type === "Dependency" ||
    node.type === "Framework";
}

function nodesFromSearch(context: CapabilityContext, search: SemanticSearchResult): readonly SoftwareGraphNode[] {
  return uniqueNodesInOrder(search.candidates
    .map((candidate) => context.query.findNode(candidate.nodeId))
    .filter(isNode));
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
    nodes: uniqueNodesInOrder(nodes).map(serializeNode),
  };
}

function pathEvidence(description: string, nodes: readonly SoftwareGraphNode[], edges: readonly SoftwareGraphEdge[], fallbackConfidence = 0.9): CapabilityEvidence {
  return {
    kind: "path",
    description,
    confidence: edgeConfidence(edges, fallbackConfidence),
    nodes: uniqueNodesInOrder(nodes).map(serializeNode),
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
  const score = roundScore(Math.max(0, Math.min(1, average(evidence.map((item) => item.confidence)) - penalty)));
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
  const metadata = compactJsonObject(node.metadata);
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    ...(node.file ? { file: node.file } : {}),
    ...(node.package ? { package: node.package } : {}),
    ...(node.span ? { span: serializeSpan(node.span) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function serializeEdge(edge: SoftwareGraphEdge): SerializedEdge {
  return {
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
    ...(edge.evidence ? {
      evidence: edge.evidence.slice(0, SERIALIZED_EDGE_EVIDENCE_LIMIT).map((item) => ({
        kind: item.kind,
        confidence: item.confidence,
        ...(item.description ? { description: truncateSerializedText(item.description, SERIALIZED_EDGE_DESCRIPTION_LIMIT) } : {}),
        ...(item.span ? { span: serializeSpan(item.span) } : {}),
      })),
    } : {}),
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
    message: truncateSerializedText(diagnosticInput.message, SERIALIZED_EDGE_DESCRIPTION_LIMIT),
    ...(diagnosticInput.nodeId ? { nodeId: diagnosticInput.nodeId } : {}),
    ...(diagnosticInput.edgeId ? { edgeId: diagnosticInput.edgeId } : {}),
    ...(diagnosticInput.span ? { span: serializeSpanLike(diagnosticInput.span) } : {}),
  };
}

function compactJsonObject(value: JsonObject | undefined): JsonObject | undefined {
  if (!value) {
    return undefined;
  }
  const compact = compactJsonValue(value, 0, new WeakSet<object>());
  if (!compact || typeof compact !== "object" || Array.isArray(compact)) {
    return undefined;
  }
  return Object.keys(compact).length > 0 ? compact as JsonObject : undefined;
}

function compactJsonValue(value: unknown, depth: number, seen: WeakSet<object>): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return truncateSerializedText(value, SERIALIZED_METADATA_STRING_LIMIT);
  }
  if (depth >= SERIALIZED_METADATA_DEPTH_LIMIT) {
    return "[Object]";
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    return value
      .slice(0, SERIALIZED_METADATA_ARRAY_LIMIT)
      .map((item) => compactJsonValue(item, depth + 1, seen))
      .filter((item): item is JsonValue => item !== undefined);
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, SERIALIZED_METADATA_ENTRY_LIMIT)
        .map(([key, entry]) => [key, compactJsonValue(entry, depth + 1, seen)])
        .filter(([, entry]) => entry !== undefined),
    ) as JsonObject;
  }
  return truncateSerializedText(String(value), SERIALIZED_METADATA_STRING_LIMIT);
}

function truncateSerializedText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...[truncated]` : normalized;
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

function uniqueNodesInOrder(nodes: readonly SoftwareGraphNode[]): readonly SoftwareGraphNode[] {
  return [...new Map(nodes.map((node) => [node.id, node] as const)).values()];
}

function orderedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
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
      mode: { type: "string", enum: Object.keys(IMPACT_MODE_SETTINGS) },
      limit: { type: "number" },
      ...budgetInputProperties(),
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
      ...budgetInputProperties(),
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
      budget: { type: "number" },
      timeoutMs: { type: "number" },
      ...budgetInputProperties(),
    },
    required: ["task"],
  };
}

function evidencePackInput(): JsonObject {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      query: { type: "string" },
      task: { type: "string" },
      depth: { type: "number" },
      limit: { type: "number", minimum: 5, maximum: 20 },
      ...budgetInputProperties(),
    },
  };
}

function budgetInputProperties(): JsonObject {
  return {
    maxTime: { type: "number" },
    maxTimeMs: { type: "number" },
    maxNodes: { type: "number" },
    maxEdges: { type: "number" },
    maxDepth: { type: "number" },
    maxEvidence: { type: "number" },
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

function readImpactMode(input: CapabilityInput): ImpactMode {
  const value = input.mode;
  return isImpactMode(value) ? value : "semantic";
}

function isImpactMode(value: string | undefined): value is ImpactMode {
  return Boolean(value && Object.prototype.hasOwnProperty.call(IMPACT_MODE_SETTINGS, value));
}

function readNumberLimit(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.floor(value)))
    : fallback;
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

function roundScore(value: number): number {
  return Math.round(value * 1_000) / 1_000;
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
