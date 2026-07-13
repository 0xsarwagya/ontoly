import {
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  SOFTWARE_GRAPH_VERSION,
  type SoftwareGraph,
} from "@0xsarwagya/ontoly-core";
import type { CompilerContext, GraphValidationHook, GraphValidationIssue, GraphValidationResult } from "../types";

export const coreGraphValidationHook: GraphValidationHook = {
  id: "@0xsarwagya/ontoly-compiler:core-graph-validation",
  validate: (graph) => validateCoreGraph(graph),
};

export async function validateGraph(
  graph: SoftwareGraph,
  context: CompilerContext,
  hooks: readonly GraphValidationHook[] = [],
): Promise<GraphValidationResult> {
  const results = await Promise.all([coreGraphValidationHook, ...hooks].map((hook) => hook.validate(graph, context)));
  const issues = results.flatMap((result) => result.issues).sort(compareIssues);

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

export function validateCoreGraph(graph: SoftwareGraph): GraphValidationResult {
  const issues: GraphValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const edgeFingerprints = new Set<string>();
  const nodeTypes = new Set<string>(NODE_TYPES);
  const relationshipTypes = new Set<string>(RELATIONSHIP_TYPES);

  if (graph.version !== SOFTWARE_GRAPH_VERSION) {
    issues.push(error("UNSUPPORTED_GRAPH_VERSION", `Unsupported graph version ${graph.version}.`));
  }

  if (!graph.metadata || typeof graph.metadata.deterministicHash !== "string") {
    issues.push(error("MISSING_GRAPH_METADATA", "Graph metadata is missing a deterministic hash."));
  }

  if (!graph.repository?.root || !graph.repository.name) {
    issues.push(error("MISSING_REPOSITORY_METADATA", "Graph repository metadata must include root and name."));
  }

  for (const node of graph.nodes) {
    if (!nodeTypes.has(node.type)) {
      issues.push(error("INVALID_NODE_KIND", `Node ${node.id} has invalid kind ${node.type}.`));
    }

    if (nodeIds.has(node.id)) {
      issues.push(error("DUPLICATE_NODE_ID", `Duplicate node id ${node.id}.`));
    }

    nodeIds.add(node.id);
  }

  for (const edge of graph.edges) {
    if (!relationshipTypes.has(edge.type)) {
      issues.push(error("INVALID_RELATIONSHIP_KIND", `Edge ${edge.id} has invalid relationship ${edge.type}.`));
    }

    if (edgeIds.has(edge.id)) {
      issues.push(error("DUPLICATE_EDGE_ID", `Duplicate edge id ${edge.id}.`));
    }

    edgeIds.add(edge.id);

    const fingerprint = `${edge.type}|${edge.from}|${edge.to}`;

    if (edgeFingerprints.has(fingerprint)) {
      issues.push(warning("DUPLICATE_RELATIONSHIP", `Duplicate ${edge.type} relationship from ${edge.from} to ${edge.to}.`));
    }

    edgeFingerprints.add(fingerprint);

    if (!nodeIds.has(edge.from)) {
      issues.push(error("MISSING_EDGE_SOURCE", `Edge ${edge.id} references missing source node ${edge.from}.`));
    }

    if (!nodeIds.has(edge.to)) {
      issues.push(error("MISSING_EDGE_TARGET", `Edge ${edge.id} references missing target node ${edge.to}.`));
    }

    if (edge.from === edge.to && edge.type !== "REFERENCES") {
      issues.push(warning("SELF_RELATIONSHIP", `Edge ${edge.id} creates a ${edge.type} relationship from a node to itself.`));
    }

    if (isSemanticRelationship(edge.type) && (!edge.evidence || edge.evidence.length === 0)) {
      issues.push(warning("MISSING_RELATIONSHIP_PROVENANCE", `Semantic edge ${edge.id} is missing evidence.`));
    }
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const incoming = groupEdgesByNode(graph.edges, "to");
  const outgoing = groupEdgesByNode(graph.edges, "from");

  for (const route of graph.nodes.filter((node) => node.type === "Route")) {
    if (!hasOutgoing(outgoing, route.id, "HANDLES")) {
      issues.push(warning("ROUTE_MISSING_HANDLES", `Route ${route.id} has no HANDLES edge.`));
    }

    if (!hasIncoming(incoming, route.id, ["MOUNTS", "CONTAINS", "EXPOSES"])) {
      issues.push(warning("ROUTE_MISSING_CONTROLLER", `Route ${route.id} is not mounted by a controller or module.`));
    }
  }

  for (const controller of graph.nodes.filter((node) => node.type === "Controller")) {
    if (!hasIncoming(incoming, controller.id, ["DECLARES", "REGISTERS"])) {
      issues.push(warning("CONTROLLER_MISSING_MODULE", `Controller ${controller.id} is not declared by a module.`));
    }
  }

  for (const provider of graph.nodes.filter((node) => ["Provider", "Service", "Repository", "Factory"].includes(node.type))) {
    if (!hasIncoming(incoming, provider.id, ["INJECTS", "USES"]) && !hasOutgoing(outgoing, provider.id, ["REFERENCES"])) {
      issues.push(warning("PROVIDER_WITHOUT_CONSUMERS", `Provider ${provider.id} has no graph-visible consumers.`));
    }
  }

  for (const inject of graph.edges.filter((edge) => edge.type === "INJECTS")) {
    const target = nodesById.get(inject.to);

    if (!target || target.type === "Package" || target.metadata?.external === true) {
      issues.push(warning("INVALID_DI_TARGET", `INJECTS edge ${inject.id} targets ${inject.to}.`));
    }
  }

  for (const duplicate of duplicateRouteKeys(graph)) {
    issues.push(warning("DUPLICATE_ROUTE", `Multiple routes share ${duplicate}.`));
  }

  for (const duplicate of duplicateNodeNames(graph, "Controller")) {
    issues.push(warning("DUPLICATE_CONTROLLER", `Multiple controllers share name ${duplicate}.`));
  }

  if (graph.metadata.nodeCount !== graph.nodes.length) {
    issues.push(error("NODE_COUNT_MISMATCH", "Graph metadata node count does not match node array."));
  }

  if (graph.metadata.edgeCount !== graph.edges.length) {
    issues.push(error("EDGE_COUNT_MISMATCH", "Graph metadata edge count does not match edge array."));
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues: issues.sort(compareIssues),
  };
}

function error(code: string, message: string): GraphValidationIssue {
  return {
    code,
    message,
    severity: "error",
  };
}

function warning(code: string, message: string): GraphValidationIssue {
  return {
    code,
    message,
    severity: "warning",
  };
}

function isSemanticRelationship(type: string): boolean {
  return !["CONTAINS", "IMPORTS", "EXPORTS", "CALLS"].includes(type);
}

function groupEdgesByNode(
  edges: readonly { readonly from: string; readonly to: string; readonly type: string }[],
  key: "from" | "to",
): ReadonlyMap<string, readonly (typeof edges)[number][]> {
  const grouped = new Map<string, (typeof edges)[number][]>();

  for (const edge of edges) {
    const values = grouped.get(edge[key]) ?? [];
    values.push(edge);
    grouped.set(edge[key], values);
  }

  return grouped;
}

function hasIncoming(
  grouped: ReadonlyMap<string, readonly { readonly type: string }[]>,
  nodeId: string,
  types: string | readonly string[],
): boolean {
  return hasEdge(grouped, nodeId, types);
}

function hasOutgoing(
  grouped: ReadonlyMap<string, readonly { readonly type: string }[]>,
  nodeId: string,
  types: string | readonly string[],
): boolean {
  return hasEdge(grouped, nodeId, types);
}

function hasEdge(
  grouped: ReadonlyMap<string, readonly { readonly type: string }[]>,
  nodeId: string,
  types: string | readonly string[],
): boolean {
  const typeSet = new Set(Array.isArray(types) ? types : [types]);
  return (grouped.get(nodeId) ?? []).some((edge) => typeSet.has(edge.type));
}

function duplicateRouteKeys(graph: SoftwareGraph): readonly string[] {
  return duplicateValues(graph.nodes
    .filter((node) => node.type === "Route")
    .map((node) => {
      const method = typeof node.metadata?.method === "string" ? node.metadata.method : node.name.split(":")[0] ?? "";
      const path = typeof node.metadata?.path === "string" ? node.metadata.path : node.name.split(":").slice(1).join(":");
      return `${method}:${path}`;
    }));
}

function duplicateNodeNames(graph: SoftwareGraph, type: string): readonly string[] {
  return duplicateValues(graph.nodes.filter((node) => node.type === type).map((node) => node.name));
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

function compareIssues(left: GraphValidationIssue, right: GraphValidationIssue): number {
  const codeComparison = left.code.localeCompare(right.code);

  if (codeComparison !== 0) {
    return codeComparison;
  }

  return left.message.localeCompare(right.message);
}
