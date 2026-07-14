import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEdgeId, createSemanticIndex, createSoftwareGraph, stableHash, stableStringify, type JsonObject, type JsonValue, type SoftwareGraphNode } from "@0xsarwagya/ontoly-core";
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
  it("models evidence packs as first-class enhancer artifacts", () => {
    expect(ARTIFACT_DESCRIPTORS.EvidencePack).toMatchObject({
      id: "EvidencePack",
      kind: "EvidencePack",
      name: "Evidence Pack",
    });
  });

  it("hashes artifacts with stable chunked JSON semantics", () => {
    const data = {
      alpha: "semantic-index",
      nested: Array.from({ length: 25 }, (_, index) => ({ index, value: `entry-${index}` })),
    };
    const artifact = createArtifact({
      descriptor: fixtureDescriptor,
      data: data as unknown as JsonValue,
      graphHash: "graph-hash",
    });
    const expectedHash = stableHash(stableStringify({
      descriptor: fixtureDescriptor,
      data,
      graphHash: "graph-hash",
      dependencies: [],
      provenance: {
        source: "SoftwareGraph",
        graphHash: "graph-hash",
        inputArtifactHashes: {},
      },
    }));

    expect(artifact.hash).toBe(expectedHash);
  });

  it("keeps preloaded graph and semantic-index dependency artifacts as compact references", () => {
    const nodes: SoftwareGraphNode[] = Array.from({ length: 250 }, (_, index) => ({
      id: `node:${index}`,
      type: index === 0 ? "Workspace" : "Service",
      name: `Service${index}`,
      file: `src/service-${index}.ts`,
      metadata: { documentation: "large metadata ".repeat(100) },
    }));
    const largeGraph = createSoftwareGraph({
      repository: {
        root: "/repo",
        name: "large-enhancer-fixture",
      },
      nodes,
      edges: nodes.slice(1).map((item, index) => ({
        id: createEdgeId("CONTAINS", nodes[0]!.id, item.id),
        type: "CONTAINS",
        from: nodes[0]!.id,
        to: item.id,
      })),
      fileCount: nodes.length,
    });
    const semanticIndex = createSemanticIndex(largeGraph);
    const context = createDefaultEnhancerContext({ graph: largeGraph, semanticIndex });
    const graphArtifact = context.artifacts.require<JsonObject>("SoftwareGraph");
    const semanticArtifact = context.artifacts.require<JsonObject>("SemanticIndex");

    expect(graphArtifact.data).toMatchObject({
      artifact: "SoftwareGraph",
      graphHash: largeGraph.metadata.deterministicHash,
      statistics: {
        nodes: 250,
        edges: 249,
      },
    });
    expect((graphArtifact.data as Record<string, unknown>).nodes).toBeUndefined();
    expect((graphArtifact.data as Record<string, unknown>).edges).toBeUndefined();
    expect(semanticArtifact.data).toMatchObject({
      artifact: "SemanticIndex",
      graphHash: largeGraph.metadata.deterministicHash,
      deterministicHash: semanticIndex.metadata.deterministicHash,
      statistics: {
        entries: 250,
      },
    });
    expect((semanticArtifact.data as Record<string, unknown>).entries).toBeUndefined();
    expect((semanticArtifact.data as Record<string, unknown>).invertedIndex).toBeUndefined();
  });

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
