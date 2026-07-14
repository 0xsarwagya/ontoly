import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  analyzeSemanticCoverage,
  type SemanticCoverageReport,
} from "@0xsarwagya/ontoly-analyzers";
import {
  stableHash,
  type NodeType,
  type RelationshipType,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import { createSemanticIndex } from "@0xsarwagya/ontoly-semantic-index";
import { createInteractiveHtmlGraph } from "@0xsarwagya/ontoly-plugin-html";
import { createQueryEngine } from "@0xsarwagya/ontoly-query";
import { serializeTypeScriptProject, type TypeScriptProject } from "@0xsarwagya/ontoly-typescript";

export interface OntolyOutputBundleOptions {
  readonly root: string;
  readonly directory?: string | undefined;
  readonly graph: SoftwareGraph;
  readonly semanticModel?: TypeScriptProject | undefined;
  readonly source?: OntolyOutputSource | undefined;
  readonly includeHtml?: boolean | undefined;
  readonly maxHtmlNodes?: number | undefined;
  readonly maxHtmlEdges?: number | undefined;
}

export interface OntolyOutputSource {
  readonly kind: "local" | "remote";
  readonly remote?: string | undefined;
}

export interface OntolyOutputBundle {
  readonly directory: string;
  readonly files: readonly string[];
  readonly manifest: OutputBundleManifest;
  readonly communities: readonly GraphCommunitySummary[];
}

export interface OutputBundleManifest {
  readonly version: "1.0.0";
  readonly repository: {
    readonly name: string;
    readonly root: string;
    readonly source: "local" | "remote";
    readonly remote?: string | undefined;
    readonly packageName?: string | undefined;
    readonly packageManager?: string | undefined;
  };
  readonly graph: {
    readonly version: string;
    readonly hash: string;
    readonly generatedAt: string;
    readonly files: number;
    readonly nodes: number;
    readonly edges: number;
    readonly diagnostics: number;
  };
  readonly artifacts: Record<string, readonly string[]>;
  readonly files: readonly string[];
}

export interface GraphCommunitySummary {
  readonly id: string;
  readonly stableId: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodeTypes: Record<string, number>;
  readonly relationshipTypes: Record<string, number>;
  readonly representativeNodes: readonly Pick<SoftwareGraphNode, "id" | "type" | "name" | "file">[];
}

interface GraphCommunityDetail extends GraphCommunitySummary {
  readonly nodes: readonly SoftwareGraphNode[];
  readonly edges: readonly SoftwareGraphEdge[];
}

export async function createOntolyOutputBundle(
  options: OntolyOutputBundleOptions,
): Promise<OntolyOutputBundle> {
  const root = resolve(options.root);
  const directory = resolveOutputDirectory(root, options.directory ?? "ontoly-output");
  const graph = options.graph;
  const query = createQueryEngine(graph);
  const semanticIndex = createSemanticIndex(graph);
  const coverage = analyzeSemanticCoverage(graph);
  const communityDetails = detectGraphCommunities(graph);
  const communities = communityDetails.map(({ nodes: _nodes, edges: _edges, ...summary }) => summary);
  const files: string[] = [];

  const writeJson = async (path: string, value: unknown): Promise<void> => {
    await writeBundleFile(directory, path, `${JSON.stringify(value, null, 2)}\n`);
    files.push(path);
  };
  const writeText = async (path: string, value: string): Promise<void> => {
    await writeBundleFile(directory, path, value.endsWith("\n") ? value : `${value}\n`);
    files.push(path);
  };

  await writeJson("SoftwareGraph.json", graph);
  await writeJson("graph.json", graph);
  await writeJson("diagnostics.json", graph.diagnostics);
  await writeJson("metadata.json", graph.metadata);
  await writeJson("indexes.json", graph.indexes);
  await writeJson("index.json", semanticIndex);
  await writeJson("statistics.json", query.stats());
  await writeJson("coverage.json", coverage);
  await writeJson("quality.json", createQualityReport(coverage));

  if (options.semanticModel) {
    await writeJson("semantic-model.json", JSON.parse(serializeTypeScriptProject(options.semanticModel)));
  }

  await writeJson("reports/architecture.json", architectureReport(graph));
  await writeJson("reports/api.json", apiReport(graph));
  await writeJson("reports/dependencies.json", dependencyReport(graph));
  await writeJson("reports/configuration.json", configurationReport(graph));
  await writeJson("reports/frameworks.json", frameworkReport(graph));
  await writeJson("reports/workspace.json", workspaceReport(graph));

  await writeJson("nodes/all.json", graph.nodes);
  for (const [type, nodes] of groupNodesByType(graph.nodes)) {
    await writeJson(`nodes/by-type/${kebabCase(type)}.json`, nodes);
  }

  await writeJson("relationships/all.json", graph.edges);
  for (const [type, edges] of groupEdgesByType(graph.edges)) {
    await writeJson(`relationships/by-type/${kebabCase(type)}.json`, edges);
  }

  await writeJson("communities/communities.json", communities);
  for (const [index, community] of communityDetails.entries()) {
    await writeJson(`communities/community-${String(index).padStart(3, "0")}.json`, {
      id: community.id,
      stableId: community.stableId,
      nodeCount: community.nodeCount,
      edgeCount: community.edgeCount,
      nodeTypes: community.nodeTypes,
      relationshipTypes: community.relationshipTypes,
      representativeNodes: community.representativeNodes,
      representativeNodeIds: community.representativeNodes.map((node) => node.id).sort(),
      nodes: community.nodes,
      edges: community.edges,
    });
  }

  if (options.includeHtml !== false) {
    await writeText("html/graph.html", createInteractiveHtmlGraph(graph, {
      title: `${graph.repository.name} Software Graph Explorer`,
      maxNodes: options.maxHtmlNodes ?? 2500,
      maxEdges: options.maxHtmlEdges ?? 5000,
    }));
    await writeText("html/architecture.html", createInteractiveHtmlGraph(architectureGraph(graph), {
      title: `${graph.repository.name} Architecture Graph`,
      maxNodes: options.maxHtmlNodes ?? 1200,
      maxEdges: options.maxHtmlEdges ?? 2400,
      includeIsolatedNodes: false,
    }));
  }

  const manifest = createManifest(graph, files, options.source);
  await writeJson("manifest.json", manifest);

  return {
    directory,
    files: [...files].sort(),
    manifest,
    communities,
  };
}

function resolveOutputDirectory(root: string, directory: string): string {
  return isAbsolute(directory) ? directory : join(root, directory);
}

async function writeBundleFile(root: string, path: string, contents: string): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
}

