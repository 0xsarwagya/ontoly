import { describe, expect, it } from "vitest";
import { createSoftwareGraph, type SoftwareGraph } from "@0xsarwagya/ontoly-core";
import { validateCoreGraph } from "../src/index";

describe("graph validation", () => {
  it("accepts an empty graph", () => {
    const graph = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [],
      edges: [],
      diagnostics: [],
      fileCount: 0,
    });

    expect(validateCoreGraph(graph).ok).toBe(true);
  });

  it("rejects edges with missing endpoints", () => {
    const graph = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [],
      edges: [{ id: "edge:calls:test", type: "CALLS", from: "fn:a", to: "fn:b" }],
      diagnostics: [],
      fileCount: 0,
    });

    const result = validateCoreGraph(graph);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "MISSING_EDGE_SOURCE",
      "MISSING_EDGE_TARGET",
    ]);
  });

  it("rejects malformed graph schema values loaded from JSON", () => {
    const graph = {
      ...createSoftwareGraph({
        repository: { root: "/repo", name: "repo" },
        nodes: [{ id: "weird:node", type: "Weird", name: "node" }],
        edges: [{ id: "edge:weird", type: "WEIRD", from: "weird:node", to: "weird:node" }],
        diagnostics: [],
        fileCount: 1,
      } as never),
      version: "999.0.0",
    } as SoftwareGraph;

    const result = validateCoreGraph(graph);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "INVALID_NODE_KIND",
      "INVALID_RELATIONSHIP_KIND",
      "MISSING_RELATIONSHIP_PROVENANCE",
      "SELF_RELATIONSHIP",
      "UNSUPPORTED_GRAPH_VERSION",
    ]);
  });
});
