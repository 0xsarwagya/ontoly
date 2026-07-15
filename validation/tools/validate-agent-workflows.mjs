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
const SLEEP_THRESHOLD_QUERY = "sleep duration thresholds";
const IMPLEMENTATION_PLAN_TASK = "Add sleep duration thresholds to batch-data observations";
const THRESHOLD_MODEL_ID = "model:SleepDurationThreshold";
const THRESHOLD_CONFIG_ID = "config:SleepThresholds";
const SLEEP_RECORD_STATISTICS_ID = "method:SleepObservationService.recordStatistics";
const SLEEP_SERVICE_ID = "service:SleepObservationService";
const SLEEP_SERVICE_FILE = "src/sleep/sleep-observation.service.ts";
const THRESHOLDS_FILE = "src/sleep/thresholds.ts";
const SEARCH_LIMIT = 5;
const CORPUS_QUERY_LIMIT = 8;
const EVIDENCE_PACK_LIMIT = 5;
const EVIDENCE_EDGE_LIMIT = 10;
const LOCAL_IMPACT_NODE_LIMIT = 50;
const LOCAL_IMPACT_EDGE_LIMIT = 100;
const DIRECT_IMPACT_NODE_LIMIT = 20;
const PLAN_NODE_BUDGET = 3;
const STRESS_PLAN_NODE_BUDGET = 5;
const PLAN_TIMEOUT_MS = 250;
const PARTIAL_PLAN_DIAGNOSTIC = "CAPABILITY_PARTIAL_PLAN";
const STRESS_PROFILES = [
  { id: "agent-fixture-small", copies: 1, iterations: 20, maxDurationMs: 2_000 },
  { id: "agent-fixture-expanded", copies: 60, iterations: 12, maxDurationMs: 10_000 },
];
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
    modules.core.resolveIntent(index, SLEEP_THRESHOLD_QUERY, { category: "feature", limit: SEARCH_LIMIT }));
  assert(search.candidates.some(isSleepThresholdWorkflowTouchpoint), "Search did not return a sleep threshold workflow touchpoint.");

  const locateId = selectSeedCandidateId(search.candidates);
  const located = measured(timings, "seed-resolution", () => query.findNode(locateId));
  assert(Boolean(located), "Seed Resolution did not resolve the top search candidate.");

  const inspection = measured(timings, "inspect", () => query.neighborhood(located.id, { depth: 1 }));
  assertInspectionIncludesThresholdEvidence(inspection);

  const impact = measured(timings, "impact", () =>
    engine.execute("ImpactAnalysis", { id: located.id, mode: "local" }));
  assertLocalImpactIsBounded(impact);

  const evidence = measured(timings, "evidence-pack", () =>
    engine.execute("EvidencePack", { query: SLEEP_THRESHOLD_QUERY, limit: EVIDENCE_PACK_LIMIT }));
  const pack = evidence.statistics.evidencePack;
  assertEvidencePackIsBounded(pack);

  const plan = measured(timings, "implementation-plan", () =>
    engine.execute("ImplementationPlan", {
      task: IMPLEMENTATION_PLAN_TASK,
      budget: PLAN_NODE_BUDGET,
      timeoutMs: PLAN_TIMEOUT_MS,
    }));
  const planProfile = plan.statistics.profile ?? [];
  const planEvidencePack = plan.statistics.evidencePack ?? {};
  assertImplementationPlanIsBounded(plan, planProfile, planEvidencePack);

  return {
    status: allPassed(corpusResults) && allPassed(repeatedQueries) ? "PASS" : "FAIL",
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

function isSleepThresholdWorkflowTouchpoint(candidate) {
  return [
    THRESHOLD_MODEL_ID,
    SLEEP_RECORD_STATISTICS_ID,
    SLEEP_SERVICE_ID,
  ].includes(candidate.nodeId);
}

function selectSeedCandidateId(candidates) {
  return candidates.find((candidate) =>
    candidate.nodeId === THRESHOLD_MODEL_ID ||
    candidate.nodeId === SLEEP_RECORD_STATISTICS_ID
  )?.nodeId ?? candidates[0]?.nodeId ?? THRESHOLD_MODEL_ID;
}

function assertInspectionIncludesThresholdEvidence(inspection) {
  assert(inspection.nodes.some((node) => node.id === THRESHOLD_CONFIG_ID), "Inspect did not include threshold configuration.");
  assert(inspection.nodes.some((node) => node.id === THRESHOLD_MODEL_ID), "Inspect did not include duration threshold model.");
  assert(inspection.edges.some((edge) => edge.type === "REFERENCES"), "Inspect did not include REFERENCES evidence.");
}

function assertLocalImpactIsBounded(impact) {
  assert(impact.statistics.nodeLimit === LOCAL_IMPACT_NODE_LIMIT, "Impact local mode lost its node bound.");
  assert(impact.statistics.edgeLimit === LOCAL_IMPACT_EDGE_LIMIT, "Impact local mode lost its edge bound.");
  assert(impact.affectedFiles.includes(SLEEP_SERVICE_FILE), "Impact did not include the sleep service file.");
  assertWithin(impact.confidence.score, 0.6, 1, "Impact confidence was outside the expected range.");
}

function assertEvidencePackIsBounded(pack) {
  assert(pack.topNodes.length <= EVIDENCE_PACK_LIMIT, "Evidence Pack returned more nodes than the requested limit.");
  assert(pack.topEdges.length <= EVIDENCE_EDGE_LIMIT, "Evidence Pack returned more edges than the bounded limit.");
  assert(pack.stableIds.includes(THRESHOLD_MODEL_ID), "Evidence Pack did not include the threshold stable id.");
  assert(pack.filesToInspect.includes(THRESHOLDS_FILE), "Evidence Pack did not include the threshold file.");
  assertWithin(pack.confidence.score, 0.6, 1, "Evidence Pack confidence was outside the expected range.");
}

function assertImplementationPlanIsBounded(plan, profile, evidencePack) {
  assert(isPartialStatus(plan.statistics.budget.status), "Implementation Plan did not report partial/PARTIAL status.");
  assert(plan.statistics.budget.visitedNodes <= PLAN_NODE_BUDGET, "Implementation Plan exceeded its node budget.");
  assert(plan.diagnostics.some((item) => item.code === PARTIAL_PLAN_DIAGNOSTIC), "Implementation Plan did not emit partial diagnostic.");
  assertImplementationPlanStages(profile);
  assert(evidencePack.stableIds?.includes(THRESHOLD_MODEL_ID), "Implementation Plan evidence pack missed the threshold stable id.");
  assert(evidencePack.filesToInspect?.includes(THRESHOLDS_FILE), "Implementation Plan evidence pack missed the threshold file.");
  assert(evidencePack.topNodes.length <= evidencePack.limits.nodes, "Implementation Plan evidence pack exceeded node limits.");
  assert(evidencePack.topEdges.length <= evidencePack.limits.edges, "Implementation Plan evidence pack exceeded edge limits.");
  assert(plan.statistics.repositoryIntelligence?.scopedFiles?.includes(THRESHOLDS_FILE), "Implementation Plan did not include repository intelligence scoped files.");
}

function assertImplementationPlanStages(profile) {
  const stageNames = profile.map((stage) => stage.name);
  assert(
    JSON.stringify(stageNames) === JSON.stringify(EXPECTED_IMPLEMENTATION_PLAN_STAGES),
    `Implementation Plan stages changed: ${stageNames.join(" -> ")}`,
  );
  assert(profile.every(isProfiledPlanStage), "Implementation Plan stages are not profiled with status and duration.");
}

function isProfiledPlanStage(stage) {
  return Number.isFinite(stage.durationMs) &&
    stage.durationMs >= 0 &&
    (stage.status === "complete" || stage.status === "partial");
}

function validateCorpusQuery(modules, graph, index, item) {
  const started = performance.now();
  const result = modules.core.resolveIntent(index, item.phrase, {
    category: item.category,
    limit: CORPUS_QUERY_LIMIT,
  });
  const candidateIds = result.candidates.map((candidate) => candidate.nodeId);
  const candidateFiles = new Set(result.candidates.map((candidate) => candidate.entry.filePath).filter(Boolean));
  const expected = item.expected ?? {};
  const failures = collectCorpusFailures({
    graph,
    expected,
    result,
    candidateIds,
    candidateFiles,
  });

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

function collectCorpusFailures({ graph, expected, result, candidateIds, candidateFiles }) {
  return [
    ...missingExpectedNodeFailures(expected.nodes ?? [], candidateIds),
    ...missingExpectedFileFailures(expected.files ?? [], candidateFiles),
    ...missingExpectedEvidenceFailures(graph, expected.nodes ?? [], expected.evidence ?? []),
    ...confidenceFailures(result.confidence, expected.confidence ?? { min: 0, max: 1 }),
    ...forbiddenNodeFailures(expected.forbiddenNodes ?? [], candidateIds),
    ...forbiddenTopNodeFailures(expected.forbiddenTopNodes ?? [], candidateIds),
    ...forbiddenFileFailures(expected.forbiddenFiles ?? [], candidateFiles),
  ];
}

function missingExpectedNodeFailures(expectedNodes, candidateIds) {
  if (expectedNodes.some((nodeId) => candidateIds.includes(nodeId))) {
    return [];
  }
  return [`missing expected node from top candidates: ${expectedNodes.join(", ")}`];
}

function missingExpectedFileFailures(expectedFiles, candidateFiles) {
  if (expectedFiles.some((file) => candidateFiles.has(file))) {
    return [];
  }
  return [`missing expected file from top candidates: ${expectedFiles.join(", ")}`];
}

function missingExpectedEvidenceFailures(graph, expectedNodes, expectedEvidence) {
  const evidenceTypes = relationshipTypesTouchingExpectedNodes(graph, expectedNodes);
  return expectedEvidence
    .filter((relationship) => !evidenceTypes.has(relationship))
    .map((relationship) => `missing expected evidence relationship: ${relationship}`);
}

function relationshipTypesTouchingExpectedNodes(graph, expectedNodes) {
  return new Set(graph.edges
    .filter((edge) => expectedNodes.includes(edge.from) || expectedNodes.includes(edge.to))
    .map((edge) => edge.type));
}

function confidenceFailures(confidence, expectedRange) {
  if (confidence >= expectedRange.min && confidence <= expectedRange.max) {
    return [];
  }
  return [`confidence ${confidence} outside ${expectedRange.min}-${expectedRange.max}`];
}

function forbiddenNodeFailures(forbiddenNodes, candidateIds) {
  return forbiddenNodes
    .filter((nodeId) => candidateIds.includes(nodeId))
    .map((nodeId) => `forbidden node appeared in top candidates: ${nodeId}`);
}

function forbiddenTopNodeFailures(forbiddenTopNodes, candidateIds) {
  return forbiddenTopNodes
    .filter((nodeId) => candidateIds[0] === nodeId)
    .map((nodeId) => `forbidden node was the top candidate: ${nodeId}`);
}

function forbiddenFileFailures(forbiddenFiles, candidateFiles) {
  const files = [...candidateFiles];
  return forbiddenFiles
    .filter((file) => files.some((candidateFile) => candidateFile.includes(file)))
    .map((file) => `forbidden file appeared in top candidates: ${file}`);
}

function validateRepeatedQuery(modules, index, item) {
  const first = modules.core.resolveIntent(index, item.phrase, {
    category: item.category,
    limit: CORPUS_QUERY_LIMIT,
  });
  const second = modules.core.resolveIntent(index, item.phrase, {
    category: item.category,
    limit: CORPUS_QUERY_LIMIT,
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
  const results = STRESS_PROFILES.map((profile) => runStressProfile(modules, profile));
  return {
    status: allPassed(results) ? "PASS" : "FAIL",
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
    const search = modules.core.resolveIntent(index, SLEEP_THRESHOLD_QUERY, { category: "feature", limit: SEARCH_LIMIT });
    const impact = engine.execute("ImpactAnalysis", { id: THRESHOLD_MODEL_ID, mode: "direct" });
    const evidence = engine.execute("EvidencePack", { query: SLEEP_THRESHOLD_QUERY, limit: EVIDENCE_PACK_LIMIT });
    const plan = engine.execute("ImplementationPlan", { task: "Add sleep duration thresholds", budget: STRESS_PLAN_NODE_BUDGET });
    const pack = evidence.statistics.evidencePack;

    assert(search.candidates.length <= SEARCH_LIMIT, `${profile.id}: search ignored limit.`);
    assert(impact.statistics.nodeLimit === DIRECT_IMPACT_NODE_LIMIT, `${profile.id}: direct impact bound changed.`);
    assert(pack.topNodes.length <= EVIDENCE_PACK_LIMIT, `${profile.id}: evidence pack ignored limit.`);
    assert(plan.statistics.budget.visitedNodes <= STRESS_PLAN_NODE_BUDGET, `${profile.id}: planner exceeded budget.`);
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
    const failures = validatePartialCapabilityShape(sample);
    return { client, status: failures.length === 0 ? "PASS" : "FAIL", failures };
  });

  return {
    status: allPassed(results) ? "PASS" : "FAIL",
    schema: "CapabilityResult/PARTIAL bounded output",
    clients: results,
  };
}

function validatePartialCapabilityShape(sample) {
  const failures = [];
  if (!sample.summary.includes("deterministic partial plan")) failures.push("missing partial summary wording");
  if (!sample.diagnostics.some((item) => item.code === PARTIAL_PLAN_DIAGNOSTIC)) failures.push("missing partial diagnostic");
  if (sample.statistics.budget.status !== "PARTIAL") failures.push("missing PARTIAL budget status");
  if (sample.statistics.budget.reason !== "NODE_BUDGET_EXCEEDED") failures.push("missing bounded budget reason");
  if (sample.confidence.level !== "medium") failures.push("missing confidence level");
  if (!sample.evidence.some((item) => item.kind === "path" && item.confidence > 0)) failures.push("missing path evidence");
  return failures;
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
          { id: THRESHOLD_MODEL_ID, type: "Model", name: "SleepDurationThreshold", file: THRESHOLDS_FILE },
        ],
        edges: [
          { id: "edge:references:fixture", type: "REFERENCES", from: SLEEP_RECORD_STATISTICS_ID, to: THRESHOLD_MODEL_ID },
        ],
      },
    ],
    affectedNodes: {
      Services: [
        { id: SLEEP_SERVICE_ID, type: "Service", name: "SleepObservationService", file: SLEEP_SERVICE_FILE },
      ],
    },
    affectedFiles: [
      SLEEP_SERVICE_FILE,
      THRESHOLDS_FILE,
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
        code: PARTIAL_PLAN_DIAGNOSTIC,
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

function allPassed(results) {
  return results.every((result) => result.status === "PASS");
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
