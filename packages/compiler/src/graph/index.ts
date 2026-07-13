import {
  createEdgeId,
  createSoftwareGraph,
  type JsonObject,
  type SoftwareGraph,
  type SoftwareGraphDiagnostic,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import type {
  CompilerGraphBuilder,
  CompilerRelationship,
  CompilerSymbol,
  GraphBuildInput,
} from "../types";

export function createCompilerGraphBuilder(): CompilerGraphBuilder {
  const nodes = new Map<string, SoftwareGraphNode>();
  const edges = new Map<string, SoftwareGraphEdge>();
  const diagnostics = new Map<string, SoftwareGraphDiagnostic>();

  return {
    addNode: (node) => {
      nodes.set(node.id, node);
    },
    addSymbol: (symbol) => {
      const node = nodeFromCompilerSymbol(symbol);
      nodes.set(node.id, node);
    },
    addEdge: (edge) => {
      edges.set(edge.id, edge);
    },
    addRelationship: (relationship) => {
      const edge = edgeFromCompilerRelationship(relationship);
      edges.set(edge.id, edge);
    },
    addDiagnostic: (diagnostic) => {
      diagnostics.set(diagnostic.id, diagnostic);
    },
    build: (input) => buildGraph(input, nodes, edges, diagnostics),
  };
}

export function edgeFromCompilerRelationship(
  relationship: CompilerRelationship,
): SoftwareGraphEdge {
  const base: SoftwareGraphEdge = {
    id: relationship.id ?? createEdgeId(relationship.type, relationship.from, relationship.to),
    type: relationship.type,
    from: relationship.from,
    to: relationship.to,
  };

  return withOptionalProperties(base, {
    evidence: relationship.evidence,
    metadata: relationship.metadata,
  });
}

export function nodeFromCompilerSymbol(symbol: CompilerSymbol): SoftwareGraphNode {
  const base: SoftwareGraphNode = {
    id: symbol.id,
    type: symbol.kind,
    name: symbol.name,
  };
  const metadata = symbolMetadata(symbol);

  return withOptionalProperties(base, {
    file: symbol.file,
    span: symbol.span,
    metadata,
  });
}

function buildGraph(
  input: GraphBuildInput,
  nodes: ReadonlyMap<string, SoftwareGraphNode>,
  edges: ReadonlyMap<string, SoftwareGraphEdge>,
  diagnostics: ReadonlyMap<string, SoftwareGraphDiagnostic>,
): SoftwareGraph {
  return createSoftwareGraph({
    repository: input.repository,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    diagnostics: [...diagnostics.values()],
    fileCount: input.fileCount,
    parserVersions: input.parserVersions ?? {},
    durationMs: input.durationMs,
  });
}

function symbolMetadata(symbol: CompilerSymbol): JsonObject | undefined {
  const metadata = withOptionalProperties<JsonObject, JsonObject>(
    {},
    {
      language: symbol.language,
      provenance: symbol.provenance
        ? withOptionalProperties<JsonObject, JsonObject>(
            {},
            {
              passId: symbol.provenance.passId,
              parser: symbol.provenance.parser,
              parserVersion: symbol.provenance.parserVersion,
              source: symbol.provenance.source,
            },
          )
        : undefined,
    },
  );
  const merged = {
    ...metadata,
    ...(symbol.metadata ?? {}),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as T & O;
}
