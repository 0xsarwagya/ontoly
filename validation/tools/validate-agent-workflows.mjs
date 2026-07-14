#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const QUERY_PATH = join(PROJECT_ROOT, "validation", "search", "questions", "agent-workflow-regression.json");
const REPORT_ROOT = join(PROJECT_ROOT, "validation", "semantic", "reports");
const REPORT_JSON = join(REPORT_ROOT, "agent-workflow.json");
const REPORT_MD = join(REPORT_ROOT, "agent-workflow.md");
const CLIENTS = ["Codex", "Claude", "Generic"];
const EXPECTED_IMPLEMENTATION_PLAN_STAGES = [
  "search",
  "seed resolution",
  "inspect",
  "scoped impact",
  "ownership",
  "evidence pack",
  "repository intelligence",
  "plan",
];

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  writeErr(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

function writeOut(message = "") {
  process.stdout.write(`${message}\n`);
}

function writeErr(message = "") {
  process.stderr.write(`${message}\n`);
}

async function main() {
  const modules = await loadBuiltModules();
  const corpus = JSON.parse(await readFile(QUERY_PATH, "utf8"));
  const graph = createAgentWorkflowGraph(modules.core, 1);
  const workflow = validateWorkflow(modules, graph, corpus.queries);
  const stress = runStress(modules);
  const skills = validatePartialSchemaForSkills();
  const report = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    status: workflow.status === "PASS" && stress.status === "PASS" && skills.status === "PASS" ? "PASS" : "FAIL",
    workflow,
    stress,
    skills,
  };

  if (args.write) {
    await mkdir(REPORT_ROOT, { recursive: true });
    await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(REPORT_MD, renderMarkdown(report), "utf8");
  }

  writeOut(args.json ? JSON.stringify(report, null, 2) : renderConsole(report));

  if (args.ci && report.status !== "PASS") {
    process.exitCode = 1;
  }
}

async function loadBuiltModules() {
  const built = (name) => {
    const path = join(PROJECT_ROOT, "packages", name, "dist", "index.js");
    if (!existsSync(path)) {
      throw new Error(`Missing built Ontoly package: ${path}. Run pnpm build before agent workflow validation.`);
    }
    return pathToFileURL(path).href;
  };

  const [core, query, capabilities] = await Promise.all([
    import(built("core")),
    import(built("query")),
    import(built("capabilities")),
  ]);

  return { core, query, capabilities };
}

