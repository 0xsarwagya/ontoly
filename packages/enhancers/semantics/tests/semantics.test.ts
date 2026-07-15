import { createEdgeId, createSemanticIndex, createSoftwareGraph, stableStringify, type SoftwareGraph } from "@0xsarwagya/ontoly-core";
import { createDefaultEnhancerContext, createEnhancerTestHarness } from "@0xsarwagya/ontoly-enhancer";
import { describe, expect, it } from "vitest";
import {
  createSemanticsArtifact,
  createSemanticsEnhancer,
  validateSemanticsArtifact,
} from "../src/index";

describe("semantics enhancer", () => {
  it("generates deterministic feature ownership and graphify-style semantic graph data", () => {
    const graph = semanticFixtureGraph();
    const index = createSemanticIndex(graph);
    const first = createSemanticsArtifact(graph, index);
    const second = createSemanticsArtifact(graph, index);

    expect(first.deterministicHash).toBe(second.deterministicHash);
    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(first.graphHash).toBe(graph.metadata.deterministicHash);
    expect(first.neighborhoods).toHaveLength(graph.nodes.length);
    expect(first.featureOwnership.length).toBeGreaterThan(0);
    expect(first.featureOwnership.some((feature) => feature.owners.some((owner) => owner.name.includes("Threshold")))).toBe(true);
    expect(first.domainVocabulary.some((term) => term.term === "sleep")).toBe(true);
    expect(first.intentVocabulary.some((intent) => intent.intent.includes("sleep"))).toBe(true);
    expect(first.semanticGraph.nodes.some((node) => node.kind === "Feature")).toBe(true);
    expect(first.semanticGraph.links.some((link) => link.type === "OWNS")).toBe(true);
    expect(validateSemanticsArtifact(first, graph)).toEqual([]);
  });

  it("runs as a deterministic enhancer over immutable graph artifacts", async () => {
    const graph = semanticFixtureGraph();
    const semanticIndex = createSemanticIndex(graph);
    const enhancer = createSemanticsEnhancer();
    const harness = createEnhancerTestHarness({ graph, semanticIndex });

    const result = await harness.run([enhancer]);
    const artifact = result.artifacts.find((item) => item.descriptor.id === "Semantics");

    expect(artifact?.descriptor.kind).toBe("Semantics");
    expect(result.executions[0]?.statistics).toMatchObject({
      features: expect.any(Number),
      semanticGraphNodes: expect.any(Number),
    });
    await expect(harness.assertDeterministic([enhancer])).resolves.toBeUndefined();
  });

  it("validates graph hash compatibility", () => {
    const graph = semanticFixtureGraph();
    const context = createDefaultEnhancerContext({ graph });
    const artifact = createSemanticsArtifact(graph, createSemanticIndex(graph));
    const mutated = {
      ...artifact,
      graphHash: "different",
    };

    expect(context.graph.metadata.deterministicHash).toBe(graph.metadata.deterministicHash);
    expect(validateSemanticsArtifact(mutated, graph).map((issue) => issue.code)).toContain("SEMANTICS_GRAPH_HASH_MISMATCH");
  });
});

function semanticFixtureGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "semantic-fixture",
      packageName: "semantic-fixture",
    },
    fileCount: 4,
    nodes: [
      { id: "workspace:semantic-fixture", type: "Workspace", name: "semantic-fixture" },
      { id: "mod:src/carehub/threshold.ts", type: "Module", name: "src/carehub/threshold.ts", file: "src/carehub/threshold.ts" },
      { id: "svc:CarehubPatientThresholdService", type: "Service", name: "CarehubPatientThresholdService", file: "src/carehub/threshold.service.ts" },
      { id: "fn:calculateSleepDurationAverages", type: "Function", name: "calculateSleepDurationAverages", file: "src/carehub/sleep.ts" },
      { id: "dto:PatientThresholdDto", type: "TypeAlias", name: "PatientThresholdDto", file: "src/carehub/threshold.dto.ts" },
      { id: "fn:buildCarehubDeviceAlertsRedisKey", type: "Function", name: "buildCarehubDeviceAlertsRedisKey", file: "src/carehub/redis.ts" },
      { id: "fn:writeAlertStateToRedis", type: "Function", name: "writeAlertStateToRedis", file: "src/carehub/redis.ts" },
    ],
    edges: [
      edge("CONTAINS", "workspace:semantic-fixture", "mod:src/carehub/threshold.ts"),
      edge("CONTAINS", "mod:src/carehub/threshold.ts", "svc:CarehubPatientThresholdService"),
      edge("CONTAINS", "mod:src/carehub/threshold.ts", "fn:calculateSleepDurationAverages"),
      edge("USES", "svc:CarehubPatientThresholdService", "dto:PatientThresholdDto"),
      edge("CALLS", "svc:CarehubPatientThresholdService", "fn:calculateSleepDurationAverages"),
      edge("CALLS", "fn:writeAlertStateToRedis", "fn:buildCarehubDeviceAlertsRedisKey"),
    ],
  });
}

function edge(type: "CONTAINS" | "USES" | "CALLS", from: string, to: string) {
  return {
    id: createEdgeId(type, from, to),
    type,
    from,
    to,
    evidence: [{ kind: "semantic" as const, confidence: "exact" as const, description: "fixture edge" }],
  };
}
