import { describe, expect, it } from "vitest";
import { createEdgeId, createNodeId, createSoftwareGraph, stableStringify } from "../src/index";

describe("software graph core", () => {
  it("creates stable IDs and deterministic graph hashes", () => {
    const functionId = createNodeId({ type: "Function", file: "src/login.ts", name: "login" });
    const modelId = createNodeId({ type: "Model", name: "User" });
    const edgeId = createEdgeId("RETURNS", functionId, modelId);

    const graph = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: modelId, type: "Model", name: "User" },
        { id: functionId, type: "Function", name: "login", file: "src/login.ts" },
      ],
      edges: [{ id: edgeId, type: "RETURNS", from: functionId, to: modelId }],
      fileCount: 1,
    });

    const graphAgain = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        { id: functionId, type: "Function", name: "login", file: "src/login.ts" },
        { id: modelId, type: "Model", name: "User" },
      ],
      edges: [{ id: edgeId, type: "RETURNS", from: functionId, to: modelId }],
      fileCount: 1,
    });

    expect(functionId).toBe("fn:src/login.ts:login");
    expect(createNodeId({ type: "Import", file: "src/login.ts", name: "./auth" })).toBe(
      "import:src/login.ts:./auth",
    );
    expect(createNodeId({ type: "Export", file: "src/login.ts", name: "login" })).toBe(
      "export:src/login.ts:login",
    );
    expect(graph.metadata.deterministicHash).toBe(graphAgain.metadata.deterministicHash);
    expect(graph.nodes.map((node) => node.id)).toEqual([functionId, modelId].sort());
  });

  it("serializes like the previous stableStringify, edge cases included", () => {
    // The implementation before key orders were cached per shape; graph and index hashes depend on its output.
    const previous = (value: unknown): string => {
      if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
      }
      if (Array.isArray(value)) {
        return `[${value.map((item) => previous(item)).join(",")}]`;
      }
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
      return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${previous(entryValue)}`).join(",")}}`;
    };
    const sparse: unknown[] = [1];
    sparse[3] = "x";
    const samples: unknown[] = [
      { b: 1, a: [undefined, () => 1, Symbol("s"), null, -0, Number.NaN], c: undefined, "a\u0000b": 2 },
      { a: 1, b: { y: [sparse], x: "\u2028\"" }, B: true, _: "", "10": 0, "2": 0, ä: 1, z: () => 1 },
      [{ a: 1, b: 2 }, { b: 2, a: 1 }, { a: 1 }, { "a\u0000b": 1 }, new Date(0)],
      "text",
      7,
    ];
    for (const sample of samples) {
      expect(stableStringify(sample)).toBe(previous(sample));
      expect(stableStringify(sample)).toBe(previous(sample));
    }
  });
});