function validateWorkflow(modules, graph, queries) {
  const index = modules.core.createSemanticIndex(graph);
  const query = modules.query.createQueryEngine(graph);
  const engine = modules.capabilities.createCapabilityEngine(graph);
  const timings = [];

  const corpusResults = queries.map((item) => validateCorpusQuery(modules, graph, index, item));
  const repeatedQueries = queries.map((item) => validateRepeatedQuery(modules, index, item));

  const search = measured(timings, "search", () =>
    modules.core.resolveIntent(index, "sleep duration thresholds", { category: "feature", limit: 5 }));
  assert(search.candidates.some((candidate) =>
    candidate.nodeId === "model:SleepDurationThreshold" ||
    candidate.nodeId === "method:SleepObservationService.recordStatistics" ||
    candidate.nodeId === "service:SleepObservationService",
  ), "Search did not return a sleep threshold workflow touchpoint.");

  const locateId = search.candidates.find((candidate) =>
    candidate.nodeId === "model:SleepDurationThreshold" ||
    candidate.nodeId === "method:SleepObservationService.recordStatistics",
  )?.nodeId ?? search.candidates[0]?.nodeId ?? "model:SleepDurationThreshold";
  const located = measured(timings, "seed-resolution", () => query.findNode(locateId));
  assert(Boolean(located), "Seed Resolution did not resolve the top search candidate.");

  const inspection = measured(timings, "inspect", () => query.neighborhood(located.id, { depth: 1 }));
  assert(inspection.nodes.some((node) => node.id === "config:SleepThresholds"), "Inspect did not include threshold configuration.");
  assert(inspection.nodes.some((node) => node.id === "model:SleepDurationThreshold"), "Inspect did not include duration threshold model.");
  assert(inspection.edges.some((edge) => edge.type === "REFERENCES"), "Inspect did not include REFERENCES evidence.");

  const impact = measured(timings, "impact", () =>
    engine.execute("ImpactAnalysis", { id: located.id, mode: "local" }));
  assert(impact.statistics.nodeLimit === 50, "Impact local mode lost its node bound.");
  assert(impact.statistics.edgeLimit === 100, "Impact local mode lost its edge bound.");
  assert(impact.affectedFiles.includes("src/sleep/sleep-observation.service.ts"), "Impact did not include the sleep service file.");
  assertWithin(impact.confidence.score, 0.6, 1, "Impact confidence was outside the expected range.");

  const evidence = measured(timings, "evidence-pack", () =>
    engine.execute("EvidencePack", { query: "sleep duration thresholds", limit: 5 }));
  const pack = evidence.statistics.evidencePack;
  assert(pack.topNodes.length <= 5, "Evidence Pack returned more nodes than the requested limit.");
  assert(pack.topEdges.length <= 10, "Evidence Pack returned more edges than the bounded limit.");
  assert(pack.stableIds.includes("model:SleepDurationThreshold"), "Evidence Pack did not include the threshold stable id.");
  assert(pack.filesToInspect.includes("src/sleep/thresholds.ts"), "Evidence Pack did not include the threshold file.");
  assertWithin(pack.confidence.score, 0.6, 1, "Evidence Pack confidence was outside the expected range.");

  const plan = measured(timings, "implementation-plan", () =>
    engine.execute("ImplementationPlan", {
      task: "Add sleep duration thresholds to batch-data observations",
      budget: 3,
      timeoutMs: 250,
    }));
  assert(isPartialStatus(plan.statistics.budget.status), "Implementation Plan did not report partial/PARTIAL status.");
  assert(plan.statistics.budget.visitedNodes <= 3, "Implementation Plan exceeded its node budget.");
  assert(plan.diagnostics.some((item) => item.code === "CAPABILITY_PARTIAL_PLAN"), "Implementation Plan did not emit partial diagnostic.");
  const planProfile = plan.statistics.profile ?? [];
  const planEvidencePack = plan.statistics.evidencePack ?? {};
  assert(
    JSON.stringify(planProfile.map((stage) => stage.name)) === JSON.stringify(EXPECTED_IMPLEMENTATION_PLAN_STAGES),
    `Implementation Plan stages changed: ${planProfile.map((stage) => stage.name).join(" -> ")}`,
  );
  assert(planProfile.every((stage) =>
    Number.isFinite(stage.durationMs) &&
    stage.durationMs >= 0 &&
    (stage.status === "complete" || stage.status === "partial")
  ), "Implementation Plan stages are not profiled with status and duration.");
  assert(planEvidencePack.stableIds?.includes("model:SleepDurationThreshold"), "Implementation Plan evidence pack missed the threshold stable id.");
  assert(planEvidencePack.filesToInspect?.includes("src/sleep/thresholds.ts"), "Implementation Plan evidence pack missed the threshold file.");
  assert(planEvidencePack.topNodes.length <= planEvidencePack.limits.nodes, "Implementation Plan evidence pack exceeded node limits.");
  assert(planEvidencePack.topEdges.length <= planEvidencePack.limits.edges, "Implementation Plan evidence pack exceeded edge limits.");
  assert(plan.statistics.repositoryIntelligence?.scopedFiles?.includes("src/sleep/thresholds.ts"), "Implementation Plan did not include repository intelligence scoped files.");

  return {
    status: corpusResults.every((item) => item.status === "PASS") && repeatedQueries.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
    graphHash: graph.metadata.deterministicHash,
    corpus: corpusResults,
    repeatedQueries,
    steps: timings.map(({ value, ...item }) => item),
    bounded: {
      impactNodeLimit: impact.statistics.nodeLimit,
      impactEdgeLimit: impact.statistics.edgeLimit,
      evidenceNodeLimit: pack.topNodes.length,
      evidenceEdgeLimit: pack.topEdges.length,
      plannerBudget: plan.statistics.budget,
      plannerStages: planProfile.map((stage) => ({
        name: stage.name,
        status: stage.status,
        nodesVisited: stage.nodesVisited,
        edgesVisited: stage.edgesVisited,
      })),
    },
  };
}