function createManifest(
  graph: SoftwareGraph,
  files: readonly string[],
  source?: OntolyOutputSource | undefined,
): OutputBundleManifest {
  const allFiles = [...files, "manifest.json"].sort();
  return {
    version: "1.0.0",
    repository: {
      name: graph.repository.name,
      root: graph.repository.root,
      source: source?.kind ?? "local",
      remote: source?.remote,
      packageName: graph.repository.packageName,
      packageManager: graph.repository.packageManager,
    },
    graph: {
      version: graph.version,
      hash: graph.metadata.deterministicHash,
      generatedAt: graph.metadata.generatedAt,
      files: graph.metadata.fileCount,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      diagnostics: graph.diagnostics.length,
    },
    artifacts: {
      canonical: [
        "SoftwareGraph.json",
        "graph.json",
        "diagnostics.json",
        "metadata.json",
        "indexes.json",
        "index.json",
        "statistics.json",
      ],
      semantic: ["index.json", "semantic-model.json", "coverage.json", "quality.json"].filter((file) => allFiles.includes(file)),
      reports: allFiles.filter((file) => file.startsWith("reports/")),
      nodes: allFiles.filter((file) => file.startsWith("nodes/")),
      relationships: allFiles.filter((file) => file.startsWith("relationships/")),
      communities: allFiles.filter((file) => file.startsWith("communities/")),
      html: allFiles.filter((file) => file.startsWith("html/")),
    },
    files: allFiles,
  };
}

