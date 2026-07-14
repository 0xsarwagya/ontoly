import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEdgeId, createSoftwareGraph, type JsonValue } from "@0xsarwagya/ontoly-core";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_DESCRIPTORS,
  artifactDescriptor,
  artifactRequirement,
  createArtifact,
  createDefaultEnhancerContext,
  createEnhancerExecutionPlan,
  createEnhancerTestHarness,
  createMemoryEnhancerCache,
  defineEnhancer,
  discoverEnhancerManifests,
  runEnhancerPipeline,
  validateEnhancerManifest,
  visualizeEnhancerPipeline,
} from "../src/index";

const graph = createSoftwareGraph({
  repository: {
    root: "/repo",
    name: "enhancer-fixture",
    packageName: "enhancer-fixture",
  },
  fileCount: 1,
  nodes: [
    { id: "workspace:enhancer-fixture", type: "Workspace", name: "enhancer-fixture" },
    { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
  ],
  edges: [
    {
      id: createEdgeId("CONTAINS", "workspace:enhancer-fixture", "mod:src/index.ts"),
      type: "CONTAINS",
      from: "workspace:enhancer-fixture",
      to: "mod:src/index.ts",
    },
  ],
});

const fixtureDescriptor = artifactDescriptor({
  id: "FixtureReport",
  kind: "Custom",
  name: "Fixture Report",
  version: "1.0.0",
  description: "Fixture report.",
});

describe("enhancer API", () => {
  it("runs deterministic graph artifact transformations", async () => {
    const enhancer = defineEnhancer({
      id: "fixture-report",
      name: "Fixture Report",
      description: "Create a tiny deterministic report.",
      version: "1.0.0",
      produces: [fixtureDescriptor],
      supportsIncremental: true,
      run: (context) => ({
        artifacts: [
          createArtifact({
            descriptor: fixtureDescriptor,
            data: {
              repository: context.graph.repository.name,
              nodes: context.graph.nodes.length,
              edges: context.graph.edges.length,
            },
            graphHash: context.graph.metadata.deterministicHash,
            graphGeneratedAt: context.graph.metadata.generatedAt,
            producedBy: "fixture-report",
            enhancerVersion: "1.0.0",
            dependencies: [context.artifacts.require("SoftwareGraph")],
          }),
        ],
      }),
    });
    const harness = createEnhancerTestHarness({ graph });

    const result = await harness.run([enhancer]);

    expect(result.executions).toHaveLength(1);
    expect(result.executions[0]?.status).toBe("executed");
    expect(result.artifacts.map((artifact) => artifact.descriptor.id)).toContain("FixtureReport");
    await expect(harness.assertDeterministic([enhancer])).resolves.toBeUndefined();
  });

  it("uses declared artifacts to create a stable execution plan", () => {
    const first = defineEnhancer({
      id: "semantic-index",
      name: "Semantic Index",
      description: "Create semantic index.",
      version: "1.0.0",
      produces: [ARTIFACT_DESCRIPTORS.SemanticIndex],
      run: (context) => ({
        artifacts: [
          createArtifact({
            descriptor: ARTIFACT_DESCRIPTORS.SemanticIndex,
            data: { graphHash: context.graph.metadata.deterministicHash },
            graphHash: context.graph.metadata.deterministicHash,
            producedBy: "semantic-index",
            dependencies: [context.artifacts.require("SoftwareGraph")],
          }),
        ],
      }),
    });
    const second = defineEnhancer({
      id: "docs",
      name: "Docs",
      description: "Create docs.",
      version: "1.0.0",
      requires: [artifactRequirement("SoftwareGraph"), artifactRequirement("SemanticIndex")],
      produces: [ARTIFACT_DESCRIPTORS.MarkdownDocs],
      run: (context) => ({
        artifacts: [
          createArtifact({
            descriptor: ARTIFACT_DESCRIPTORS.MarkdownDocs,
            data: "# Fixture" as JsonValue,
            graphHash: context.graph.metadata.deterministicHash,
            producedBy: "docs",
            dependencies: [context.artifacts.require("SoftwareGraph"), context.artifacts.require("SemanticIndex")],
          }),
        ],
      }),
    });
    const context = createDefaultEnhancerContext({ graph });
    const plan = createEnhancerExecutionPlan([second, first], context.artifacts);

    expect(plan.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(plan.levels.map((level) => level.map((enhancer) => enhancer.id))).toEqual([
      ["semantic-index"],
      ["docs"],
    ]);
  });

  it("caches incremental enhancer output by graph and artifact hash", async () => {
    let runs = 0;
    const enhancer = defineEnhancer({
      id: "cached-report",
      name: "Cached Report",
      description: "Create cached report.",
      version: "1.0.0",
      produces: [fixtureDescriptor],
      supportsIncremental: true,
      run: (context) => {
        runs += 1;
        return {
          artifacts: [
            createArtifact({
              descriptor: fixtureDescriptor,
              data: { runs },
              graphHash: context.graph.metadata.deterministicHash,
              producedBy: "cached-report",
              dependencies: [context.artifacts.require("SoftwareGraph")],
            }),
          ],
        };
      },
    });
    const cache = createMemoryEnhancerCache();
    const firstContext = createDefaultEnhancerContext({ graph, cache });
    const secondContext = createDefaultEnhancerContext({ graph, cache });

    await runEnhancerPipeline({ enhancers: [enhancer], context: firstContext });
    const second = await runEnhancerPipeline({ enhancers: [enhancer], context: secondContext });

    expect(runs).toBe(1);
    expect(second.executions[0]?.status).toBe("cached");
  });

  it("renders enhancer pipeline DAGs", () => {
    const enhancer = defineEnhancer({
      id: "semantic-index",
      name: "Semantic Index",
      description: "Create semantic index.",
      version: "1.0.0",
      produces: [ARTIFACT_DESCRIPTORS.SemanticIndex],
      run: () => ({ artifacts: [] }),
    });

    expect(visualizeEnhancerPipeline([enhancer], "mermaid")).toContain("flowchart LR");
    expect(visualizeEnhancerPipeline([enhancer], "dot")).toContain("digraph EnhancerPipeline");
    expect(JSON.parse(visualizeEnhancerPipeline([enhancer], "json"))).toMatchObject({
      levels: [["semantic-index"]],
    });
  });

  it("validates and discovers enhancer manifests", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-enhancer-manifest-"));
    const manifest = defineEnhancer({
      id: "manifest-fixture",
      name: "Manifest Fixture",
      description: "Manifest fixture.",
      version: "1.0.0",
      produces: [fixtureDescriptor],
      run: () => ({ artifacts: [] }),
    }).manifest();
    await writeFile(join(root, "enhancer.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    expect(validateEnhancerManifest(manifest)).toHaveLength(0);
    const discovered = await discoverEnhancerManifests({
      root,
      searchPaths: [root],
    });

    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.manifest.id).toBe("manifest-fixture");
    expect(discovered[0]?.issues).toHaveLength(0);
  });
});