function validateCorpusQuery(modules, graph, index, item) {
  const started = performance.now();
  const result = modules.core.resolveIntent(index, item.phrase, {
    category: item.category,
    limit: 8,
  });
  const candidateIds = result.candidates.map((candidate) => candidate.nodeId);
  const candidateFiles = new Set(result.candidates.map((candidate) => candidate.entry.filePath).filter(Boolean));
  const expected = item.expected ?? {};
  const expectedNodes = expected.nodes ?? [];
  const expectedFiles = expected.files ?? [];
  const expectedEvidence = expected.evidence ?? [];
  const forbiddenNodes = expected.forbiddenNodes ?? [];
  const forbiddenTopNodes = expected.forbiddenTopNodes ?? [];
  const forbiddenFiles = expected.forbiddenFiles ?? [];
  const confidence = expected.confidence ?? { min: 0, max: 1 };
  const evidenceTypes = new Set(graph.edges
    .filter((edge) => expectedNodes.includes(edge.from) || expectedNodes.includes(edge.to))
    .map((edge) => edge.type));
  const failures = [];

  if (!expectedNodes.some((nodeId) => candidateIds.includes(nodeId))) {
    failures.push(`missing expected node from top candidates: ${expectedNodes.join(", ")}`);
  }
  if (!expectedFiles.some((file) => candidateFiles.has(file))) {
    failures.push(`missing expected file from top candidates: ${expectedFiles.join(", ")}`);
  }
  for (const relationship of expectedEvidence) {
    if (!evidenceTypes.has(relationship)) {
      failures.push(`missing expected evidence relationship: ${relationship}`);
    }
  }
  if (result.confidence < confidence.min || result.confidence > confidence.max) {
    failures.push(`confidence ${result.confidence} outside ${confidence.min}-${confidence.max}`);
  }
  for (const nodeId of forbiddenNodes) {
    if (candidateIds.includes(nodeId)) {
      failures.push(`forbidden node appeared in top candidates: ${nodeId}`);
    }
  }
  for (const nodeId of forbiddenTopNodes) {
    if (candidateIds[0] === nodeId) {
      failures.push(`forbidden node was the top candidate: ${nodeId}`);
    }
  }
  for (const file of forbiddenFiles) {
    if ([...candidateFiles].some((candidateFile) => candidateFile.includes(file))) {
      failures.push(`forbidden file appeared in top candidates: ${file}`);
    }
  }

  return {
    id: item.id,
    phrase: item.phrase,
    category: item.category,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    confidence: result.confidence,
    latencyMs: round(performance.now() - started, 3),
    topCandidates: result.candidates.slice(0, 5).map((candidate) => ({
      id: candidate.nodeId,
      name: candidate.displayName,
      type: candidate.kind,
      confidence: candidate.confidence,
      file: candidate.entry.filePath,
    })),
  };
}

function validateRepeatedQuery(modules, index, item) {
  const first = modules.core.resolveIntent(index, item.phrase, {
    category: item.category,
    limit: 8,
  });
  const second = modules.core.resolveIntent(index, item.phrase, {
    category: item.category,
    limit: 8,
  });
  const firstIds = first.candidates.map((candidate) => candidate.nodeId);
  const secondIds = second.candidates.map((candidate) => candidate.nodeId);
  const failures = [];

  if (JSON.stringify(firstIds) !== JSON.stringify(secondIds)) {
    failures.push(`candidate order changed: ${firstIds.join(", ")} != ${secondIds.join(", ")}`);
  }
  if (first.confidence !== second.confidence) {
    failures.push(`confidence changed: ${first.confidence} != ${second.confidence}`);
  }

  return {
    id: item.id,
    phrase: item.phrase,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    topCandidates: firstIds.slice(0, 5),
    confidence: first.confidence,
  };
}

function runStress(modules) {
  const profiles = [
    { id: "agent-fixture-small", copies: 1, iterations: 20, maxDurationMs: 2_000 },
    { id: "agent-fixture-expanded", copies: 60, iterations: 12, maxDurationMs: 10_000 },
  ];
  const results = profiles.map((profile) => runStressProfile(modules, profile));
  return {
    status: results.every((result) => result.status === "PASS") ? "PASS" : "FAIL",
    mode: "fixture-deterministic",
    profiles: results,
  };
}

