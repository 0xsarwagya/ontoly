import { describe, expect, it } from "vitest";
import {
  createEdgeId,
  createNodeId,
  createSoftwareGraph,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import {
  createSemanticIndex,
  findConfiguration,
  findFeature,
  findRoute,
  findSymbol,
  normalizeIntent,
  resolveIntent,
  validateSemanticIndex,
} from "../src/index";

describe("semantic index", () => {
  it("normalizes identifier variants deterministically", () => {
    expect(normalizeIntent("AuthService").expandedTerms).toContain("authentication");
    expect(normalizeIntent("auth-service").tokens).toContain("auth");
    expect(normalizeIntent("auth_service").tokens).toContain("service");
    expect(normalizeIntent("authentication service").expandedTerms).toContain("login");
  });

  it("builds searchable aliases and vocabulary from graph nodes", () => {
    const index = createSemanticIndex(exampleGraph());
    const auth = index.entries.find((entry) => entry.displayName === "AuthService");

    expect(auth?.aliases).toContain("auth");
    expect(auth?.aliases).toContain("authentication");
    expect(auth?.keywords).toContain("service");
    expect(index.vocabulary.map((term) => term.term)).toContain("jwt");
    expect(validateSemanticIndex(index, exampleGraph())).toEqual([]);
  });

  it("resolves natural concepts to ranked candidates", () => {
    const index = createSemanticIndex(exampleGraph());
    const auth = resolveIntent(index, "login authentication");
    const threshold = findFeature(index, "sleep thresholds");
    const planDefinition = findSymbol(index, "Plan Definition Resource");

    expect(auth.candidates.map((candidate) => candidate.displayName)).toContain("AuthService");
    expect(threshold.candidates[0]?.displayName).toBe("PatientThresholdService");
    expect(planDefinition.candidates[0]?.displayName).toBe("PlanDefinition");
    expect(planDefinition.recommendedCapability).toBe("FeatureTouchpoints");
  });

  it("supports category-specific search APIs", () => {
    const index = createSemanticIndex(exampleGraph());

    expect(findConfiguration(index, "JWT secret").candidates[0]?.displayName).toBe("JWT_SECRET");
    expect(findRoute(index, "POST login").candidates[0]?.displayName).toBe("POST /login");
    expect(findSymbol(index, "AuthService").candidates[0]?.displayName).toBe("AuthService");
  });

  it("ranks repository feature symbols above framework and utility noise", () => {
    const index = createSemanticIndex(featureRankingGraph());
    const result = findFeature(index, "sleep duration thresholds", { limit: 8 });

    expect(result.candidates[0]).toMatchObject({
      displayName: "SleepDurationThresholdService",
      kind: "Service",
    });
    expect(result.candidates[0]?.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.candidates.map((candidate) => candidate.displayName)).toEqual(expect.arrayContaining([
      "SleepDurationThresholdDto",
      "SleepDurationThresholdRepository",
      "SleepDurationThresholdService",
    ]));
    const serviceIndex = result.candidates.findIndex((candidate) => candidate.displayName === "SleepDurationThresholdService");
    const externalIndex = result.candidates.findIndex((candidate) => candidate.displayName === "ThresholdService");
    expect(externalIndex === -1 || externalIndex > serviceIndex).toBe(true);
  });

  it("resolves sleep duration threshold seeds to repository-local carehub nodes", () => {
    const index = createSemanticIndex(carehubThresholdGraph());
    const result = findFeature(index, "sleep duration thresholds", { limit: 10 });
    const names = result.candidates.map((candidate) => candidate.displayName);
    const allowed = [
      "PatientThresholdDto",
      "CarehubPatientThresholdService",
      "calculateSleepDurationAverages",
    ];

    expect(allowed).toContain(result.candidates[0]?.displayName);
    expect(names).toEqual(expect.arrayContaining(allowed));
    expect(names.slice(0, 5)).not.toContain("@medplum/fhirtypes");
    expect(names[0]).not.toBe("isSleepStatisticsObservation");
    expect(result.confidence).toBeLessThanOrEqual(0.9);

    const external = result.candidates.find((candidate) => candidate.displayName === "@medplum/fhirtypes");
    expect(external?.confidence ?? 0).toBeLessThan(0.9);
    expect(external?.score ?? 0).toBeLessThan(result.candidates[0]?.score ?? 0);
  });

  it("bounds metadata-derived aliases and documentation", () => {
    const index = createSemanticIndex(metadataHeavyGraph());
    const entry = index.entries.find((item) => item.displayName === "SleepDurationThresholdService");

    expect(entry?.documentation?.length).toBeLessThanOrEqual(260);
    expect(Math.max(...(entry?.aliases.map((alias) => alias.length) ?? [0]))).toBeLessThanOrEqual(300);
    expect(index.metadata.deterministicHash).toEqual(expect.any(String));
  });

  it("hashes larger semantic indexes deterministically with chunked hashing", () => {
    const graph = largeGraph();
    const first = createSemanticIndex(graph);
    const second = createSemanticIndex(graph);

    expect(first.metadata.deterministicHash).toBe(second.metadata.deterministicHash);
    expect(first.entries).toHaveLength(600);
    expect(validateSemanticIndex(first, graph)).toEqual([]);
  });
});

function exampleGraph(): SoftwareGraph {
  const nodes: SoftwareGraphNode[] = [
    node("Module", "AuthModule", "src/auth/auth.module.ts"),
    node("Service", "AuthService", "src/auth/auth.service.ts", { framework: "NestJS" }),
    node("Controller", "AuthController", "src/auth/auth.controller.ts"),
    node("Route", "POST /login", "src/auth/auth.controller.ts", { method: "POST", path: "/login" }),
    node("EnvironmentVariable", "JWT_SECRET", ".env.example"),
    node("Service", "PatientThresholdService", "src/carehub/threshold/patient-threshold.service.ts"),
    node("Resource", "PlanDefinition", "src/carehub/threshold/plan-definition.ts", { resourceType: "PlanDefinition" }),
  ];
  const byName = new Map(nodes.map((item) => [item.name, item] as const));
  const edges: SoftwareGraphEdge[] = [
    edge("CONTAINS", byName.get("AuthModule")!, byName.get("AuthService")!),
    edge("CONTAINS", byName.get("AuthModule")!, byName.get("AuthController")!),
    edge("HANDLES", byName.get("POST /login")!, byName.get("AuthController")!),
    edge("READS", byName.get("AuthService")!, byName.get("JWT_SECRET")!),
    edge("USES", byName.get("PatientThresholdService")!, byName.get("PlanDefinition")!),
  ];

  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "example",
      packageName: "example",
    },
    nodes,
    edges,
    fileCount: 7,
  });
}

