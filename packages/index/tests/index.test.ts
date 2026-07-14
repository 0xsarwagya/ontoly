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