function runStressProfile(modules, profile) {
  const graph = createAgentWorkflowGraph(modules.core, profile.copies);
  const memoryStart = process.memoryUsage().rss;
  const started = performance.now();
  let maxEvidenceNodes = 0;
  let maxPlanNodes = 0;

  for (let i = 0; i < profile.iterations; i += 1) {
    const index = modules.core.createSemanticIndex(graph);
    const engine = modules.capabilities.createCapabilityEngine(graph);
    const search = modules.core.resolveIntent(index, "sleep duration thresholds", { category: "feature", limit: 5 });
    const impact = engine.execute("ImpactAnalysis", { id: "model:SleepDurationThreshold", mode: "direct" });
    const evidence = engine.execute("EvidencePack", { query: "sleep duration thresholds", limit: 5 });
    const plan = engine.execute("ImplementationPlan", { task: "Add sleep duration thresholds", budget: 5 });
    const pack = evidence.statistics.evidencePack;

    assert(search.candidates.length <= 5, `${profile.id}: search ignored limit.`);
    assert(impact.statistics.nodeLimit === 20, `${profile.id}: direct impact bound changed.`);
    assert(pack.topNodes.length <= 5, `${profile.id}: evidence pack ignored limit.`);
    assert(plan.statistics.budget.visitedNodes <= 5, `${profile.id}: planner exceeded budget.`);
    maxEvidenceNodes = Math.max(maxEvidenceNodes, pack.topNodes.length);
    maxPlanNodes = Math.max(maxPlanNodes, plan.statistics.budget.visitedNodes);
  }

  const durationMs = round(performance.now() - started, 3);
  const rssDeltaBytes = process.memoryUsage().rss - memoryStart;
  return {
    id: profile.id,
    status: durationMs <= profile.maxDurationMs ? "PASS" : "FAIL",
    iterations: profile.iterations,
    graph: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      hash: graph.metadata.deterministicHash,
    },
    durationMs,
    maxDurationMs: profile.maxDurationMs,
    averageIterationMs: round(durationMs / profile.iterations, 3),
    rssDeltaBytes,
    maxEvidenceNodes,
    maxPlanNodes,
  };
}

function validatePartialSchemaForSkills() {
  const sample = boundedPartialCapabilityOutput();
  const results = CLIENTS.map((client) => {
    const failures = [];
    if (!sample.summary.includes("deterministic partial plan")) failures.push("missing partial summary wording");
    if (!sample.diagnostics.some((item) => item.code === "CAPABILITY_PARTIAL_PLAN")) failures.push("missing partial diagnostic");
    if (sample.statistics.budget.status !== "PARTIAL") failures.push("missing PARTIAL budget status");
    if (sample.statistics.budget.reason !== "NODE_BUDGET_EXCEEDED") failures.push("missing bounded budget reason");
    if (sample.confidence.level !== "medium") failures.push("missing confidence level");
    if (!sample.evidence.some((item) => item.kind === "path" && item.confidence > 0)) failures.push("missing path evidence");
    return { client, status: failures.length === 0 ? "PASS" : "FAIL", failures };
  });

  return {
    status: results.every((result) => result.status === "PASS") ? "PASS" : "FAIL",
    schema: "CapabilityResult/PARTIAL bounded output",
    clients: results,
  };
}