function createQualityReport(report: SemanticCoverageReport): Record<string, unknown> {
  return {
    repository: report.repository,
    graphHash: report.graphHash,
    summary: report.summary,
    diagnostics: report.diagnostics,
    relationshipDistribution: report.relationshipDistribution,
    confidenceHistogram: report.confidenceHistogram,
  };
}

function architectureReport(graph: SoftwareGraph): Record<string, unknown> {
  return {
    repository: graph.repository.name,
    graphHash: graph.metadata.deterministicHash,
    statistics: createQueryEngine(graph).stats(),
    frameworks: graph.nodes.filter((node) => node.type === "Framework"),
    packages: graph.nodes.filter((node) => node.type === "Package"),
    modules: graph.nodes.filter((node) => node.type === "Module"),
    controllers: graph.nodes.filter((node) => node.type === "Controller"),
    services: graph.nodes.filter((node) => node.type === "Service"),
    repositories: graph.nodes.filter((node) => node.type === "Repository"),
    routes: graph.nodes.filter((node) => node.type === "Route"),
    configuration: graph.nodes.filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable"),
  };
}

function apiReport(graph: SoftwareGraph): Record<string, unknown> {
  const apiNodeTypes = new Set<NodeType>(["Route", "Operation", "Controller", "Middleware", "Guard", "Permission"]);
  const apiRelationshipTypes = new Set<RelationshipType>(["HANDLES", "MOUNTS", "AUTHORIZES", "USES", "CALLS", "CONTAINS"]);
  return {
    nodes: graph.nodes.filter((node) => apiNodeTypes.has(node.type)),
    edges: graph.edges.filter((edge) => apiRelationshipTypes.has(edge.type)),
  };
}

function dependencyReport(graph: SoftwareGraph): Record<string, unknown> {
  const query = createQueryEngine(graph);
  const relationshipTypes = new Set<RelationshipType>(["DEPENDS_ON", "IMPORTS", "USES", "INJECTS", "PROVIDES"]);
  return {
    packages: graph.nodes.filter((node) => node.type === "Package"),
    modules: graph.nodes.filter((node) => node.type === "Module"),
    services: graph.nodes.filter((node) => node.type === "Service" || node.type === "Provider" || node.type === "Repository"),
    edges: graph.edges.filter((edge) => relationshipTypes.has(edge.type)),
    cycles: query.detectCycles(["DEPENDS_ON", "IMPORTS"]).map((cycle) => [...cycle]),
  };
}

function configurationReport(graph: SoftwareGraph): Record<string, unknown> {
  const nodeTypes = new Set<NodeType>(["Configuration", "EnvironmentVariable", "BuildTarget"]);
  const relationshipTypes = new Set<RelationshipType>(["CONFIGURES", "READS", "WRITES", "USES"]);
  return {
    nodes: graph.nodes.filter((node) => nodeTypes.has(node.type)),
    edges: graph.edges.filter((edge) => relationshipTypes.has(edge.type)),
  };
}

function frameworkReport(graph: SoftwareGraph): Record<string, unknown> {
  const frameworkIds = new Set(graph.nodes.filter((node) => node.type === "Framework").map((node) => node.id));
  return {
    frameworks: graph.nodes.filter((node) => node.type === "Framework"),
    edges: graph.edges.filter((edge) => frameworkIds.has(edge.from) || frameworkIds.has(edge.to)),
  };
}

