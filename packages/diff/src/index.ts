import {
  stableStringify,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";

export type ModifiedNodeField =
  | "type"
  | "name"
  | "file"
  | "package"
  | "span"
  | "metadata";

export interface ModifiedNode {
  readonly id: string;
  readonly before: SoftwareGraphNode;
  readonly after: SoftwareGraphNode;
  readonly changedFields: readonly ModifiedNodeField[];
}

export interface GraphDiffSummary {
  readonly addedNodeCount: number;
  readonly removedNodeCount: number;
  readonly modifiedNodeCount: number;
  readonly addedEdgeCount: number;
  readonly removedEdgeCount: number;
  readonly unchangedNodeCount: number;
  readonly unchangedEdgeCount: number;
}

export interface GraphDiff {
  readonly baseHash: string;
  readonly headHash: string;
  readonly generatedAt: string;
  readonly addedNodes: readonly SoftwareGraphNode[];
  readonly removedNodes: readonly SoftwareGraphNode[];
  readonly modifiedNodes: readonly ModifiedNode[];
  readonly addedEdges: readonly SoftwareGraphEdge[];
  readonly removedEdges: readonly SoftwareGraphEdge[];
  readonly summary: GraphDiffSummary;
}

const NODE_FIELDS: readonly ModifiedNodeField[] = [
  "file",
  "metadata",
  "name",
  "package",
  "span",
  "type",
];

export function diffSoftwareGraphs(
  base: SoftwareGraph,
  head: SoftwareGraph,
): GraphDiff {
  const baseNodes = indexById(base.nodes);
  const headNodes = indexById(head.nodes);
  const baseEdges = indexById(base.edges);
  const headEdges = indexById(head.edges);

  const addedNodes: SoftwareGraphNode[] = [];
  const removedNodes: SoftwareGraphNode[] = [];
  const modifiedNodes: ModifiedNode[] = [];
  let unchangedNodeCount = 0;

  for (const [id, headNode] of headNodes) {
    const baseNode = baseNodes.get(id);
    if (!baseNode) {
      addedNodes.push(headNode);
      continue;
    }
    const changedFields = diffNodeFields(baseNode, headNode);
    if (changedFields.length === 0) {
      unchangedNodeCount += 1;
      continue;
    }
    modifiedNodes.push({
      id,
      before: baseNode,
      after: headNode,
      changedFields,
    });
  }

  for (const [id, baseNode] of baseNodes) {
    if (!headNodes.has(id)) {
      removedNodes.push(baseNode);
    }
  }

  const addedEdges: SoftwareGraphEdge[] = [];
  const removedEdges: SoftwareGraphEdge[] = [];
  let unchangedEdgeCount = 0;

  for (const [id, headEdge] of headEdges) {
    if (baseEdges.has(id)) {
      unchangedEdgeCount += 1;
    } else {
      addedEdges.push(headEdge);
    }
  }

  for (const [id, baseEdge] of baseEdges) {
    if (!headEdges.has(id)) {
      removedEdges.push(baseEdge);
    }
  }

  sortById(addedNodes);
  sortById(removedNodes);
  modifiedNodes.sort((left, right) => compareStrings(left.id, right.id));
  sortById(addedEdges);
  sortById(removedEdges);

  return {
    baseHash: base.metadata.deterministicHash,
    headHash: head.metadata.deterministicHash,
    generatedAt: new Date().toISOString(),
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdges,
    removedEdges,
    summary: {
      addedNodeCount: addedNodes.length,
      removedNodeCount: removedNodes.length,
      modifiedNodeCount: modifiedNodes.length,
      addedEdgeCount: addedEdges.length,
      removedEdgeCount: removedEdges.length,
      unchangedNodeCount,
      unchangedEdgeCount,
    },
  };
}

function indexById<T extends { readonly id: string }>(
  items: readonly T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
}

function diffNodeFields(
  before: SoftwareGraphNode,
  after: SoftwareGraphNode,
): readonly ModifiedNodeField[] {
  const changed: ModifiedNodeField[] = [];
  for (const field of NODE_FIELDS) {
    const beforeValue = stableStringify(before[field]);
    const afterValue = stableStringify(after[field]);
    if (beforeValue !== afterValue) {
      changed.push(field);
    }
  }
  return changed;
}

function sortById<T extends { readonly id: string }>(items: T[]): void {
  items.sort((left, right) => compareStrings(left.id, right.id));
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