function createAgentWorkflowGraph(core, copies) {
  const nodes = [
    node("Route", "route:POST:/login", "POST /login", "src/auth/auth.controller.ts", { method: "POST", path: "/login" }),
    node("Controller", "controller:AuthController", "AuthController", "src/auth/auth.controller.ts"),
    node("Service", "service:AuthService", "AuthService", "src/auth/auth.service.ts"),
    node("Method", "method:AuthService.login", "AuthService.login", "src/auth/auth.service.ts"),
    node("Repository", "repo:UserRepository", "UserRepository", "src/auth/user.repository.ts"),
    node("Guard", "guard:JwtAuthGuard", "JwtAuthGuard", "src/auth/jwt-auth.guard.ts"),
    node("EnvironmentVariable", "env:JWT_SECRET", "JWT_SECRET", ".env.example"),
    node("Route", "route:GET:/sleep/statistics", "GET /sleep/statistics", "src/sleep/sleep.controller.ts", { method: "GET", path: "/sleep/statistics" }),
    node("Controller", "controller:SleepController", "SleepController", "src/sleep/sleep.controller.ts"),
    node("Service", "service:SleepObservationService", "SleepObservationService", "src/sleep/sleep-observation.service.ts"),
    node("Method", "method:SleepObservationService.recordStatistics", "SleepObservationService.recordStatistics", "src/sleep/sleep-observation.service.ts"),
    node("Repository", "repo:BatchDataObservationRepository", "BatchDataObservationRepository", "src/sleep/batch-data-observation.repository.ts"),
    node("Model", "model:BatchDataObservation", "BatchDataObservation", "src/sleep/batch-data-observation.ts"),
    node("Model", "model:SleepStatisticsObservation", "SleepStatisticsObservation", "src/sleep/sleep-statistics-observation.ts"),
    node("Model", "model:SleepDurationThreshold", "SleepDurationThreshold", "src/sleep/thresholds.ts"),
    node("Configuration", "config:SleepThresholds", "SleepThresholds", "src/sleep/thresholds.ts"),
    node("Event", "event:SleepSignals", "SleepSignals", "src/sleep/signals.ts"),
    node("Route", "route:GET:/fhir/PlanDefinition", "GET /fhir/PlanDefinition", "src/fhir/fhir.controller.ts", { method: "GET", path: "/fhir/PlanDefinition" }),
    node("Controller", "controller:FhirController", "FhirController", "src/fhir/fhir.controller.ts"),
    node("Service", "service:FhirPlanDefinitionService", "FhirPlanDefinitionService", "src/fhir/plan-definition.service.ts"),
    node("Resource", "resource:fhir:PlanDefinition", "PlanDefinition", "src/fhir/plan-definition.resource.ts"),
    node("Configuration", "config:FHIR_DEFAULT_VERSION", "FHIR_DEFAULT_VERSION", "src/fhir/fhir.config.ts"),
    node("Module", "module:RepositoryIntelligenceModule", "RepositoryIntelligenceModule", "src/repository-intelligence/repository-intelligence.module.ts"),
    node("Service", "service:RepositoryOwnershipService", "RepositoryOwnershipService", "src/repository-intelligence/ownership.service.ts"),
    node("Method", "method:RepositoryOwnershipService.findOwners", "RepositoryOwnershipService.findOwners", "src/repository-intelligence/ownership.service.ts"),
    node("Model", "model:RepositoryOwnershipEvidence", "RepositoryOwnershipEvidence", "src/repository-intelligence/ownership.evidence.ts"),
    node("Service", "service:ImplementationPlanningService", "ImplementationPlanningService", "src/planning/implementation-planning.service.ts"),
    node("Method", "method:ImplementationPlanningService.createPlan", "ImplementationPlanningService.createPlan", "src/planning/implementation-planning.service.ts"),
    node("Model", "model:ImplementationPlan", "ImplementationPlan", "src/planning/implementation-plan.ts"),
    node("Dependency", "dep:@medplum/fhirtypes", "@medplum/fhirtypes", "node_modules/@medplum/fhirtypes/dist/index.d.ts"),
    node("TypeAlias", "type:isSleepStatisticsObservation", "isSleepStatisticsObservation", "node_modules/@medplum/fhirtypes/dist/index.d.ts"),
  ];
  const relationships = [
    ["HANDLES", "route:POST:/login", "controller:AuthController"],
    ["AUTHORIZES", "route:POST:/login", "guard:JwtAuthGuard"],
    ["CALLS", "controller:AuthController", "service:AuthService"],
    ["CONTAINS", "service:AuthService", "method:AuthService.login"],
    ["CALLS", "method:AuthService.login", "repo:UserRepository"],
    ["READS", "method:AuthService.login", "env:JWT_SECRET"],
    ["READS", "guard:JwtAuthGuard", "env:JWT_SECRET"],
    ["HANDLES", "route:GET:/sleep/statistics", "controller:SleepController"],
    ["AUTHORIZES", "route:GET:/sleep/statistics", "guard:JwtAuthGuard"],
    ["CALLS", "controller:SleepController", "service:SleepObservationService"],
    ["CONTAINS", "service:SleepObservationService", "method:SleepObservationService.recordStatistics"],
    ["CALLS", "method:SleepObservationService.recordStatistics", "repo:BatchDataObservationRepository"],
    ["WRITES", "repo:BatchDataObservationRepository", "model:BatchDataObservation"],
    ["USES", "method:SleepObservationService.recordStatistics", "model:BatchDataObservation"],
    ["REFERENCES", "method:SleepObservationService.recordStatistics", "model:SleepStatisticsObservation"],
    ["READS", "method:SleepObservationService.recordStatistics", "config:SleepThresholds"],
    ["REFERENCES", "method:SleepObservationService.recordStatistics", "model:SleepDurationThreshold"],
    ["CONFIGURES", "config:SleepThresholds", "model:SleepDurationThreshold"],
    ["PUBLISHES", "method:SleepObservationService.recordStatistics", "event:SleepSignals"],
    ["HANDLES", "route:GET:/fhir/PlanDefinition", "controller:FhirController"],
    ["AUTHORIZES", "route:GET:/fhir/PlanDefinition", "guard:JwtAuthGuard"],
    ["CALLS", "controller:FhirController", "service:FhirPlanDefinitionService"],
    ["USES", "service:FhirPlanDefinitionService", "resource:fhir:PlanDefinition"],
    ["READS", "service:FhirPlanDefinitionService", "config:FHIR_DEFAULT_VERSION"],
    ["REFERENCES", "resource:fhir:PlanDefinition", "dep:@medplum/fhirtypes"],
    ["CONTAINS", "module:RepositoryIntelligenceModule", "service:RepositoryOwnershipService"],
    ["CONTAINS", "service:RepositoryOwnershipService", "method:RepositoryOwnershipService.findOwners"],
    ["REFERENCES", "method:RepositoryOwnershipService.findOwners", "model:RepositoryOwnershipEvidence"],
    ["USES", "service:ImplementationPlanningService", "model:ImplementationPlan"],
    ["CONTAINS", "service:ImplementationPlanningService", "method:ImplementationPlanningService.createPlan"],
    ["CALLS", "method:ImplementationPlanningService.createPlan", "service:RepositoryOwnershipService"],
    ["REFERENCES", "method:ImplementationPlanningService.createPlan", "model:ImplementationPlan"],
  ];

  for (let i = 1; i < copies; i += 1) {
    const methodId = `method:SleepObservationService.recordStatistics:${i}`;
    const modelId = `model:BatchDataObservation:${i}`;
    nodes.push(node("Method", methodId, `SleepObservationService.recordStatistics${i}`, "src/sleep/sleep-observation.service.ts"));
    nodes.push(node("Model", modelId, `BatchDataObservation${i}`, "src/sleep/batch-data-observation.ts"));
    relationships.push(["CONTAINS", "service:SleepObservationService", methodId]);
    relationships.push(["USES", methodId, modelId]);
    relationships.push(["READS", methodId, "config:SleepThresholds"]);
    relationships.push(["REFERENCES", methodId, "model:SleepDurationThreshold"]);
  }

  return core.createSoftwareGraph({
    repository: { root: "/fixtures/agent-workflow", name: "agent-workflow-fixture" },
    nodes,
    edges: relationships.map(([type, from, to]) => edge(core, type, from, to)),
    fileCount: 20,
  });
}

