import { describe, expect, it } from "vitest";
import {
  createEdgeId,
  createSemanticIndex,
  createSoftwareGraph,
  resolveIntent,
  type RelationshipType,
  type SoftwareGraph,
} from "@0xsarwagya/ontoly-core";
import { createQueryEngine } from "@0xsarwagya/ontoly-query";
import { CAPABILITY_NAMES, capabilityResultToJson, createCapabilityEngine } from "../src/index";

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
    expect(result.affectedNodes.Routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "route:POST:/login" }),
    ]));
    expect(result.affectedNodes.Controllers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "controller:AuthController" }),
    ]));
    expect(result.affectedNodes.Services).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "service:AuthService" }),
    ]));
    expect(result.affectedNodes.Configuration).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "env:JWT_SECRET" }),
    ]));
    expect(result.affectedNodes.Persistence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "repo:UserRepository" }),
    ]));
    expect(result.statistics).toMatchObject({
      blastRadius: "small",
    });
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.confidence.level).toBe("high");
  });

  it("scopes impact analysis with deterministic modes", () => {
    const result = createCapabilityEngine(graph()).execute("ImpactAnalysis", {
      id: "service:AuthService",
      mode: "direct",
    });

    expect(result.statistics).toMatchObject({
      mode: "direct",
      traversalDepth: 1,
      nodeLimit: 20,
      edgeLimit: 40,
    });
  });

  it("plans implementation from deterministic graph touchpoints", () => {
    const result = createCapabilityEngine(graph()).execute("ImplementationPlan", {
      task: "Add login token threshold",
    });

    expect(result.summary).toContain("Add login token threshold");
    expect(result.statistics.matchedTerms).toEqual(expect.arrayContaining(["login", "token", "threshold"]));
    expect(result.recommendations.length).toBeGreaterThan(1);
  });

  it("returns partial implementation plans when budgets are exceeded", () => {
    const result = createCapabilityEngine(graph()).execute("ImplementationPlan", {
      task: "Add login token threshold",
      budget: 1,
    });

    expect(result.statistics.budget).toMatchObject({
      status: "PARTIAL",
      nodeBudget: 1,
      reason: "NODE_BUDGET_EXCEEDED",
    });
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CAPABILITY_PARTIAL_PLAN" }),
    ]));
  });

  it("bounds implementation-plan scoped impact instead of pre-budget query.walk expansion", () => {
    // Regression profile: the old planner hotspot expanded every matched seed with query.walk()
    // before applying --budget, which could fan out across dense graphs.
    const result = createCapabilityEngine(densePlannerGraph()).execute("ImplementationPlan", {
      task: "Update DensePlannerRoot worker execution",
      maxNodes: 5,
      maxEdges: 4,
      maxDepth: 6,
      maxEvidence: 3,
      maxTimeMs: 1_000,
    });
    const budget = result.statistics.budget as Record<string, unknown>;

    expect(result.summary).toContain("PARTIAL implementation plan");
    expect(budget).toMatchObject({
      status: "PARTIAL",
      maxNodes: 5,
      maxEdges: 4,
      maxDepth: 6,
      maxEvidence: 3,
    });
    expect(Number(budget.visitedNodes)).toBeLessThanOrEqual(5);
    expect(Number(budget.visitedEdges)).toBeLessThanOrEqual(4);
    expect(result.statistics.progress).toEqual(expect.arrayContaining([
      "intent resolution: complete",
      "stable node resolution: complete",
      expect.stringContaining("scoped impact: partial"),
      expect.stringContaining("plan synthesis: partial"),
    ]));
    expect(result.statistics.nextCommands).toEqual(expect.arrayContaining([
      expect.stringContaining("ontoly implementation-plan"),
    ]));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CAPABILITY_PARTIAL_PLAN" }),
    ]));
  });

  it("creates compact evidence packs for agent workflows", () => {
    const result = createCapabilityEngine(graph()).execute("EvidencePack", {
      query: "login threshold",
      limit: 6,
    });
    const pack = result.statistics.evidencePack as Record<string, unknown>;

    expect(pack).toMatchObject({
      version: "1.0.0",
      query: "login threshold",
      graphFacts: expect.objectContaining({ repository: "repo" }),
    });
    expect(pack.stableIds).toEqual(expect.arrayContaining(["service:AuthService"]));
    expect(pack.suggestedCommands).toEqual(expect.arrayContaining([
      "ontoly evidence \"login threshold\"",
    ]));
    expect((pack.topNodes as readonly unknown[]).length).toBeLessThanOrEqual(6);
    expect((pack.topEdges as readonly unknown[]).length).toBeLessThanOrEqual(50);
    expect((pack.relevantFiles as readonly unknown[]).length).toBeLessThanOrEqual(10);
  });

  it("keeps evidence packs bounded on large noisy graphs", () => {
    const result = createCapabilityEngine(largeEvidenceGraph()).execute("EvidencePack", {
      query: "sleep duration thresholds",
      limit: 100,
    });
    const pack = result.statistics.evidencePack as Record<string, unknown>;
    const graphFacts = pack.graphFacts as Record<string, unknown>;
    const serialized = JSON.stringify(capabilityResultToJson(result));

    expect((pack.topNodes as readonly unknown[]).length).toBeLessThanOrEqual(20);
    expect((pack.topEdges as readonly unknown[]).length).toBeLessThanOrEqual(50);
    expect((pack.relevantFiles as readonly unknown[]).length).toBeLessThanOrEqual(10);
    expect((pack.filesToInspect as readonly unknown[]).length).toBeLessThanOrEqual(10);
    expect(graphFacts).not.toHaveProperty("nodes");
    expect(graphFacts).not.toHaveProperty("edges");
    expect(serialized.length).toBeLessThan(250_000);
  });

  it("resolves natural sleep duration threshold impact through a stable semantic node", () => {
    const result = createCapabilityEngine(graph()).execute("ImpactAnalysis", {
      query: "sleep duration thresholds",
      mode: "local",
    });

    expect(result.statistics.target).toMatchObject({
      id: "model:SleepDurationThreshold",
      type: "Model",
    });
    expect(result.diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CAPABILITY_AMBIGUOUS_TARGET" }),
    ]));
    expect(result.confidence.level).toBe("high");
    expect(result.affectedNodes.Persistence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "model:SleepDurationThreshold" }),
    ]));
    expect(result.affectedNodes.Services).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "service:SleepObservationService" }),
    ]));
  });

  it("keeps agent workflow outputs deterministic and bounded", () => {
    const fixture = graph();
    const index = createSemanticIndex(fixture);
    const query = createQueryEngine(fixture);
    const engine = createCapabilityEngine(fixture);

    const search = resolveIntent(index, "sleep duration thresholds", {
      category: "feature",
      limit: 5,
    });
    expect(search.candidates.map((candidate) => candidate.nodeId)).toContain("model:SleepDurationThreshold");
    expect(search.confidence).toBeGreaterThanOrEqual(0.6);

    const located = query.findNode("model:SleepDurationThreshold");
    expect(located).toMatchObject({
      id: "model:SleepDurationThreshold",
      file: "src/sleep/thresholds.ts",
    });

    const inspection = query.neighborhood(located!.id, { depth: 1 });
    expect(inspection.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      "method:SleepObservationService.recordStatistics",
      "config:SleepThresholds",
    ]));
    expect(inspection.edges.map((item) => item.type)).toEqual(expect.arrayContaining(["READS", "REFERENCES"]));

    const impact = engine.execute("ImpactAnalysis", {
      id: located!.id,
      mode: "local",
    });
    expect(impact.affectedFiles).toEqual(expect.arrayContaining([
      "src/sleep/sleep-observation.service.ts",
      "src/sleep/thresholds.ts",
    ]));
    expect(impact.statistics).toMatchObject({
      mode: "local",
      nodeLimit: 50,
      edgeLimit: 100,
      blastRadius: "small",
    });
    expect(impact.confidence.score).toBeGreaterThanOrEqual(0.6);
    expect(impact.confidence.score).toBeLessThanOrEqual(1);

    const evidence = engine.execute("EvidencePack", {
      query: "sleep duration thresholds",
      limit: 5,
    });
    const pack = evidence.statistics.evidencePack as {
      readonly topNodes: readonly unknown[];
      readonly topEdges: readonly unknown[];
      readonly filesToInspect: readonly string[];
      readonly stableIds: readonly string[];
      readonly confidence: { readonly score: number };
    };
    expect(pack.stableIds).toEqual(expect.arrayContaining([
      "model:SleepDurationThreshold",
      "config:SleepThresholds",
    ]));
    expect(pack.filesToInspect).toEqual(expect.arrayContaining(["src/sleep/thresholds.ts"]));
    expect(pack.topNodes.length).toBeLessThanOrEqual(5);
    expect(pack.topEdges.length).toBeLessThanOrEqual(50);
    expect(pack.confidence.score).toBeGreaterThanOrEqual(0.6);
    expect(pack.confidence.score).toBeLessThanOrEqual(1);

    const plan = engine.execute("ImplementationPlan", {
      task: "Add sleep duration thresholds to batch-data observations",
      budget: 3,
      timeoutMs: 250,
    });
    expect(plan.summary).toContain("PARTIAL implementation plan");
    expect(plan.statistics.budget).toMatchObject({
      status: "PARTIAL",
      nodeBudget: 3,
      timeoutMs: 250,
      reason: "NODE_BUDGET_EXCEEDED",
    });
    expect(plan.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CAPABILITY_PARTIAL_PLAN" }),
    ]));
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
      { id: "guard:JwtAuthGuard", type: "Guard", name: "JwtAuthGuard", file: "src/auth/jwt-auth.guard.ts" },
      { id: "route:GET:/sleep/statistics", type: "Route", name: "GET /sleep/statistics", file: "src/sleep/sleep.controller.ts", metadata: { method: "GET", path: "/sleep/statistics" } },
      { id: "controller:SleepController", type: "Controller", name: "SleepController", file: "src/sleep/sleep.controller.ts" },
      { id: "service:SleepObservationService", type: "Service", name: "SleepObservationService", file: "src/sleep/sleep-observation.service.ts" },
      { id: "method:SleepObservationService.recordStatistics", type: "Method", name: "SleepObservationService.recordStatistics", file: "src/sleep/sleep-observation.service.ts" },
      { id: "repo:BatchDataObservationRepository", type: "Repository", name: "BatchDataObservationRepository", file: "src/sleep/batch-data-observation.repository.ts" },
      { id: "model:BatchDataObservation", type: "Model", name: "BatchDataObservation", file: "src/sleep/batch-data-observation.ts" },
      { id: "model:SleepDurationThreshold", type: "Model", name: "SleepDurationThreshold", file: "src/sleep/thresholds.ts" },
      { id: "config:SleepThresholds", type: "Configuration", name: "SleepThresholds", file: "src/sleep/thresholds.ts" },
      { id: "event:SleepSignals", type: "Event", name: "SleepSignals", file: "src/sleep/signals.ts" },
    ],
    edges: [
      edge("HANDLES", "route:POST:/login", "controller:AuthController"),
      edge("AUTHORIZES", "route:POST:/login", "guard:JwtAuthGuard"),
      edge("CALLS", "controller:AuthController", "service:AuthService"),
      edge("CONTAINS", "service:AuthService", "method:AuthService.login"),
      edge("CALLS", "method:AuthService.login", "repo:UserRepository"),
      edge("READS", "method:AuthService.login", "env:JWT_SECRET"),
      edge("READS", "guard:JwtAuthGuard", "env:JWT_SECRET"),
      edge("REFERENCES", "method:AuthService.login", "model:LoginThreshold"),
      edge("DEPENDS_ON", "pkg:auth", "service:AuthService"),
      edge("HANDLES", "route:GET:/sleep/statistics", "controller:SleepController"),
      edge("AUTHORIZES", "route:GET:/sleep/statistics", "guard:JwtAuthGuard"),
      edge("CALLS", "controller:SleepController", "service:SleepObservationService"),
      edge("CONTAINS", "service:SleepObservationService", "method:SleepObservationService.recordStatistics"),
      edge("CALLS", "method:SleepObservationService.recordStatistics", "repo:BatchDataObservationRepository"),
      edge("WRITES", "repo:BatchDataObservationRepository", "model:BatchDataObservation"),
      edge("USES", "method:SleepObservationService.recordStatistics", "model:BatchDataObservation"),
      edge("READS", "method:SleepObservationService.recordStatistics", "config:SleepThresholds"),
      edge("REFERENCES", "method:SleepObservationService.recordStatistics", "model:SleepDurationThreshold"),
      edge("CONFIGURES", "config:SleepThresholds", "model:SleepDurationThreshold"),
      edge("PUBLISHES", "method:SleepObservationService.recordStatistics", "event:SleepSignals"),
    ],
    fileCount: 10,
  });
}

