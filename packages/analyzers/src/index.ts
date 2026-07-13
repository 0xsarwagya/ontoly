import {
  createDiagnosticId,
  type JsonObject,
  type NodeType,
  type RelationshipType,
  type SoftwareGraph,
  type SoftwareGraphDiagnostic,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";

export type SemanticCoverageStatus = "pass" | "warn" | "fail" | "unknown";

export const SEMANTIC_COVERAGE_CATEGORIES = [
  "packages",
  "services",
  "controllers",
  "routes",
  "dependencyInjection",
  "configuration",
  "workspace",
  "openapi",
  "prisma",
] as const;

export type SemanticCoverageCategory = (typeof SEMANTIC_COVERAGE_CATEGORIES)[number];

export interface SemanticCoverageMetric {
  readonly id: SemanticCoverageCategory;
  readonly label: string;
  readonly total: number;
  readonly covered: number;
  readonly coverage: number;
  readonly confidence: number;
  readonly status: SemanticCoverageStatus;
  readonly missingEntities: readonly string[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly recommendations: readonly string[];
  readonly metadata?: JsonObject | undefined;
}

export interface SemanticCoverageSummary {
  readonly coverage: number;
  readonly confidence: number;
  readonly completeness: number;
  readonly consistency: number;
  readonly trustworthiness: number;
}

export interface SemanticCoverageReport {
  readonly repository: string;
  readonly graphHash: string;
  readonly generatedAt: string;
  readonly summary: SemanticCoverageSummary;
  readonly metrics: readonly SemanticCoverageMetric[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly relationshipDistribution: Record<string, number>;
  readonly confidenceHistogram: Record<string, number>;
}

export interface AnalyzerReportOptions {
  readonly generatedAt?: string | undefined;
}

export interface SemanticEntityReport {
  readonly title: string;
  readonly repository: string;
  readonly graphHash: string;
  readonly items: readonly JsonObject[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
}

interface GraphIndexes {
  readonly nodesById: ReadonlyMap<string, SoftwareGraphNode>;
  readonly nodesByType: ReadonlyMap<NodeType, readonly SoftwareGraphNode[]>;
  readonly incomingByNodeId: ReadonlyMap<string, readonly SoftwareGraphEdge[]>;
  readonly outgoingByNodeId: ReadonlyMap<string, readonly SoftwareGraphEdge[]>;
  readonly edgesByType: ReadonlyMap<RelationshipType, readonly SoftwareGraphEdge[]>;
}

export function analyzeSemanticCoverage(
  graph: SoftwareGraph,
  options: AnalyzerReportOptions = {},
): SemanticCoverageReport {
  const indexes = buildIndexes(graph);
  const metrics = [
    analyzePackages(graph, indexes),
    analyzeServices(graph, indexes),
    analyzeControllers(graph, indexes),
    analyzeRoutes(graph, indexes),
    analyzeDependencyInjection(graph, indexes),
    analyzeConfiguration(graph, indexes),
    analyzeWorkspace(graph, indexes),
    analyzeOpenApi(graph, indexes),
    analyzePrisma(graph, indexes),
  ];
  const diagnostics = metrics.flatMap((metric) => metric.diagnostics).sort(compareDiagnostics);
  const coverageMetrics = metrics.filter((metric) => metric.total > 0);
  const coverage = average(coverageMetrics.map((metric) => metric.coverage));
  const confidence = average(coverageMetrics.map((metric) => metric.confidence));
  const consistency = graph.edges.length === 0
    ? 100
    : percentage(
        graph.edges.filter((edge) => indexes.nodesById.has(edge.from) && indexes.nodesById.has(edge.to)).length,
        graph.edges.length,
      );
  const completeness = coverage;
  const trustworthiness = average([coverage, confidence, consistency]);

  return {
    repository: graph.repository.name,
    graphHash: graph.metadata.deterministicHash,
    generatedAt: options.generatedAt ?? graph.metadata.generatedAt,
    summary: {
      coverage,
      confidence,
      completeness,
      consistency,
      trustworthiness,
    },
    metrics,
    diagnostics,
    relationshipDistribution: countBy(graph.edges.map((edge) => edge.type)),
    confidenceHistogram: confidenceHistogram(graph.edges),
  };
}

export function createSemanticEntityReport(
  graph: SoftwareGraph,
  target: "framework" | "controllers" | "routes" | "modules" | "providers",
): SemanticEntityReport {
  const indexes = buildIndexes(graph);
  const coverage = analyzeSemanticCoverage(graph);

  switch (target) {
    case "framework":
      return {
        title: "Framework Report",
        repository: graph.repository.name,
        graphHash: graph.metadata.deterministicHash,
        items: byType(indexes, "Framework").map((node) => ({
          ...serializeNode(node),
          users: incoming(indexes, node.id, ["USES", "REGISTERED_IN", "REGISTERS"])
            .map((edge) => serializeNodeOrEdgeSource(indexes, edge)),
        })),
        diagnostics: coverage.diagnostics,
      };

    case "controllers":
      return {
        title: "Controller Report",
        repository: graph.repository.name,
        graphHash: graph.metadata.deterministicHash,
        items: byType(indexes, "Controller").map((node) => ({
          ...serializeNode(node),
          class: outgoing(indexes, node.id, ["REFERENCES"]).map((edge) => serializeNodeOrEdgeTarget(indexes, edge)),
          routes: outgoing(indexes, node.id, ["MOUNTS", "CONTAINS"]).map((edge) => serializeNodeOrEdgeTarget(indexes, edge)),
          modules: incoming(indexes, node.id, ["DECLARES", "REGISTERS"]).map((edge) => serializeNodeOrEdgeSource(indexes, edge)),
          guards: incoming(indexes, node.id, ["AUTHORIZES"]).map((edge) => serializeNodeOrEdgeSource(indexes, edge)),
        })),
        diagnostics: coverage.diagnostics.filter((diagnostic) => diagnostic.metadata?.category === "controllers"),
      };

    case "routes":
      return {
        title: "Route Report",
        repository: graph.repository.name,
        graphHash: graph.metadata.deterministicHash,
        items: byType(indexes, "Route").map((node) => ({
          ...serializeNode(node),
          method: node.metadata?.method,
          path: node.metadata?.path,
          handlers: outgoing(indexes, node.id, ["HANDLES"]).map((edge) => serializeNodeOrEdgeTarget(indexes, edge)),
          controllers: incoming(indexes, node.id, ["MOUNTS", "CONTAINS", "EXPOSES"])
            .map((edge) => serializeNodeOrEdgeSource(indexes, edge)),
          authorization: incoming(indexes, node.id, ["AUTHORIZES"]).map((edge) => serializeNodeOrEdgeSource(indexes, edge)),
        })),
        diagnostics: coverage.diagnostics.filter((diagnostic) => diagnostic.metadata?.category === "routes"),
      };

    case "modules":
      return {
        title: "Module Report",
        repository: graph.repository.name,
        graphHash: graph.metadata.deterministicHash,
        items: byType(indexes, "Module")
          .filter((node) => node.metadata?.framework === "NestJS" || node.metadata?.moduleKind === "nestjs")
          .map((node) => ({
            ...serializeNode(node),
            imports: outgoing(indexes, node.id, ["IMPORTS"]).map((edge) => serializeNodeOrEdgeTarget(indexes, edge)),
            controllers: outgoing(indexes, node.id, ["DECLARES", "REGISTERS"])
              .map((edge) => serializeNodeOrEdgeTarget(indexes, edge))
              .filter((node) => node.type === "Controller" || node.type === "Class"),
            providers: outgoing(indexes, node.id, ["PROVIDES", "REGISTERS"])
              .map((edge) => serializeNodeOrEdgeTarget(indexes, edge))
              .filter((node) => ["Provider", "Service", "Repository", "Factory", "Class"].includes(String(node.type))),
            exports: outgoing(indexes, node.id, ["EXPORTS"]).map((edge) => serializeNodeOrEdgeTarget(indexes, edge)),
          })),
        diagnostics: coverage.diagnostics.filter((diagnostic) => diagnostic.metadata?.category === "modules"),
      };

    case "providers":
      return {
        title: "Provider Report",
        repository: graph.repository.name,
        graphHash: graph.metadata.deterministicHash,
        items: [...byType(indexes, "Provider"), ...byType(indexes, "Service"), ...byType(indexes, "Repository"), ...byType(indexes, "Factory")]
          .sort(compareNodes)
          .map((node) => ({
            ...serializeNode(node),
            providedBy: incoming(indexes, node.id, ["PROVIDES", "REGISTERS"]).map((edge) => serializeNodeOrEdgeSource(indexes, edge)),
            consumers: incoming(indexes, node.id, ["INJECTS", "USES"]).map((edge) => serializeNodeOrEdgeSource(indexes, edge)),
            implementation: outgoing(indexes, node.id, ["REFERENCES"]).map((edge) => serializeNodeOrEdgeTarget(indexes, edge)),
          })),
        diagnostics: coverage.diagnostics.filter((diagnostic) => diagnostic.metadata?.category === "providers"),
      };
  }
}

export function formatCoverageHuman(report: SemanticCoverageReport): string {
  const rows = report.metrics.map((metric) =>
    `${metric.label.padEnd(22, ".")} ${formatPercentage(metric.coverage)} ${metric.status}`,
  );

  return [
    "Software Graph Coverage",
    "",
    ...rows,
    "",
    `Completeness .......... ${formatPercentage(report.summary.completeness)}`,
    `Consistency ........... ${formatPercentage(report.summary.consistency)}`,
    `Trustworthiness ....... ${formatPercentage(report.summary.trustworthiness)}`,
  ].join("\n");
}

export function formatCoverageMarkdown(report: SemanticCoverageReport): string {
  const lines = [
    "# Software Graph Coverage",
    "",
    `Repository: ${report.repository}`,
    `Graph hash: ${report.graphHash}`,
    "",
    "| Area | Coverage | Confidence | Covered | Total | Status |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...report.metrics.map((metric) =>
      `| ${metric.label} | ${formatPercentage(metric.coverage)} | ${formatPercentage(metric.confidence)} | ${metric.covered} | ${metric.total} | ${metric.status} |`,
    ),
    "",
    "## Summary",
    "",
    `- Completeness: ${formatPercentage(report.summary.completeness)}`,
    `- Consistency: ${formatPercentage(report.summary.consistency)}`,
    `- Trustworthiness: ${formatPercentage(report.summary.trustworthiness)}`,
  ];

  if (report.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", "");

    for (const diagnostic of report.diagnostics) {
      lines.push(`- ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
    }
  }

  return lines.join("\n");
}

function analyzePackages(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const packages = byType(indexes, "Package");
  const dependencyEdges = byEdgeType(indexes, "DEPENDS_ON");
  const missing = dependencyEdges
    .filter((edge) => !indexes.nodesById.has(edge.to))
    .map((edge) => edge.to)
    .sort();

  return metric({
    id: "packages",
    label: "Packages",
    total: packages.length,
    covered: Math.max(0, packages.length - missing.length),
    missingEntities: missing,
    recommendations: missing.length > 0 ? ["Run ontoly doctor and inspect package dependency nodes."] : [],
    metadata: { dependencyEdges: dependencyEdges.length },
  });
}

function analyzeServices(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const services = byType(indexes, "Service");
  const candidateClasses = byType(indexes, "Class").filter((node) => node.name.endsWith("Service"));
  const serviceClassIds = new Set(
    services.flatMap((service) => outgoing(indexes, service.id, ["REFERENCES"]).map((edge) => edge.to)),
  );
  const missing = candidateClasses
    .filter((node) => !serviceClassIds.has(node.id))
    .map((node) => node.id)
    .sort();
  const total = Math.max(services.length, candidateClasses.length);

  return metric({
    id: "services",
    label: "Services",
    total,
    covered: Math.max(0, total - missing.length),
    missingEntities: missing,
    diagnostics: missing.map((id) =>
      diagnostic("SEMANTIC_SERVICE_MISSING_ROLE", "warning", `Class ${id} looks like a service but has no Service node.`, id, "services"),
    ),
    recommendations: missing.length > 0 ? ["Emit Service role nodes for every deterministic service class candidate."] : [],
  });
}

function analyzeControllers(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const controllers = byType(indexes, "Controller");
  const candidateClasses = byType(indexes, "Class").filter((node) => node.name.endsWith("Controller"));
  const controllerClassIds = new Set(
    controllers.flatMap((controller) => outgoing(indexes, controller.id, ["REFERENCES"]).map((edge) => edge.to)),
  );
  const missing = candidateClasses.filter((node) => !controllerClassIds.has(node.id)).map((node) => node.id).sort();
  const duplicateNames = duplicateValues(controllers.map((node) => node.name));
  const withoutModules = controllers
    .filter((controller) => incoming(indexes, controller.id, ["DECLARES", "REGISTERS"]).length === 0)
    .map((node) => node.id)
    .sort();
  const diagnostics = [
    ...missing.map((id) =>
      diagnostic("SEMANTIC_CONTROLLER_MISSING_ROLE", "warning", `Class ${id} looks like a controller but has no Controller node.`, id, "controllers"),
    ),
    ...withoutModules.map((id) =>
      diagnostic("SEMANTIC_CONTROLLER_WITHOUT_MODULE", "warning", `Controller ${id} is not declared by a module.`, id, "controllers"),
    ),
    ...duplicateNames.map((name) =>
      diagnostic("SEMANTIC_DUPLICATE_CONTROLLER", "warning", `Multiple Controller nodes share name ${name}.`, name, "controllers"),
    ),
  ];
  const total = Math.max(controllers.length, candidateClasses.length);

  return metric({
    id: "controllers",
    label: "Controllers",
    total,
    covered: Math.max(0, total - missing.length - withoutModules.length),
    missingEntities: [...missing, ...withoutModules].sort(),
    diagnostics,
    recommendations: diagnostics.length > 0
      ? ["Connect controllers to Nest modules with DECLARES or REGISTERS relationships."]
      : [],
    metadata: { duplicateNames: [...duplicateNames] },
  });
}

function analyzeRoutes(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const routes = byType(indexes, "Route");
  const withoutHandlers = routes
    .filter((route) => outgoing(indexes, route.id, ["HANDLES"]).length === 0)
    .map((node) => node.id)
    .sort();
  const withoutControllers = routes
    .filter((route) => incoming(indexes, route.id, ["MOUNTS", "CONTAINS", "EXPOSES"]).length === 0)
    .map((node) => node.id)
    .sort();
  const duplicateRouteKeys = duplicateValues(routes.map(routeKey));
  const diagnostics = [
    ...withoutHandlers.map((id) =>
      diagnostic("SEMANTIC_ROUTE_WITHOUT_HANDLER", "warning", `Route ${id} has no HANDLES edge.`, id, "routes"),
    ),
    ...withoutControllers.map((id) =>
      diagnostic("SEMANTIC_ROUTE_WITHOUT_CONTROLLER", "warning", `Route ${id} is not mounted by a controller or module.`, id, "routes"),
    ),
    ...duplicateRouteKeys.map((key) =>
      diagnostic("SEMANTIC_DUPLICATE_ROUTE", "warning", `Multiple Route nodes share ${key}.`, key, "routes"),
    ),
  ];

  return metric({
    id: "routes",
    label: "Routes",
    total: routes.length,
    covered: Math.max(0, routes.length - unique([...withoutHandlers, ...withoutControllers]).length),
    missingEntities: unique([...withoutHandlers, ...withoutControllers]),
    diagnostics,
    recommendations: diagnostics.length > 0
      ? ["Routes should have HANDLES edges and a controller/module mounting edge."]
      : [],
    metadata: { duplicateRouteKeys: [...duplicateRouteKeys] },
  });
}

function analyzeDependencyInjection(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const injects = byEdgeType(indexes, "INJECTS");
  const invalidTargets = injects.filter((edge) => {
    const target = indexes.nodesById.get(edge.to);
    return !target || target.type === "Package" || target.metadata?.external === true;
  });

  return metric({
    id: "dependencyInjection",
    label: "Dependency Injection",
    total: injects.length,
    covered: injects.length - invalidTargets.length,
    missingEntities: invalidTargets.map((edge) => edge.to).sort(),
    diagnostics: invalidTargets.map((edge) =>
      diagnostic("SEMANTIC_INVALID_DI_TARGET", "warning", `INJECTS edge ${edge.id} targets ${edge.to}.`, edge.to, "providers"),
    ),
    recommendations: invalidTargets.length > 0
      ? ["Normalize DI targets to Provider, Service, Repository, Factory, or concrete Class nodes."]
      : [],
    metadata: { invalidTargets: invalidTargets.length },
  });
}

function analyzeConfiguration(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const nodes = [...byType(indexes, "Configuration"), ...byType(indexes, "EnvironmentVariable")].sort(compareNodes);
  const covered = nodes.filter((node) =>
    adjacent(indexes, node.id, ["CONFIGURES", "READS", "WRITES"]).length > 0
  );
  const missing = nodes.filter((node) => !covered.includes(node)).map((node) => node.id).sort();

  return metric({
    id: "configuration",
    label: "Configuration",
    total: nodes.length,
    covered: covered.length,
    missingEntities: missing,
    diagnostics: missing.map((id) =>
      diagnostic("SEMANTIC_CONFIGURATION_UNCONNECTED", "info", `Configuration node ${id} has no usage edge.`, id, "configuration"),
    ),
    recommendations: missing.length > 0 ? ["Connect configuration nodes to READS, WRITES, or CONFIGURES relationships."] : [],
  });
}

function analyzeWorkspace(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const workspaces = byType(indexes, "Workspace");
  const packages = byType(indexes, "Package");
  const connected = workspaces.filter((workspace) => outgoing(indexes, workspace.id, ["CONTAINS"]).length > 0);
  const total = workspaces.length > 0 ? workspaces.length : packages.length;
  const covered = workspaces.length > 0 ? connected.length : packages.length > 0 ? packages.length : 0;

  return metric({
    id: "workspace",
    label: "Workspace",
    total,
    covered,
    missingEntities: workspaces.filter((workspace) => !connected.includes(workspace)).map((node) => node.id).sort(),
    recommendations: workspaces.length === 0 && packages.length > 0 ? ["Emit a Workspace node for package topology."] : [],
  });
}

function analyzeOpenApi(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const openApiNodes = [...byType(indexes, "Operation"), ...byType(indexes, "Resource")]
    .filter((node) => node.metadata?.source === "openapi" || node.metadata?.frontend === "openapi");

  return metric({
    id: "openapi",
    label: "OpenAPI",
    total: openApiNodes.length,
    covered: openApiNodes.length,
    missingEntities: [],
    recommendations: openApiNodes.length === 0 ? ["Add OpenAPI documents to source inventory when API contracts exist."] : [],
  });
}

function analyzePrisma(_graph: SoftwareGraph, indexes: GraphIndexes): SemanticCoverageMetric {
  const tables = byType(indexes, "DatabaseTable");

  return metric({
    id: "prisma",
    label: "Prisma",
    total: tables.length,
    covered: tables.length,
    missingEntities: [],
    recommendations: tables.length === 0 ? ["Add a Prisma frontend before relying on database model coverage."] : [],
  });
}

function metric(input: {
  readonly id: SemanticCoverageCategory;
  readonly label: string;
  readonly total: number;
  readonly covered: number;
  readonly missingEntities: readonly string[];
  readonly diagnostics?: readonly SoftwareGraphDiagnostic[] | undefined;
  readonly recommendations: readonly string[];
  readonly metadata?: JsonObject | undefined;
}): SemanticCoverageMetric {
  const coverage = percentage(input.covered, input.total);
  const confidence = input.total === 0 ? 0 : Math.max(0, coverage - Math.min(20, input.missingEntities.length * 2));

  return withOptionalProperties({
    id: input.id,
    label: input.label,
    total: input.total,
    covered: Math.max(0, Math.min(input.total, input.covered)),
    coverage,
    confidence,
    status: statusForMetric(input.total, coverage),
    missingEntities: [...input.missingEntities].sort(),
    diagnostics: [...(input.diagnostics ?? [])].sort(compareDiagnostics),
    recommendations: [...input.recommendations].sort(),
  }, {
    metadata: input.metadata,
  });
}

function diagnostic(
  code: string,
  severity: SoftwareGraphDiagnostic["severity"],
  message: string,
  location: string,
  category: string,
): SoftwareGraphDiagnostic {
  return {
    id: createDiagnosticId(code, message, location),
    code,
    severity,
    message,
    metadata: {
      category,
      analyzer: "@0xsarwagya/ontoly-analyzers",
    },
  };
}

function buildIndexes(graph: SoftwareGraph): GraphIndexes {
  const nodesById = new Map<string, SoftwareGraphNode>();
  const nodesByType = new Map<NodeType, SoftwareGraphNode[]>();
  const incomingByNodeId = new Map<string, SoftwareGraphEdge[]>();
  const outgoingByNodeId = new Map<string, SoftwareGraphEdge[]>();
  const edgesByType = new Map<RelationshipType, SoftwareGraphEdge[]>();

  for (const node of graph.nodes) {
    nodesById.set(node.id, node);
    push(nodesByType, node.type, node);
  }

  for (const edge of graph.edges) {
    push(edgesByType, edge.type, edge);
    push(incomingByNodeId, edge.to, edge);
    push(outgoingByNodeId, edge.from, edge);
  }

  return {
    nodesById,
    nodesByType: sortMapValues(nodesByType, compareNodes),
    incomingByNodeId: sortMapValues(incomingByNodeId, compareEdges),
    outgoingByNodeId: sortMapValues(outgoingByNodeId, compareEdges),
    edgesByType: sortMapValues(edgesByType, compareEdges),
  };
}

function byType(indexes: GraphIndexes, type: NodeType): readonly SoftwareGraphNode[] {
  return indexes.nodesByType.get(type) ?? [];
}

function byEdgeType(indexes: GraphIndexes, type: RelationshipType): readonly SoftwareGraphEdge[] {
  return indexes.edgesByType.get(type) ?? [];
}

function outgoing(
  indexes: GraphIndexes,
  nodeId: string,
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphEdge[] {
  return filterEdges(indexes.outgoingByNodeId.get(nodeId) ?? [], relationships);
}

function incoming(
  indexes: GraphIndexes,
  nodeId: string,
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphEdge[] {
  return filterEdges(indexes.incomingByNodeId.get(nodeId) ?? [], relationships);
}

function adjacent(
  indexes: GraphIndexes,
  nodeId: string,
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphEdge[] {
  return [...incoming(indexes, nodeId, relationships), ...outgoing(indexes, nodeId, relationships)].sort(compareEdges);
}

function filterEdges(
  edges: readonly SoftwareGraphEdge[],
  relationships?: readonly RelationshipType[],
): readonly SoftwareGraphEdge[] {
  const relationshipSet = relationships ? new Set(relationships) : undefined;
  return edges.filter((edge) => !relationshipSet || relationshipSet.has(edge.type)).sort(compareEdges);
}

function serializeNode(node: SoftwareGraphNode): JsonObject {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    file: node.file,
    metadata: node.metadata,
  };
}

function serializeNodeOrEdgeTarget(indexes: GraphIndexes, edge: SoftwareGraphEdge): JsonObject {
  return serializeNodeOrMissing(indexes, edge.to);
}

function serializeNodeOrEdgeSource(indexes: GraphIndexes, edge: SoftwareGraphEdge): JsonObject {
  return serializeNodeOrMissing(indexes, edge.from);
}

function serializeNodeOrMissing(indexes: GraphIndexes, id: string): JsonObject {
  const node = indexes.nodesById.get(id);
  return node ? serializeNode(node) : { id, missing: true };
}

function routeKey(node: SoftwareGraphNode): string {
  const method = typeof node.metadata?.method === "string" ? node.metadata.method : node.name.split(":")[0] ?? "";
  const path = typeof node.metadata?.path === "string" ? node.metadata.path : node.name.split(":").slice(1).join(":");
  return `${method}:${path}`;
}

function confidenceHistogram(edges: readonly SoftwareGraphEdge[]): Record<string, number> {
  const histogram: Record<string, number> = {
    exact: 0,
    inferred: 0,
    low: 0,
    unknown: 0,
  };

  for (const edge of edges) {
    if (!edge.evidence || edge.evidence.length === 0) {
      histogram.unknown = (histogram.unknown ?? 0) + 1;
      continue;
    }

    for (const evidence of edge.evidence) {
      histogram[evidence.confidence] = (histogram[evidence.confidence] ?? 0) + 1;
    }
  }

  return histogram;
}

function percentage(covered: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((covered / total) * 100);
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function statusForMetric(total: number, coverage: number): SemanticCoverageStatus {
  if (total === 0) {
    return "unknown";
  }

  if (coverage >= 95) {
    return "pass";
  }

  if (coverage >= 60) {
    return "warn";
  }

  return "fail";
}

function formatPercentage(value: number): string {
  return `${value}%`;
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
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

function compareNodes(left: SoftwareGraphNode, right: SoftwareGraphNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function compareDiagnostics(left: SoftwareGraphDiagnostic, right: SoftwareGraphDiagnostic): number {
  return left.id.localeCompare(right.id);
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as T & O;
}
