import { describe, expect, it } from "vitest";
import { createEdgeId, createNodeId, createSoftwareGraph } from "../src/index";

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
});