function featureRankingGraph(): SoftwareGraph {
  const nodes: SoftwareGraphNode[] = [
    node("Module", "SleepDurationThresholdModule", "src/sleep/sleep-duration-threshold.module.ts"),
    node("Service", "SleepDurationThresholdService", "src/sleep/sleep-duration-threshold.service.ts"),
    node("Model", "SleepDurationThresholdDto", "src/sleep/dto/sleep-duration-threshold.dto.ts"),
    node("Repository", "SleepDurationThresholdRepository", "src/sleep/sleep-duration-threshold.repository.ts"),
    node("Method", "SleepDurationThresholdService.evaluate", "src/sleep/sleep-duration-threshold.service.ts"),
    node("Function", "sleep duration threshold service spec", "src/sleep/sleep-duration-threshold.service.spec.ts"),
    node("Service", "ThresholdService", "node_modules/@nestjs/threshold/threshold.service.ts"),
    node("Function", "durationUtils", "src/common/duration.utils.ts"),
  ];
  const byName = new Map(nodes.map((item) => [item.name, item] as const));
  const edges: SoftwareGraphEdge[] = [
    edge("CONTAINS", byName.get("SleepDurationThresholdModule")!, byName.get("SleepDurationThresholdService")!),
    edge("CONTAINS", byName.get("SleepDurationThresholdService")!, byName.get("SleepDurationThresholdService.evaluate")!),
    edge("REFERENCES", byName.get("SleepDurationThresholdService.evaluate")!, byName.get("SleepDurationThresholdDto")!),
    edge("CALLS", byName.get("SleepDurationThresholdService.evaluate")!, byName.get("SleepDurationThresholdRepository")!),
    edge("CALLS", byName.get("sleep duration threshold service spec")!, byName.get("SleepDurationThresholdService")!),
  ];

  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "sleep",
      packageName: "sleep",
    },
    nodes,
    edges,
    fileCount: 7,
  });
}

