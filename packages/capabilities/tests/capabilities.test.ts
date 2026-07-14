import { describe, expect, it } from "vitest";
import { createEdgeId, createSoftwareGraph, type RelationshipType, type SoftwareGraph } from "@0xsarwagya/ontoly-core";
import { CAPABILITY_NAMES, createCapabilityEngine } from "../src/index";

describe("semantic capability engine", () => {
  it("registers deterministic software engineering capabilities", () => {
    const engine = createCapabilityEngine(graph());

    expect(engine.registry.capabilities().map((capability) => capability.name)).toEqual([...CAPABILITY_NAMES].sort());
    expect(engine.registry.capabilities().every((capability) => capability.version === "1.0.0")).toBe(true);
  });

  it("returns the shared capability result schema", () => {
    const result = createCapabilityEngine(graph()).execute("RepositorySummary");

    expect(Object.keys(result).sort()).toEqual([
      "affectedFiles",
      "affectedNodes",
      "affectedPackages",
      "confidence",
      "diagnostics",
      "evidence",
      "graph",
      "recommendations",
      "statistics",
      "summary",
    ]);
    expect(result.graph).toMatchObject({
      source: "Ontoly Software Graph",
      repository: "repo",
      graphHash: expect.any(String),
    });
    expect(result.confidence.score).toBeGreaterThan(0);
  });

  it("groups impact analysis by architectural concern", () => {
    const result = createCapabilityEngine(graph()).execute("ImpactAnalysis", {
      id: "service:AuthService",
      depth: 4,
    });

    expect(result.summary).toContain("AuthService");
    expect(result.affectedNodes).toMatchObject({
      Routes: [expect.objectContaining({ id: "route:POST:/login" })],
      Controllers: [expect.objectContaining({ id: "controller:AuthController" })],
      Services: [expect.objectContaining({ id: "service:AuthService" })],
      Configuration: [expect.objectContaining({ id: "env:JWT_SECRET" })],
    });
    expect(result.affectedNodes.Persistence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "repo:UserRepository" }),
    ]));
    expect(result.statistics).toMatchObject({
      blastRadius: "small",
    });
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.confidence.level).toBe("high");
  });

  it("plans implementation from deterministic graph touchpoints", () => {
    const result = createCapabilityEngine(graph()).execute("ImplementationPlan", {
      task: "Add login token threshold",
    });

    expect(result.summary).toContain("Add login token threshold");
    expect(result.statistics.matchedTerms).toEqual(expect.arrayContaining(["login", "token", "threshold"]));
    expect(result.recommendations.length).toBeGreaterThan(1);
  });

  it("returns graph-native diagnostics when evidence is missing", () => {
    const result = createCapabilityEngine(graph()).execute("ImpactAnalysis", {
      id: "MissingThing",
    });

    expect(result.confidence.score).toBe(0);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "CAPABILITY_NOT_FOUND" }),
    ]);
  });
});

function graph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: "route:POST:/login", type: "Route", name: "POST /login", metadata: { method: "POST", path: "/login" } },
      { id: "controller:AuthController", type: "Controller", name: "AuthController", file: "src/auth.controller.ts" },
      { id: "service:AuthService", type: "Service", name: "AuthService", file: "src/auth.service.ts" },
      { id: "method:AuthService.login", type: "Method", name: "AuthService.login", file: "src/auth.service.ts" },
      { id: "repo:UserRepository", type: "Repository", name: "UserRepository", file: "src/user.repository.ts" },
      { id: "env:JWT_SECRET", type: "EnvironmentVariable", name: "JWT_SECRET" },
      { id: "model:LoginThreshold", type: "Model", name: "LoginThreshold", file: "src/login-threshold.dto.ts" },
      { id: "pkg:auth", type: "Package", name: "@repo/auth" },
    ],
    edges: [
      edge("HANDLES", "route:POST:/login", "controller:AuthController"),
      edge("CALLS", "controller:AuthController", "service:AuthService"),
      edge("CONTAINS", "service:AuthService", "method:AuthService.login"),
      edge("CALLS", "method:AuthService.login", "repo:UserRepository"),
      edge("READS", "method:AuthService.login", "env:JWT_SECRET"),
      edge("REFERENCES", "method:AuthService.login", "model:LoginThreshold"),
      edge("DEPENDS_ON", "pkg:auth", "service:AuthService"),
    ],
    fileCount: 4,
  });
}

function edge(type: RelationshipType, from: string, to: string) {
  return {
    id: createEdgeId(type, from, to),
    type,
    from,
    to,
    evidence: [{ kind: "semantic" as const, confidence: "exact" as const, description: `${from} ${type} ${to}` }],
  };
}