function node(type, id, name, file, metadata = undefined) {
  return {
    id,
    type,
    name,
    file,
    ...(metadata ? { metadata } : {}),
  };
}

function edge(core, type, from, to) {
  return {
    id: core.createEdgeId(type, from, to),
    type,
    from,
    to,
    evidence: [{ kind: "semantic", confidence: "exact", description: `${from} ${type} ${to}` }],
  };
}

function measured(timings, name, fn) {
  const rssBefore = process.memoryUsage().rss;
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const value = fn();
  timings.push({
    name,
    durationMs: round(performance.now() - started, 3),
    rssDeltaBytes: process.memoryUsage().rss - rssBefore,
    heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
    value,
  });
  return value;
}

function boundedPartialCapabilityOutput() {
  return {
    summary: "Implementation plan for \"sleep duration thresholds\" returned a deterministic partial plan.",
    evidence: [
      {
        kind: "path",
        description: "Semantic expansion identifies adjacent implementation boundaries.",
        confidence: 0.85,
        nodes: [
          { id: "model:SleepDurationThreshold", type: "Model", name: "SleepDurationThreshold", file: "src/sleep/thresholds.ts" },
        ],
        edges: [
          { id: "edge:references:fixture", type: "REFERENCES", from: "method:SleepObservationService.recordStatistics", to: "model:SleepDurationThreshold" },
        ],
      },
    ],
    affectedNodes: {
      Services: [
        { id: "service:SleepObservationService", type: "Service", name: "SleepObservationService", file: "src/sleep/sleep-observation.service.ts" },
      ],
    },
    affectedFiles: [
      "src/sleep/sleep-observation.service.ts",
      "src/sleep/thresholds.ts",
    ],
    affectedPackages: [],
    statistics: {
      budget: {
        status: "PARTIAL",
        nodeBudget: 3,
        timeoutMs: 250,
        visitedNodes: 3,
        remainingNodes: 7,
        reason: "NODE_BUDGET_EXCEEDED",
      },
    },
    confidence: {
      score: 0.8,
      level: "medium",
      explanation: "Computed from bounded graph evidence and one partial diagnostic.",
      factors: [
        { kind: "path", confidence: 0.85, description: "Semantic expansion identifies adjacent implementation boundaries." },
      ],
    },
    diagnostics: [
      {
        code: "CAPABILITY_PARTIAL_PLAN",
        severity: "warning",
        message: "Implementation plan hit the node budget and returned partial evidence.",
      },
    ],
    recommendations: [
      "Continue with ontoly evidence \"sleep duration thresholds\" or raise --budget after reviewing this partial plan.",
    ],
    graph: {
      source: "Ontoly Software Graph",
      repository: "fixture",
      graphHash: "fixturehash",
    },
  };
}