function carehubThresholdGraph(): SoftwareGraph {
  const nodes: SoftwareGraphNode[] = [
    node("Module", "CarehubThresholdModule", "src/carehub/carehub-threshold.module.ts", {
      documentation: "Carehub feature module for sleep duration thresholds.",
    }),
    node("Service", "CarehubPatientThresholdService", "src/carehub/patient-threshold.service.ts", {
      documentation: "Repository-local service that resolves patient sleep duration thresholds.",
    }),
    node("Model", "PatientThresholdDto", "src/carehub/dto/patient-threshold.dto.ts", {
      documentation: "DTO payload for patient sleep duration threshold limits.",
    }),
    node("Function", "calculateSleepDurationAverages", "src/carehub/sleep/calculate-sleep-duration-averages.ts", {
      documentation: "Calculates sleep duration averages and applies patient thresholds.",
    }),
    node("Repository", "PatientThresholdRepository", "src/carehub/patient-threshold.repository.ts", {
      documentation: "Stores repository-local patient sleep threshold records.",
    }),
    node("Resource", "isSleepStatisticsObservation", "src/carehub/fhir/is-sleep-statistics-observation.ts", {
      documentation: "Type guard for sleep statistics observations.",
    }),
    node("Dependency", "@medplum/fhirtypes", "node_modules/@medplum/fhirtypes/package.json", {
      package: "@medplum/fhirtypes",
      documentation: "External FHIR types package for observation and threshold resources.",
    }),
    node("Resource", "SleepDurationThreshold", "node_modules/@medplum/fhirtypes/dist/index.d.ts", {
      package: "@medplum/fhirtypes",
      documentation: "External generated FHIR sleep duration threshold type.",
    }),
  ];
  const byName = new Map(nodes.map((item) => [item.name, item] as const));
  const edges: SoftwareGraphEdge[] = [
    edge("CONTAINS", byName.get("CarehubThresholdModule")!, byName.get("CarehubPatientThresholdService")!),
    edge("CONTAINS", byName.get("CarehubThresholdModule")!, byName.get("PatientThresholdDto")!),
    edge("CALLS", byName.get("CarehubPatientThresholdService")!, byName.get("calculateSleepDurationAverages")!),
    edge("CALLS", byName.get("CarehubPatientThresholdService")!, byName.get("PatientThresholdRepository")!),
    edge("REFERENCES", byName.get("calculateSleepDurationAverages")!, byName.get("PatientThresholdDto")!),
    edge("USES", byName.get("calculateSleepDurationAverages")!, byName.get("isSleepStatisticsObservation")!),
    edge("IMPORTS", byName.get("CarehubPatientThresholdService")!, byName.get("@medplum/fhirtypes")!),
    edge("EXPORTS", byName.get("@medplum/fhirtypes")!, byName.get("SleepDurationThreshold")!),
  ];

  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "carehub",
      packageName: "@repo/carehub",
    },
    nodes,
    edges,
    fileCount: nodes.length,
  });
}

function metadataHeavyGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "metadata-heavy",
      packageName: "metadata-heavy",
    },
    nodes: [
      node("Service", "SleepDurationThresholdService", "src/sleep/sleep-duration-threshold.service.ts", {
        documentation: "sleep duration threshold ".repeat(1_000),
        nested: {
          examples: Array.from({ length: 50 }, () => "duration threshold metadata ".repeat(200)),
        },
      }),
    ],
    edges: [],
    fileCount: 1,
  });
}

function largeGraph(): SoftwareGraph {
  const nodes = Array.from({ length: 600 }, (_, index) =>
    node(
      index % 3 === 0 ? "Service" : index % 3 === 1 ? "Model" : "Function",
      `SleepDurationThreshold${index}`,
      `src/sleep/generated/sleep-duration-threshold-${index}.ts`,
      { description: `Sleep duration threshold fixture ${index}` },
    ),
  );

  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "large-example",
      packageName: "large-example",
    },
    nodes,
    edges: nodes.slice(1).map((item, index) => edge("REFERENCES", nodes[index]!, item)),
    fileCount: nodes.length,
  });
}

function node(
  type: SoftwareGraphNode["type"],
  name: string,
  file: string,
  metadata?: SoftwareGraphNode["metadata"],
): SoftwareGraphNode {
  return {
    id: createNodeId({ type, name, file }),
    type,
    name,
    file,
    metadata,
  };
}

function edge(type: SoftwareGraphEdge["type"], from: SoftwareGraphNode, to: SoftwareGraphNode): SoftwareGraphEdge {
  return {
    id: createEdgeId(type, from.id, to.id),
    type,
    from: from.id,
    to: to.id,
  };
}
