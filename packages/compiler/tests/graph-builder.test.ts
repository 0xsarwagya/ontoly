import { describe, expect, it } from "vitest";
import { createEdgeId, createNodeId } from "@0xsarwagya/ontoly-core";
import { createCompilerGraphBuilder } from "../src/index";

describe("compiler graph builder", () => {
  it("builds a deterministic graph from staged facts", () => {
    const builder = createCompilerGraphBuilder();
    const moduleId = createNodeId({ type: "Module", name: "src/index.ts" });
    const functionId = createNodeId({ type: "Function", file: "src/index.ts", name: "main" });

    builder.addNode({ id: moduleId, type: "Module", name: "src/index.ts" });
    builder.addNode({ id: functionId, type: "Function", name: "main", file: "src/index.ts" });
    builder.addEdge({
      id: createEdgeId("CONTAINS", moduleId, functionId),
      type: "CONTAINS",
      from: moduleId,
      to: functionId,
    });

    const graph = builder.build({
      repository: { root: "/repo", name: "repo" },
      fileCount: 1,
    });

    expect(graph.nodes.map((node) => node.id)).toEqual([functionId, moduleId].sort());
    expect(graph.edges).toHaveLength(1);
    expect(graph.metadata.fileCount).toBe(1);
  });

  it("lowers compiler symbols into graph nodes", () => {
    const builder = createCompilerGraphBuilder();
    const functionId = createNodeId({ type: "Function", file: "src/index.ts", name: "main" });

    builder.addSymbol({
      id: functionId,
      kind: "Function",
      name: "main",
      file: "src/index.ts",
      language: "typescript",
      span: {
        file: "src/index.ts",
        startLine: 1,
        startColumn: 1,
        endLine: 3,
        endColumn: 2,
      },
      metadata: {
        exported: true,
      },
      provenance: {
        parser: "typescript",
        parserVersion: "test",
      },
    });

    const graph = builder.build({
      repository: { root: "/repo", name: "repo" },
      fileCount: 1,
      parserVersions: { typescript: "test" },
    });

    expect(graph.nodes).toEqual([
      expect.objectContaining({
        id: functionId,
        type: "Function",
        metadata: expect.objectContaining({
          exported: true,
          language: "typescript",
          provenance: expect.objectContaining({
            parser: "typescript",
          }),
        }),
      }),
    ]);
    expect(graph.metadata.parserVersions.typescript).toBe("test");
  });
});