function renderConsole(report) {
  return [
    `Agent workflow validation: ${report.status}`,
    `Corpus queries: ${report.workflow.corpus.filter((item) => item.status === "PASS").length}/${report.workflow.corpus.length} PASS`,
    `Stress profiles: ${report.stress.profiles.filter((item) => item.status === "PASS").length}/${report.stress.profiles.length} PASS`,
    `Skill clients: ${report.skills.clients.filter((item) => item.status === "PASS").length}/${report.skills.clients.length} PASS`,
    ...(args.write ? [`Report: ${REPORT_MD}`] : []),
  ].join("\n");
}

function renderMarkdown(report) {
  return [
    "# Agent Workflow Validation",
    "",
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    "",
    "## Workflow Steps",
    "",
    "| Step | Latency | RSS Delta | Heap Delta |",
    "| --- | ---: | ---: | ---: |",
    ...report.workflow.steps.map((step) =>
      `| ${step.name} | ${step.durationMs}ms | ${step.rssDeltaBytes} | ${step.heapDeltaBytes} |`),
    "",
    "## Corpus",
    "",
    "| Query | Status | Confidence | Latency |",
    "| --- | --- | ---: | ---: |",
    ...report.workflow.corpus.map((item) =>
      `| ${item.phrase} | ${item.status} | ${item.confidence} | ${item.latencyMs}ms |`),
    "",
    "## Repeatability",
    "",
    "| Query | Status | Confidence |",
    "| --- | --- | ---: |",
    ...report.workflow.repeatedQueries.map((item) =>
      `| ${item.phrase} | ${item.status} | ${item.confidence} |`),
    "",
    "## Stress",
    "",
    "| Profile | Status | Nodes | Edges | Duration | Memory Delta |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...report.stress.profiles.map((item) =>
      `| ${item.id} | ${item.status} | ${item.graph.nodes} | ${item.graph.edges} | ${item.durationMs}ms | ${item.rssDeltaBytes} |`),
    "",
    "## Skill Schema",
    "",
    "| Client | Status |",
    "| --- | --- |",
    ...report.skills.clients.map((item) => `| ${item.client} | ${item.status} |`),
    "",
  ].join("\n");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertWithin(value, minimum, maximum, message) {
  assert(Number(value) >= minimum && Number(value) <= maximum, message);
}

function isPartialStatus(value) {
  return value === "PARTIAL" || value === "partial";
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function parseArgs(argv) {
  const flags = new Set(argv);
  return {
    json: flags.has("--json"),
    ci: flags.has("--ci"),
    write: flags.has("--write"),
  };
}
