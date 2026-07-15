import { createEdgeId, createSemanticIndex, createSoftwareGraph, type SoftwareGraph } from "@0xsarwagya/ontoly-core";
import { createSemanticsArtifact } from "@0xsarwagya/ontoly-enhancer-semantics";
import { describe, expect, it } from "vitest";
import { createIntelligence } from "../src/index";

describe("intelligence", () => {
  it("expands natural-language queries with semantics-derived vocabulary", () => {
    const graph = intelligenceFixtureGraph();
    const semanticIndex = createSemanticIndex(graph);
    const semantics = createSemanticsArtifact(graph, semanticIndex);
    const intelligence = createIntelligence(graph, { semanticIndex, semantics });

    const expansion = intelligence.expand("sleep duration thresholds");

    expect(expansion.expandedTerms).toEqual(expect.arrayContaining(["sleep", "threshold", "thresholds"]));
    expect(expansion.matchedFeatures.length).toBeGreaterThan(0);
    expect(expansion.candidates.map((candidate) => candidate.name)).toContain("calculateSleepDurationAverages");
  });

  it("builds bounded evidence packs from semantic neighborhoods", () => {
    const graph = intelligenceFixtureGraph();
    const semanticIndex = createSemanticIndex(graph);
    const semantics = createSemanticsArtifact(graph, semanticIndex);
    const intelligence = createIntelligence(graph, { semanticIndex, semantics });

    const evidence = intelligence.evidence("redis cache device alerts", {
      nodeLimit: 6,
      linkLimit: 10,
      fileLimit: 3,
    });

    expect(evidence.status).not.toBe("NOT_FOUND");
    expect(evidence.nodes.length).toBeLessThanOrEqual(6);
    expect(evidence.links.length).toBeLessThanOrEqual(10);
    expect(evidence.files.length).toBeLessThanOrEqual(3);
    expect(evidence.nodes.map((node) => node.name)).toEqual(expect.arrayContaining([
      "buildCarehubDeviceAlertsRedisKey",
      "writeAlertStateToRedis",
    ]));
  });

  it("returns semantic neighborhoods for ids or natural queries", () => {
    const graph = intelligenceFixtureGraph();
    const intelligence = createIntelligence(graph);

    const exact = intelligence.related("svc:CarehubPatientThresholdService");
    const fuzzy = intelligence.related("sleep duration averages");

    expect(exact?.node.name).toBe("CarehubPatientThresholdService");
    expect(exact?.related.map((node) => node.name)).toContain("calculateSleepDurationAverages");
    expect(fuzzy?.node.name).toBe("calculateSleepDurationAverages");
  });
});

function intelligenceFixtureGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "intelligence-fixture",
      packageName: "intelligence-fixture",
    },
    fileCount: 5,
    nodes: [
      { id: "workspace:intelligence-fixture", type: "Workspace", name: "intelligence-fixture" },
      { id: "mod:src/carehub/threshold.ts", type: "Module", name: "src/carehub/threshold.ts", file: "src/carehub/threshold.ts" },
      { id: "svc:CarehubPatientThresholdService", type: "Service", name: "CarehubPatientThresholdService", file: "src/carehub/threshold.service.ts" },
      { id: "fn:calculateSleepDurationAverages", type: "Function", name: "calculateSleepDurationAverages", file: "src/carehub/sleep.ts" },
      { id: "dto:PatientThresholdDto", type: "TypeAlias", name: "PatientThresholdDto", file: "src/carehub/threshold.dto.ts" },
      { id: "fn:buildCarehubDeviceAlertsRedisKey", type: "Function", name: "buildCarehubDeviceAlertsRedisKey", file: "src/carehub/redis.ts" },
      { id: "fn:writeAlertStateToRedis", type: "Function", name: "writeAlertStateToRedis", file: "src/carehub/redis.ts" },
      { id: "cfg:RedisCache", type: "Configuration", name: "RedisCache", file: "src/config/redis.ts" },
    ],
    edges: [
      edge("CONTAINS", "workspace:intelligence-fixture", "mod:src/carehub/threshold.ts"),
      edge("CONTAINS", "mod:src/carehub/threshold.ts", "svc:CarehubPatientThresholdService"),
      edge("CONTAINS", "mod:src/carehub/threshold.ts", "fn:calculateSleepDurationAverages"),
      edge("USES", "svc:CarehubPatientThresholdService", "dto:PatientThresholdDto"),
      edge("CALLS", "svc:CarehubPatientThresholdService", "fn:calculateSleepDurationAverages"),
      edge("CALLS", "fn:writeAlertStateToRedis", "fn:buildCarehubDeviceAlertsRedisKey"),
      edge("USES", "fn:writeAlertStateToRedis", "cfg:RedisCache"),
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