function largeEvidenceGraph(): SoftwareGraph {
  const base = graph();
  const utilityNodes = Array.from({ length: 120 }, (_, index) => ({
    id: `service:SharedUtility${index}`,
    type: "Service" as const,
    name: `SharedUtility${index}`,
    file: `src/shared/utils/shared-utility-${index}.ts`,
    metadata: {
      documentation: "sleep duration threshold metadata ".repeat(20),
      examples: Array.from({ length: 12 }, () => "threshold payload ".repeat(20)),
    },
  }));
  const utilityEdges = utilityNodes.map((node) =>
    edge("USES", "service:SleepObservationService", node.id),
  );

  return createSoftwareGraph({
    repository: base.repository,
    nodes: [...base.nodes, ...utilityNodes],
    edges: [...base.edges, ...utilityEdges],
    fileCount: 10 + utilityNodes.length,
  });
}

function densePlannerGraph(): SoftwareGraph {
  const workers = Array.from({ length: 40 }, (_, index) => ({
    id: `method:DensePlannerWorker${index}`,
    type: "Method" as const,
    name: `DensePlannerWorker${index}`,
    file: `src/planner/dense-worker-${index}.ts`,
  }));
  const nodes = [
    { id: "service:DensePlannerRoot", type: "Service" as const, name: "DensePlannerRoot", file: "src/planner/root.ts" },
    { id: "module:DensePlannerModule", type: "Module" as const, name: "DensePlannerModule", file: "src/planner/module.ts" },
    ...workers,
  ];
  const edges = [
    edge("PROVIDES", "module:DensePlannerModule", "service:DensePlannerRoot"),
    ...workers.map((worker) => edge("CALLS", "service:DensePlannerRoot", worker.id)),
    ...workers.flatMap((worker, index) =>
      workers.slice(index + 1, index + 4).map((next) => edge("USES", worker.id, next.id)),
    ),
  ];

  return createSoftwareGraph({
    repository: { root: "/repo", name: "dense-planner-repo" },
    nodes,
    edges,
    fileCount: workers.length + 2,
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