function workspaceReport(graph: SoftwareGraph): Record<string, unknown> {
  const nodeTypes = new Set<NodeType>(["Workspace", "Application", "Package", "Module", "Script", "Task", "Pipeline", "Workflow", "Job", "Step"]);
  return {
    nodes: graph.nodes.filter((node) => nodeTypes.has(node.type)),
    edges: graph.edges.filter((edge) => edge.type === "CONTAINS" || edge.type === "EXECUTES" || edge.type === "DEPENDS_ON"),
  };
}

function architectureGraph(graph: SoftwareGraph): SoftwareGraph {
  const relevantTypes = new Set<NodeType>([
    "Workspace",
    "Application",
    "Package",
    "Framework",
    "Module",
    "Controller",
    "Provider",
    "Service",
    "Repository",
    "Route",
    "Middleware",
    "Guard",
    "Configuration",
    "EnvironmentVariable",
    "DatabaseTable",
  ]);
  const nodes = graph.nodes.filter((node) => relevantTypes.has(node.type));
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
  };
}

function groupNodesByType(nodes: readonly SoftwareGraphNode[]): readonly (readonly [NodeType, readonly SoftwareGraphNode[]])[] {
  const groups = new Map<NodeType, SoftwareGraphNode[]>();
  for (const node of nodes) {
    groups.set(node.type, [...(groups.get(node.type) ?? []), node]);
  }
  return [...groups.entries()]
    .map(([type, values]) => [type, values.sort(compareNodes)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

function groupEdgesByType(edges: readonly SoftwareGraphEdge[]): readonly (readonly [RelationshipType, readonly SoftwareGraphEdge[]])[] {
  const groups = new Map<RelationshipType, SoftwareGraphEdge[]>();
  for (const edge of edges) {
    groups.set(edge.type, [...(groups.get(edge.type) ?? []), edge]);
  }
  return [...groups.entries()]
    .map(([type, values]) => [type, values.sort(compareEdges)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

function detectGraphCommunities(graph: SoftwareGraph): readonly GraphCommunityDetail[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const adjacency = new Map<string, Set<string>>();
  const degree = new Map<string, number>();

  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
    degree.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      continue;
    }
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  const visited = new Set<string>();
  const components: { readonly nodes: readonly SoftwareGraphNode[]; readonly edges: readonly SoftwareGraphEdge[] }[] = [];

  for (const start of graph.nodes.map((node) => node.id).sort()) {
    if (visited.has(start)) {
      continue;
    }

    const stack = [start];
    const nodeIds = new Set<string>();
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      nodeIds.add(current);

      for (const next of [...(adjacency.get(current) ?? [])].sort().reverse()) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    const componentNodes = graph.nodes.filter((node) => nodeIds.has(node.id));
    const componentEdges = graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    components.push({ nodes: componentNodes, edges: componentEdges });
  }

  return components
    .sort((left, right) => right.nodes.length - left.nodes.length || left.nodes[0]?.id.localeCompare(right.nodes[0]?.id ?? "") || 0)
    .map((component, index): GraphCommunityDetail => {
      const nodeIds = component.nodes.map((node) => node.id).sort();
      const representativeNodes = [...component.nodes]
        .sort((left, right) => (degree.get(right.id) ?? 0) - (degree.get(left.id) ?? 0) || left.id.localeCompare(right.id))
        .slice(0, 10)
        .map((node) => ({
          id: node.id,
          type: node.type,
          name: node.name,
          file: node.file,
        }));

      return {
        id: `community-${String(index).padStart(3, "0")}`,
        stableId: `community:${stableHash(nodeIds.join("|"))}`,
        nodeCount: component.nodes.length,
        edgeCount: component.edges.length,
        nodeTypes: countBy(component.nodes.map((node) => node.type)),
        relationshipTypes: countBy(component.edges.map((edge) => edge.type)),
        representativeNodes,
        nodes: component.nodes,
        edges: component.edges,
      };
    });
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function compareNodes(left: SoftwareGraphNode, right: SoftwareGraphNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}
