import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeId } from "@0xsarwagya/ontoly-core";
import { buildSoftwareGraphWithArtifacts, COMPILER_STAGE_IDS } from "../src/index";

describe("compiler pipeline", () => {
  it("executes the default empty pipeline and writes a valid empty graph", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-pipeline-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", packageManager: "pnpm@10.15.1" }, null, 2),
      "utf8",
    );
    await writeFile(join(root, "src", "index.ts"), "export const value = 1;\n", "utf8");

    const result = await buildSoftwareGraphWithArtifacts({ root, write: true });

    expect(result.status).toBe("success");
    expect(result.stages).toEqual(COMPILER_STAGE_IDS);
    expect(result.graph?.nodes).toEqual([]);
    expect(result.graph?.edges).toEqual([]);
    expect(result.graph?.diagnostics).toEqual([]);
    expect(result.graph?.metadata.fileCount).toBe(2);
    expect(result.artifacts?.graph).toBe(join(root, ".ontoly", "SoftwareGraph.json"));

    const persisted = JSON.parse(await readFile(join(root, ".ontoly", "SoftwareGraph.json"), "utf8")) as {
      readonly nodes: readonly unknown[];
      readonly edges: readonly unknown[];
    };
    expect(persisted.nodes).toEqual([]);
    expect(persisted.edges).toEqual([]);
    expect(await readFile(join(root, ".ontoly", "graph.json"), "utf8")).toBe(
      await readFile(join(root, ".ontoly", "SoftwareGraph.json"), "utf8"),
    );
  });

  it("constructs graph facts emitted by compiler passes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-pass-products-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
    const nodeId = createNodeId({ type: "Module", name: "virtual:module" });

    const result = await buildSoftwareGraphWithArtifacts({
      root,
      passes: [
        {
          id: "test:virtual-module",
          kind: "semantic",
          stage: "core-compiler-passes",
          semantic: true,
          run: () => ({
            nodes: [{ id: nodeId, type: "Module", name: "virtual:module" }],
          }),
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.graph?.nodes.map((node) => node.id)).toEqual([nodeId]);
  });

  it("runs graph validation hooks and fails invalid builds", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-validation-hook-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");

    const result = await buildSoftwareGraphWithArtifacts({
      root,
      validationHooks: [
        {
          id: "test:reject-empty-graph",
          validate: () => ({
            ok: false,
            issues: [
              {
                code: "EMPTY_GRAPH_REJECTED",
                severity: "error",
                message: "The validation hook rejected the empty graph.",
              },
            ],
          }),
        },
      ],
    });

    expect(result.status).toBe("failed");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "GRAPH_VALIDATION_EMPTY_GRAPH_REJECTED",
    );
  });
});
