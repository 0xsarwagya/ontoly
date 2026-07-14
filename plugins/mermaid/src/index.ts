import type { OntolyPlugin, PluginArtifact, RelationshipType, SoftwareGraph } from "@0xsarwagya/ontoly-core";

export interface MermaidOptions {
  readonly title?: string | undefined;
  readonly relationships?: readonly RelationshipType[] | undefined;
  readonly maxEdges?: number | undefined;
}

export function createMermaidDiagram(graph: SoftwareGraph, options: MermaidOptions = {}): string {
  const relationshipSet = options.relationships ? new Set(options.relationships) : undefined;
  const edges = graph.edges
    .filter((edge) => !relationshipSet || relationshipSet.has(edge.type))
    .slice(0, options.maxEdges ?? 250);
  const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
  const lines = ["flowchart LR"];

  if (options.title) {
    lines.push(`  %% ${options.title}`);
  }

  for (const node of nodes) {
    lines.push(`  ${mermaidId(node.id)}["${escapeLabel(`${node.type}: ${node.name}`)}"]`);
  }

  for (const edge of edges) {
    lines.push(`  ${mermaidId(edge.from)} -->|${edge.type}| ${mermaidId(edge.to)}`);
  }

  return `${lines.join("\n")}\n`;
}

export function createMermaidArtifact(
  graph: SoftwareGraph,
  options: MermaidOptions = {},
): PluginArtifact {
  return {
    path: "graph.mmd",
    mediaType: "text/vnd.mermaid",
    contents: createMermaidDiagram(graph, options),
  };
}

export function createMermaidPlugin(options: MermaidOptions = {}): OntolyPlugin {
  return {
    name: "@0xsarwagya/ontoly-plugin-mermaid",
    version: "0.1.0-alpha.13",
    run: ({ graph }) => ({
      artifacts: [createMermaidArtifact(graph, options)],
    }),
  };
}

function mermaidId(id: string): string {
  return `n_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"');
}
