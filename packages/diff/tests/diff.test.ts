import { describe, expect, it } from "vitest";
import {
  createEdgeId,
  createSoftwareGraph,
  type RelationshipType,
  type SoftwareGraph,
} from "@0xsarwagya/ontoly-core";
import { diffSoftwareGraphs } from "../src/index";

describe("diffSoftwareGraphs", () => {
  it("reports an empty diff for identical graphs", () => {
    const graph = baselineGraph();
    const diff = diffSoftwareGraphs(graph, graph);

    expect(diff.addedNodes).toEqual([]);
    expect(diff.removedNodes).toEqual([]);
    expect(diff.modifiedNodes).toEqual([]);
    expect(diff.addedEdges).toEqual([]);
    expect(diff.removedEdges).toEqual([]);
    expect(diff.summary.unchangedNodeCount).toBe(graph.nodes.length);
    expect(diff.summary.unchangedEdgeCount).toBe(graph.edges.length);
    expect(diff.baseHash).toBe(graph.metadata.deterministicHash);
    expect(diff.headHash).toBe(graph.metadata.deterministicHash);
  });

  it("reports added and removed nodes by id", () => {
    const base = baselineGraph();
    const head = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
        { id: "mod:src/service.ts", type: "Module", name: "src/service.ts", file: "src/service.ts" },
        { id: "fn:src/index.ts:next", type: "Function", name: "next", file: "src/index.ts" },
      ],
      edges: [],
      fileCount: 2,
    });

    const diff = diffSoftwareGraphs(base, head);

    expect(diff.addedNodes.map((node) => node.id)).toEqual(["fn:src/index.ts:next"]);
    expect(diff.removedNodes.map((node) => node.id)).toEqual(["fn:src/index.ts:main"]);
    expect(diff.summary.addedNodeCount).toBe(1);
    expect(diff.summary.removedNodeCount).toBe(1);
  });

  it("reports modified nodes with per-field changes", () => {
    const base = baselineGraph();
    const head = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
        { id: "mod:src/service.ts", type: "Module", name: "src/service.ts", file: "src/service.ts" },
        {
          id: "fn:src/index.ts:main",
          type: "Function",
          name: "main",
          file: "src/index.ts",
          metadata: { visibility: "public" },
        },
      ],
      edges: base.edges,
      fileCount: 2,
    });

    const diff = diffSoftwareGraphs(base, head);

    expect(diff.modifiedNodes).toHaveLength(1);
    expect(diff.modifiedNodes[0]?.id).toBe("fn:src/index.ts:main");
    expect(diff.modifiedNodes[0]?.changedFields).toEqual(["metadata"]);
    expect(diff.addedNodes).toEqual([]);
    expect(diff.removedNodes).toEqual([]);
    expect(diff.addedEdges).toEqual([]);
    expect(diff.removedEdges).toEqual([]);
  });

  it("reports added and removed edges when the from/to/type triple changes", () => {
    const base = baselineGraph();
    const head = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: base.nodes,
      edges: [
        edge("IMPORTS", "mod:src/index.ts", "mod:src/service.ts"),
      ],
      fileCount: 1,
    });

    const diff = diffSoftwareGraphs(base, head);

    expect(diff.addedEdges.map((item) => item.type)).toEqual(["IMPORTS"]);
    expect(diff.removedEdges.map((item) => item.type)).toEqual(["CALLS"]);
  });

  it("sorts every output array by id for deterministic output", () => {
    const base = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: "fn:src/a.ts:one", type: "Function", name: "one", file: "src/a.ts" },
      ],
      edges: [],
      fileCount: 1,
    });
    const head = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: "fn:src/a.ts:one", type: "Function", name: "one", file: "src/a.ts" },
        { id: "fn:src/z.ts:zeta", type: "Function", name: "zeta", file: "src/z.ts" },
        { id: "fn:src/b.ts:beta", type: "Function", name: "beta", file: "src/b.ts" },
        { id: "fn:src/a.ts:alpha", type: "Function", name: "alpha", file: "src/a.ts" },
      ],
      edges: [],
      fileCount: 3,
    });

    const diff = diffSoftwareGraphs(base, head);

    expect(diff.addedNodes.map((node) => node.id)).toEqual([
      "fn:src/a.ts:alpha",
      "fn:src/b.ts:beta",
      "fn:src/z.ts:zeta",
    ]);
  });

  it("produces identical output on repeated invocations", () => {
    const base = baselineGraph();
    const head = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
        { id: "fn:src/index.ts:next", type: "Function", name: "next", file: "src/index.ts" },
      ],
      edges: [],
      fileCount: 1,
    });

    const first = diffSoftwareGraphs(base, head);
    const second = diffSoftwareGraphs(base, head);

    expect(withoutTimestamp(first)).toEqual(withoutTimestamp(second));
  });

  it("copies deterministicHash from both input graphs", () => {
    const base = baselineGraph();
    const head = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
      ],
      edges: [],
      fileCount: 1,
    });

    const diff = diffSoftwareGraphs(base, head);

    expect(diff.baseHash).toBe(base.metadata.deterministicHash);
    expect(diff.headHash).toBe(head.metadata.deterministicHash);
    expect(diff.baseHash).not.toBe(diff.headHash);
  });

  it("lists changedFields lexicographically", () => {
    const base = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        {
          id: "fn:src/a.ts:main",
          type: "Function",
          name: "main",
          file: "src/a.ts",
          package: "@repo/pkg-one",
          metadata: { visibility: "public" },
        },
      ],
      edges: [],
      fileCount: 1,
    });
    const head = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        {
          id: "fn:src/a.ts:main",
          type: "Function",
          name: "main",
          file: "src/a.ts",
          package: "@repo/pkg-two",
          metadata: { visibility: "internal" },
        },
      ],
      edges: [],
      fileCount: 1,
    });

    const diff = diffSoftwareGraphs(base, head);

    expect(diff.modifiedNodes[0]?.changedFields).toEqual(["metadata", "package"]);
  });
});

function baselineGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
      { id: "mod:src/service.ts", type: "Module", name: "src/service.ts", file: "src/service.ts" },
      { id: "fn:src/index.ts:main", type: "Function", name: "main", file: "src/index.ts" },
    ],
    edges: [
      edge("CALLS", "fn:src/index.ts:main", "mod:src/service.ts"),
    ],
    fileCount: 2,
  });
}

function edge(type: RelationshipType, from: string, to: string) {
  return {
    id: createEdgeId(type, from, to),
    type,
    from,
    to,
  };
}

function withoutTimestamp(diff: ReturnType<typeof diffSoftwareGraphs>) {
  const { generatedAt: _generatedAt, ...rest } = diff;
  return rest;
}
