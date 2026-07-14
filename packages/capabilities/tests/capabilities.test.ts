import { describe, expect, it } from "vitest";
import {
  createEdgeId,
  createSemanticIndex,
  createSoftwareGraph,
  resolveIntent,
  type RelationshipType,
  type SoftwareGraph,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import { createQueryEngine } from "@0xsarwagya/ontoly-query";
import { CAPABILITY_NAMES, capabilityResultToJson, createCapabilityEngine } from "../src/index";

const EXPECTED_IMPLEMENTATION_PLAN_STAGES = [
  "search",
  "seed resolution",
  "inspect",
  "scoped impact",
  "ownership",
  "evidence pack",
  "repository intelligence",
  "plan",
] as const;

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

  it("composes implementation-plan from bounded profiled capability stages", () => {
    const result = createCapabilityEngine(graph()).execute("ImplementationPlan", {
      task: "Add sleep duration thresholds to batch-data observations",
      maxNodes: 12,
      maxEdges: 24,
      maxDepth: 2,
      maxEvidence: 8,
      maxTimeMs: 750,
    });
    const profile = result.statistics.profile as readonly {
      readonly name: string;
      readonly durationMs: number;
      readonly status: string;
      readonly nodesVisited?: number;
      readonly edgesVisited?: number;
    }[];
    const evidencePack = result.statistics.evidencePack as {
      readonly stableIds: readonly string[];
      readonly filesToInspect: readonly string[];
      readonly topNodes: readonly unknown[];
      readonly topEdges: readonly unknown[];
      readonly limits: { readonly nodes: number; readonly edges: number; readonly files: number };
    };
    const repositoryIntelligence = result.statistics.repositoryIntelligence as {
      readonly scopedFiles: readonly string[];
      readonly graphNodes: number;
      readonly graphEdges: number;
    };

    expect(profile.map((stage) => stage.name)).toEqual([...EXPECTED_IMPLEMENTATION_PLAN_STAGES]);
    expect(result.statistics.progress).toEqual(profile.map((stage) => `${stage.name}: ${stage.status}`));
    expect(profile.every((stage) =>
      Number.isFinite(stage.durationMs) &&
      stage.durationMs >= 0 &&
      ["complete", "partial"].includes(stage.status),
    )).toBe(true);
    expect(profile.find((stage) => stage.name === "inspect")).toMatchObject({
      nodesVisited: expect.any(Number),
      edgesVisited: expect.any(Number),
    });
    expect(profile.find((stage) => stage.name === "scoped impact")).toMatchObject({
      nodesVisited: expect.any(Number),
      edgesVisited: expect.any(Number),
    });
    expect(evidencePack.stableIds).toEqual(expect.arrayContaining([
      "model:SleepDurationThreshold",
      "service:SleepObservationService",
    ]));
    expect(evidencePack.filesToInspect).toEqual(expect.arrayContaining(["src/sleep/thresholds.ts"]));
    expect(evidencePack.topNodes.length).toBeLessThanOrEqual(evidencePack.limits.nodes);
    expect(evidencePack.topEdges.length).toBeLessThanOrEqual(evidencePack.limits.edges);
    expect(evidencePack.filesToInspect.length).toBeLessThanOrEqual(evidencePack.limits.files);
    expect(repositoryIntelligence.scopedFiles).toEqual(expect.arrayContaining([
      "src/sleep/sleep-observation.service.ts",
      "src/sleep/thresholds.ts",
    ]));
    expect(repositoryIntelligence.graphNodes).toBeGreaterThan(0);
    expect(repositoryIntelligence.graphEdges).toBeGreaterThan(0);
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
    expect((result.statistics.profile as readonly { readonly name: string }[]).map((stage) => stage.name)).toEqual([
      ...EXPECTED_IMPLEMENTATION_PLAN_STAGES,
    ]);
    expect(result.statistics.progress).toEqual(expect.arrayContaining([
      "search: complete",
      "seed resolution: complete",
      expect.stringContaining("scoped impact: partial"),
      expect.stringContaining("plan: partial"),
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

  it("resolves natural impact text to repository-local seeds before scoped traversal", () => {
    const result = createCapabilityEngine(graph()).execute("ImpactAnalysis", {
      query: "auth service",
      mode: "direct",
    });
    const target = result.statistics.target as { readonly id: string; readonly file?: string };

    expect(target.id).toBe("service:AuthService");
    expect(target.file ?? "").not.toContain("node_modules");
    expect(result.statistics).toMatchObject({
      mode: "direct",
      nodeLimit: 20,
      edgeLimit: 40,
    });
    expect(result.affectedFiles.some((file) => file.includes("node_modules"))).toBe(false);
    expect(result.diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CAPABILITY_AMBIGUOUS_TARGET" }),
    ]));
  });

  it("resolves the alpha.14 regression phrase set to stable repository-local nodes", () => {
    const fixture = graph();
    const index = createSemanticIndex(fixture);
    const cases = [
      { phrase: "sleep duration thresholds", category: "feature" as const, expected: ["model:SleepDurationThreshold", "config:SleepThresholds"], minConfidence: 0.6 },
      { phrase: "sleep statistics observation", category: "feature" as const, expected: ["model:SleepStatisticsObservation", "service:SleepObservationService", "method:SleepObservationService.recordStatistics"], minConfidence: 0.55 },
      { phrase: "batch-data observations", category: "concept" as const, expected: ["repo:BatchDataObservationRepository", "model:BatchDataObservation"], minConfidence: 0.55 },
      { phrase: "authentication", category: "feature" as const, expected: ["service:AuthService", "controller:AuthController"], minConfidence: 0.55 },
      { phrase: "JWT", category: "concept" as const, expected: ["guard:JwtAuthGuard", "env:JWT_SECRET"], minConfidence: 0.55 },
      { phrase: "Signals", category: "concept" as const, expected: ["event:SleepSignals"], minConfidence: 0.45 },
      { phrase: "Thresholds", category: "concept" as const, expected: ["config:SleepThresholds", "model:SleepDurationThreshold"], minConfidence: 0.45 },
      { phrase: "FHIR", category: "feature" as const, expected: ["service:FhirPlanDefinitionService", "resource:fhir:PlanDefinition"], minConfidence: 0.5 },
      { phrase: "PlanDefinition", category: "concept" as const, expected: ["resource:fhir:PlanDefinition", "service:FhirPlanDefinitionService"], minConfidence: 0.55 },
      { phrase: "repository ownership", category: "feature" as const, expected: ["service:RepositoryOwnershipService", "method:RepositoryOwnershipService.findOwners"], minConfidence: 0.55 },
      { phrase: "implementation planning", category: "feature" as const, expected: ["service:ImplementationPlanningService", "method:ImplementationPlanningService.createPlan"], minConfidence: 0.55 },
    ];

    for (const item of cases) {
      const result = resolveIntent(index, item.phrase, { category: item.category, limit: 8 });
      const candidateIds = result.candidates.map((candidate) => candidate.nodeId);
      const candidateFiles = result.candidates.map((candidate) => candidate.entry.filePath ?? "");
      const firstExpectedIndex = candidateIds.findIndex((candidateId) => item.expected.includes(candidateId));
      const firstExternalIndex = candidateIds.findIndex((candidateId) =>
        candidateId === "dep:@medplum/fhirtypes" ||
        candidateId === "type:isSleepStatisticsObservation",
      );

      expect(candidateIds, item.phrase).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(item.expected.map(escapeRegExp).join("|")))]));
      expect(firstExpectedIndex, item.phrase).toBeGreaterThanOrEqual(0);
      expect(firstExternalIndex === -1 || firstExpectedIndex < firstExternalIndex, item.phrase).toBe(true);
      expect(candidateFiles[0]?.includes("node_modules") ?? false, item.phrase).toBe(false);
      expect(result.confidence, item.phrase).toBeGreaterThanOrEqual(item.minConfidence);
    }
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
    expect((plan.statistics.profile as readonly { readonly name: string }[]).map((stage) => stage.name)).toEqual([
      ...EXPECTED_IMPLEMENTATION_PLAN_STAGES,
    ]);
    expect(plan.statistics.evidencePack).toMatchObject({
      stableIds: expect.arrayContaining(["model:SleepDurationThreshold"]),
      limits: expect.objectContaining({ nodes: expect.any(Number), edges: expect.any(Number), files: 10 }),
    });
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

  it("uses stable repository-local seed resolution for sleep duration threshold capabilities", () => {
    const engine = createCapabilityEngine(carehubSeedGraph());
    const allowedSeedIds = [
      "model:PatientThresholdDto",
      "service:CarehubPatientThresholdService",
      "fn:calculateSleepDurationAverages",
    ];

    const impact = engine.execute("ImpactAnalysis", {
      query: "sleep duration thresholds",
      mode: "local",
    });
    const target = impact.statistics.target as { readonly id?: string; readonly type?: string };
    expect(allowedSeedIds).toContain(target.id);
    expect(target.id).not.toContain("@medplum/fhirtypes");
    expect(target.id).not.toContain("node_modules");

    const evidence = engine.execute("EvidencePack", {
      query: "sleep duration thresholds",
      limit: 8,
    });
    const pack = evidence.statistics.evidencePack as { readonly stableIds: readonly string[] };
    expect(pack.stableIds).toEqual(expect.arrayContaining(allowedSeedIds));
    expect(pack.stableIds.slice(0, 5).some((id) => id.includes("@medplum/fhirtypes") || id.includes("node_modules"))).toBe(false);

    const plan = engine.execute("ImplementationPlan", {
      task: "Add sleep duration thresholds to carehub observations",
      maxNodes: 8,
      maxEdges: 20,
      maxEvidence: 8,
    });
    const planPack = plan.statistics.evidencePack as { readonly stableIds?: readonly string[] } | undefined;
    expect(planPack?.stableIds?.some((id) => allowedSeedIds.includes(id))).toBe(true);
    expect(planPack?.stableIds?.slice(0, 5).some((id) => id.includes("@medplum/fhirtypes") || id.includes("node_modules"))).toBe(false);
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
      { id: "model:SleepStatisticsObservation", type: "Model", name: "SleepStatisticsObservation", file: "src/sleep/sleep-statistics-observation.ts" },
      { id: "model:SleepDurationThreshold", type: "Model", name: "SleepDurationThreshold", file: "src/sleep/thresholds.ts" },
      { id: "config:SleepThresholds", type: "Configuration", name: "SleepThresholds", file: "src/sleep/thresholds.ts" },
      { id: "event:SleepSignals", type: "Event", name: "SleepSignals", file: "src/sleep/signals.ts" },
      { id: "route:GET:/fhir/PlanDefinition", type: "Route", name: "GET /fhir/PlanDefinition", file: "src/fhir/fhir.controller.ts", metadata: { method: "GET", path: "/fhir/PlanDefinition" } },
      { id: "controller:FhirController", type: "Controller", name: "FhirController", file: "src/fhir/fhir.controller.ts" },
      { id: "service:FhirPlanDefinitionService", type: "Service", name: "FhirPlanDefinitionService", file: "src/fhir/plan-definition.service.ts" },
      { id: "resource:fhir:PlanDefinition", type: "Resource", name: "PlanDefinition", file: "src/fhir/plan-definition.resource.ts" },
      { id: "config:FHIR_DEFAULT_VERSION", type: "Configuration", name: "FHIR_DEFAULT_VERSION", file: "src/fhir/fhir.config.ts" },
      { id: "module:RepositoryIntelligenceModule", type: "Module", name: "RepositoryIntelligenceModule", file: "src/repository-intelligence/repository-intelligence.module.ts" },
      { id: "service:RepositoryOwnershipService", type: "Service", name: "RepositoryOwnershipService", file: "src/repository-intelligence/ownership.service.ts" },
      { id: "method:RepositoryOwnershipService.findOwners", type: "Method", name: "RepositoryOwnershipService.findOwners", file: "src/repository-intelligence/ownership.service.ts" },
      { id: "model:RepositoryOwnershipEvidence", type: "Model", name: "RepositoryOwnershipEvidence", file: "src/repository-intelligence/ownership.evidence.ts" },
      { id: "service:ImplementationPlanningService", type: "Service", name: "ImplementationPlanningService", file: "src/planning/implementation-planning.service.ts" },
      { id: "method:ImplementationPlanningService.createPlan", type: "Method", name: "ImplementationPlanningService.createPlan", file: "src/planning/implementation-planning.service.ts" },
      { id: "model:ImplementationPlan", type: "Model", name: "ImplementationPlan", file: "src/planning/implementation-plan.ts" },
      { id: "dep:@medplum/fhirtypes", type: "Dependency", name: "@medplum/fhirtypes", file: "node_modules/@medplum/fhirtypes/dist/index.d.ts" },
      { id: "type:isSleepStatisticsObservation", type: "TypeAlias", name: "isSleepStatisticsObservation", file: "node_modules/@medplum/fhirtypes/dist/index.d.ts" },
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
      edge("REFERENCES", "method:SleepObservationService.recordStatistics", "model:SleepStatisticsObservation"),
      edge("READS", "method:SleepObservationService.recordStatistics", "config:SleepThresholds"),
      edge("REFERENCES", "method:SleepObservationService.recordStatistics", "model:SleepDurationThreshold"),
      edge("CONFIGURES", "config:SleepThresholds", "model:SleepDurationThreshold"),
      edge("PUBLISHES", "method:SleepObservationService.recordStatistics", "event:SleepSignals"),
      edge("HANDLES", "route:GET:/fhir/PlanDefinition", "controller:FhirController"),
      edge("AUTHORIZES", "route:GET:/fhir/PlanDefinition", "guard:JwtAuthGuard"),
      edge("CALLS", "controller:FhirController", "service:FhirPlanDefinitionService"),
      edge("USES", "service:FhirPlanDefinitionService", "resource:fhir:PlanDefinition"),
      edge("READS", "service:FhirPlanDefinitionService", "config:FHIR_DEFAULT_VERSION"),
      edge("REFERENCES", "resource:fhir:PlanDefinition", "dep:@medplum/fhirtypes"),
      edge("CONTAINS", "module:RepositoryIntelligenceModule", "service:RepositoryOwnershipService"),
      edge("CONTAINS", "service:RepositoryOwnershipService", "method:RepositoryOwnershipService.findOwners"),
      edge("REFERENCES", "method:RepositoryOwnershipService.findOwners", "model:RepositoryOwnershipEvidence"),
      edge("USES", "service:ImplementationPlanningService", "model:ImplementationPlan"),
      edge("CONTAINS", "service:ImplementationPlanningService", "method:ImplementationPlanningService.createPlan"),
      edge("CALLS", "method:ImplementationPlanningService.createPlan", "service:RepositoryOwnershipService"),
      edge("REFERENCES", "method:ImplementationPlanningService.createPlan", "model:ImplementationPlan"),
    ],
    fileCount: 20,
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

function carehubSeedGraph(): SoftwareGraph {
  const nodes: SoftwareGraphNode[] = [
    {
      id: "module:CarehubThresholdModule",
      type: "Module",
      name: "CarehubThresholdModule",
      file: "src/carehub/carehub-threshold.module.ts",
      metadata: { documentation: "Feature module for carehub sleep duration thresholds." },
    },
    {
      id: "service:CarehubPatientThresholdService",
      type: "Service",
      name: "CarehubPatientThresholdService",
      file: "src/carehub/patient-threshold.service.ts",
      metadata: { documentation: "Repository-local service for patient sleep duration thresholds." },
    },
    {
      id: "model:PatientThresholdDto",
      type: "Model",
      name: "PatientThresholdDto",
      file: "src/carehub/dto/patient-threshold.dto.ts",
      metadata: { documentation: "DTO payload for patient sleep duration threshold limits." },
    },
    {
      id: "fn:calculateSleepDurationAverages",
      type: "Function",
      name: "calculateSleepDurationAverages",
      file: "src/carehub/sleep/calculate-sleep-duration-averages.ts",
      metadata: { documentation: "Calculates sleep duration averages and applies patient thresholds." },
    },
    {
      id: "repo:PatientThresholdRepository",
      type: "Repository",
      name: "PatientThresholdRepository",
      file: "src/carehub/patient-threshold.repository.ts",
      metadata: { documentation: "Stores repository-local patient sleep threshold records." },
    },
    {
      id: "fn:isSleepStatisticsObservation",
      type: "Function",
      name: "isSleepStatisticsObservation",
      file: "src/carehub/fhir/is-sleep-statistics-observation.ts",
      metadata: { documentation: "Checks whether a FHIR observation contains sleep statistics." },
    },
    {
      id: "dep:@medplum/fhirtypes",
      type: "Dependency",
      name: "@medplum/fhirtypes",
      file: "node_modules/@medplum/fhirtypes/package.json",
      package: "@medplum/fhirtypes",
      metadata: { documentation: "External FHIR type package." },
    },
    {
      id: "resource:node_modules:@medplum/fhirtypes:SleepDurationThreshold",
      type: "Resource",
      name: "SleepDurationThreshold",
      file: "node_modules/@medplum/fhirtypes/dist/index.d.ts",
      package: "@medplum/fhirtypes",
      metadata: { documentation: "External generated FHIR sleep duration threshold resource." },
    },
  ];

  return createSoftwareGraph({
    repository: { root: "/repo", name: "carehub" },
    nodes,
    edges: [
      edge("CONTAINS", "module:CarehubThresholdModule", "service:CarehubPatientThresholdService"),
      edge("CONTAINS", "module:CarehubThresholdModule", "model:PatientThresholdDto"),
      edge("CALLS", "service:CarehubPatientThresholdService", "fn:calculateSleepDurationAverages"),
      edge("CALLS", "service:CarehubPatientThresholdService", "repo:PatientThresholdRepository"),
      edge("REFERENCES", "fn:calculateSleepDurationAverages", "model:PatientThresholdDto"),
      edge("USES", "fn:calculateSleepDurationAverages", "fn:isSleepStatisticsObservation"),
      edge("IMPORTS", "service:CarehubPatientThresholdService", "dep:@medplum/fhirtypes"),
      edge("EXPORTS", "dep:@medplum/fhirtypes", "resource:node_modules:@medplum/fhirtypes:SleepDurationThreshold"),
    ],
    fileCount: nodes.length,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
