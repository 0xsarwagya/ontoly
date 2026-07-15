#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { arch, cpus, homedir, platform, release } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const VALIDATION_ROOT = join(PROJECT_ROOT, "validation");
const CORPUS_ROOT = join(VALIDATION_ROOT, "corpus");
const REGISTRY_PATH = join(VALIDATION_ROOT, "repositories.json");
const LAB_BASELINE_PATH = join(VALIDATION_ROOT, "lab-regression-baseline.json");
const LAB_CURRENT_PATH = join(VALIDATION_ROOT, "lab-regression-current.json");
const LAB_REGRESSION_PATH = join(VALIDATION_ROOT, "lab-regression.json");
const PERFORMANCE_ROOT = join(VALIDATION_ROOT, "performance");
const WEBSITE_ASSETS_ROOT = join(VALIDATION_ROOT, "website-assets");
const BADGES_ROOT = join(VALIDATION_ROOT, "badges");
const RELEASE_GATES_ROOT = join(VALIDATION_ROOT, "release-gates");

const CORPUS_GROUPS = [
  "typescript",
  "nestjs",
  "react",
  "next",
  "express",
  "hono",
  "libraries",
  "monorepos",
  "performance",
];

const STRESS_PROFILES = [
  { id: "files-50k", files: 50_000, nodes: 100_000, edges: 180_000 },
  { id: "files-100k", files: 100_000, nodes: 200_000, edges: 360_000 },
  { id: "files-250k", files: 250_000, nodes: 500_000, edges: 900_000 },
  { id: "files-500k", files: 500_000, nodes: 1_000_000, edges: 1_800_000 },
  { id: "nodes-1m", files: 125_000, nodes: 1_000_000, edges: 2_000_000 },
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
  await ensureLabLayout();
  const registry = await loadRegistry();
  await ensureCorpusEntries(registry);

  switch (args.command) {
    case "validate":
      await validateCommand(registry);
      return;

    case "benchmark":
      await benchmarkCommand(registry);
      return;

    case "dashboard":
      await dashboardCommand(registry);
      return;

    case "badges":
      await badgesCommand(registry);
      return;

    case "gates":
      await gatesCommand(registry);
      return;

    case "stress":
      await stressCommand();
      return;

    default:
      throw new Error(`Unknown validation lab command: ${args.command}`);
  }
}

async function validateCommand(registry) {
  const startedAt = new Date().toISOString();
  const target = args.target ?? "all";
  const selected = selectRepositories(registry, target);

  if (selected.length === 0) {
    throw new Error(`No repositories matched validation target "${target}".`);
  }

  const previousBaseline = await readJsonIfExists(LAB_BASELINE_PATH);
  const results = [];

  for (const repository of selected) {
    results.push(await validateRepository(repository, {
      clone: args.clone,
      install: args.install,
      target,
      determinism: !args.noDeterminism && (args.determinism || repository.priority === "critical"),
    }));
  }

  const aggregate = await createAggregate(results, registry, previousBaseline, startedAt);
  const shouldPersistAggregate = target === "all";
  if (shouldPersistAggregate) {
    await writeLabArtifacts(aggregate);
  }

  if (!previousBaseline && shouldPersistAggregate) {
    await writeJson(LAB_BASELINE_PATH, aggregate.regression.current);
  }

  if (args.json) {
    writeOut(JSON.stringify(aggregate, null, 2));
  } else {
    writeOut(renderConsoleSummary(aggregate, shouldPersistAggregate));
  }

  if (args.ci && aggregate.releaseGates.status === "FAIL") {
    process.exitCode = 1;
  }
}

async function benchmarkCommand(registry) {
  if (args.target === "performance" || !args.target) {
    const latest = await loadLatestLabResults(registry);
    const stress = await runStressSuite();
    const aggregate = await createAggregate(latest, registry, await readJsonIfExists(LAB_BASELINE_PATH), new Date().toISOString(), stress);
    await writePerformanceArtifacts(aggregate);
    await writeDashboardArtifacts(aggregate);
    if (args.json) {
      writeOut(JSON.stringify(aggregate.performance, null, 2));
      return;
    }
    writeOut(renderPerformanceMarkdown(aggregate));
    return;
  }

  await validateCommand(registry);
}

async function dashboardCommand(registry) {
  const latest = await loadLatestLabResults(registry);
  const aggregate = await createAggregate(latest, registry, await readJsonIfExists(LAB_BASELINE_PATH), new Date().toISOString());
  await writeDashboardArtifacts(aggregate);
  writeOut(args.json ? JSON.stringify(aggregate.dashboard, null, 2) : `Dashboard: ${join(VALIDATION_ROOT, "dashboard.md")}`);
}

async function badgesCommand(registry) {
  const latest = await loadLatestLabResults(registry);
  const aggregate = await createAggregate(latest, registry, await readJsonIfExists(LAB_BASELINE_PATH), new Date().toISOString());
  await writeBadgeArtifacts(aggregate);
  writeOut(args.json ? JSON.stringify(aggregate.badges, null, 2) : `Badges: ${BADGES_ROOT}`);
}

async function gatesCommand(registry) {
  const latest = await loadLatestLabResults(registry);
  const aggregate = await createAggregate(latest, registry, await readJsonIfExists(LAB_BASELINE_PATH), new Date().toISOString());
  await writeReleaseGateArtifacts(aggregate);
  writeOut(args.json ? JSON.stringify(aggregate.releaseGates, null, 2) : renderReleaseGateMarkdown(aggregate.releaseGates));
  if (args.ci && aggregate.releaseGates.status === "FAIL") {
    process.exitCode = 1;
  }
}

async function stressCommand() {
  const stress = await runStressSuite();
  await writeJson(join(PERFORMANCE_ROOT, "stress.json"), stress);
  await writeFile(join(PERFORMANCE_ROOT, "stress.md"), renderStressMarkdown(stress), "utf8");
  writeOut(args.json ? JSON.stringify(stress, null, 2) : renderStressMarkdown(stress));
}

async function validateRepository(repository, options) {
  const corpus = corpusPaths(repository);
  await ensureCorpusEntry(repository);

  const resolved = await resolveRepository(repository, options);
  const base = {
    id: repository.id,
    name: repository.name,
    category: repository.category,
    corpusPath: repository.corpusPath,
    frameworks: repository.frameworks,
    priority: repository.priority,
    expected: expectedFromRepository(repository),
    startedAt: new Date().toISOString(),
  };

  if (resolved.status !== "available") {
    const skipped = {
      ...base,
      status: "SKIPPED",
      reason: resolved.reason,
      source: resolved,
      install: { status: "SKIPPED", reason: "Repository was not available." },
      performance: null,
      graph: null,
      coverage: null,
      trust: null,
      releaseGate: {
        status: repository.default === false ? "SKIPPED" : "WARN",
        failures: [],
        warnings: [resolved.reason],
      },
      completedAt: new Date().toISOString(),
    };
    await writeRepositoryResult(repository, skipped);
    return skipped;
  }

  const install = await installDependencies(repository, resolved, options);

  try {
    const measured = await measureRepository(repository, resolved.path, options);
    const result = {
      ...base,
      status: "PASS",
      source: resolved,
      install,
      ...measured,
      completedAt: new Date().toISOString(),
    };
    result.releaseGate = evaluateRepositoryGates(repository, result);
    result.status = result.releaseGate.status === "FAIL" ? "FAIL" : "PASS";
    await writeRepositoryResult(repository, result);
    return result;
  } catch (error) {
    const failed = {
      ...base,
      status: "FAIL",
      source: resolved,
      install,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
      performance: null,
      graph: null,
      coverage: null,
      trust: null,
      releaseGate: {
        status: "FAIL",
        failures: ["Compiler crashed before producing a validation result."],
        warnings: [],
      },
      completedAt: new Date().toISOString(),
    };
    await writeRepositoryResult(repository, failed);
    return failed;
  }
}

async function measureRepository(repository, repoPath, options) {
  const modules = await loadOntolyModules();
  const checkpoints = [];
  const cpuStart = process.cpuUsage();
  const totalStart = performance.now();
  checkpoints.push(memoryCheckpoint("start"));

  const discovery = await timed("repositoryDiscoveryMs", async () => modules.compiler.discoverRepository(repoPath));
  checkpoints.push(memoryCheckpoint("after-discovery"));

  const semanticModel = await timed("semanticModelGenerationMs", async () => modules.typescript.analyzeTypeScriptProject({ root: repoPath }));
  checkpoints.push(memoryCheckpoint("after-semantic-model"));

  const framework = await timed("frameworkAnalysisMs", async () => {
    const registry = modules.semantic.createDefaultFrameworkRegistry();
    return registry.detect(semanticModel.value);
  });
  checkpoints.push(memoryCheckpoint("after-framework-analysis"));

  const determinismInputBefore = options.determinism
    ? await timed("determinismInputBeforeMs", async () => modules.compiler.createSourceInventory(repoPath))
    : null;

  const graphBuild = await timed("semanticGenerationMs", async () => modules.compiler.buildSoftwareGraphWithArtifacts({
    root: repoPath,
    write: false,
    mode: "clean",
    passes: [
      modules.compiler.createRepositoryIntelligencePass(),
      modules.parserTypescript.createTypeScriptFrontendPass(),
      modules.parserOpenApi.createOpenApiFrontendPass(),
    ],
  }));
  checkpoints.push(memoryCheckpoint("after-graph-build"));

  if (!graphBuild.value.graph) {
    throw new Error(`Compiler did not produce a graph for ${repository.id}.`);
  }

  const graph = graphBuild.value.graph;
  const validation = await timed("validationMs", async () => modules.compiler.validateCoreGraph(graph));
  const coverage = await timed("coverageAnalysisMs", async () => modules.analyzers.analyzeSemanticCoverage(graph));
  const queryIndex = await timed("queryIndexingMs", async () => {
    const query = modules.query.createQueryEngine(graph);
    const stats = query.stats();
    const lookupStart = performance.now();
    query.findNodes().slice(0, 10).forEach((node) => query.findNode(node.id));
    const simpleLookupMs = performance.now() - lookupStart;
    const traversalStart = performance.now();
    const firstNode = query.findNodes()[0];
    if (firstNode) {
      query.related(firstNode.id);
    }
    const traversalMs = performance.now() - traversalStart;
    return { stats, simpleLookupMs: round(simpleLookupMs, 4), traversalMs: round(traversalMs, 4) };
  });
  const agentWorkflow = await timed("agentWorkflowMs", async () => measureAgentWorkflow(modules, graph));
  checkpoints.push(memoryCheckpoint("after-agent-workflow"));

  let deterministicHash = null;
  let deterministic = null;
  if (options.determinism) {
    const second = await timed("determinismRebuildMs", async () => modules.compiler.buildSoftwareGraphWithArtifacts({
      root: repoPath,
      write: false,
      mode: "clean",
      passes: [
        modules.compiler.createRepositoryIntelligencePass(),
        modules.parserTypescript.createTypeScriptFrontendPass(),
        modules.parserOpenApi.createOpenApiFrontendPass(),
      ],
    }));
    const determinismInputAfter = await timed("determinismInputAfterMs", async () => modules.compiler.createSourceInventory(repoPath));
    const inputHashBefore = sourceInventoryHash(determinismInputBefore?.value);
    const inputHashAfter = sourceInventoryHash(determinismInputAfter.value);
    const inputStable = inputHashBefore === inputHashAfter;
    deterministicHash = second.value.graph?.metadata.deterministicHash ?? null;
    deterministic = {
      status: inputStable ? (deterministicHash === graph.metadata.deterministicHash ? "PASS" : "FAIL") : "UNSTABLE_INPUT",
      firstHash: graph.metadata.deterministicHash,
      secondHash: deterministicHash,
      inputStable,
      inputHashBefore,
      inputHashAfter,
      rebuildMs: round(second.durationMs, 3),
      inputCheckMs: round((determinismInputBefore?.durationMs ?? 0) + determinismInputAfter.durationMs, 3),
    };
  }

  const serialized = await timed("graphSerializationMs", async () => `${JSON.stringify(graph, null, 2)}\n`);
  checkpoints.push(memoryCheckpoint("after-serialization"));
  const cpu = process.cpuUsage(cpuStart);
  const totalDurationMs = performance.now() - totalStart;
  const analysisDurationMs = discovery.durationMs +
    semanticModel.durationMs +
    framework.durationMs +
    graphBuild.durationMs +
    serialized.durationMs +
    validation.durationMs +
    coverage.durationMs +
    queryIndex.durationMs;
  const graphSizeBytes = Buffer.byteLength(serialized.value);
  const graphStatistics = graphStatisticsFromGraph(graph, graphSizeBytes);
  const performanceResult = {
    repositoryDiscoveryMs: round(discovery.durationMs, 3),
    semanticModelGenerationMs: round(semanticModel.durationMs, 3),
    frameworkAnalysisMs: round(framework.durationMs, 3),
    semanticGenerationMs: round(graphBuild.durationMs, 3),
    graphSerializationMs: round(serialized.durationMs, 3),
    validationMs: round(validation.durationMs, 3),
    coverageAnalysisMs: round(coverage.durationMs, 3),
    queryIndexingMs: round(queryIndex.durationMs, 3),
    queryLatencyMs: queryIndex.value.simpleLookupMs,
    traversalLatencyMs: queryIndex.value.traversalMs,
    agentWorkflowMs: round(agentWorkflow.durationMs, 3),
    agentWorkflow: agentWorkflow.value,
    searchLatencyMs: agentWorkflow.value.searchLatencyMs,
    locateLatencyMs: agentWorkflow.value.locateLatencyMs,
    inspectLatencyMs: agentWorkflow.value.inspectLatencyMs,
    impactLatencyMs: agentWorkflow.value.impactLatencyMs,
    evidencePackLatencyMs: agentWorkflow.value.evidencePackLatencyMs,
    implementationPlanLatencyMs: agentWorkflow.value.implementationPlanLatencyMs,
    agentWorkflowMemoryBytes: agentWorkflow.value.peakMemoryBytes,
    analysisDurationMs: round(analysisDurationMs, 3),
    totalDurationMs: round(totalDurationMs, 3),
    peakMemoryBytes: Math.max(...checkpoints.map((checkpoint) => checkpoint.rssBytes)),
    memoryCheckpoints: checkpoints,
    cpu: {
      userMicros: cpu.user,
      systemMicros: cpu.system,
      coresAvailable: cpus().length,
    },
    graphSizeBytes,
  };

  const corpus = corpusPaths(repository);
  await Promise.all([
    writeFile(join(corpus.results, "SoftwareGraph.json"), serialized.value, "utf8"),
    writeJson(join(corpus.results, "coverage.json"), coverage.value),
    writeJson(join(corpus.results, "graph-validation.json"), validation.value),
    writeJson(join(corpus.results, "frameworks.json"), {
      repository: repository.id,
      detections: framework.value,
      detected: framework.value.filter((detection) => detection.detected),
    }),
    writeJson(join(corpus.results, "statistics.json"), graphStatistics),
    writeJson(join(corpus.results, "performance.json"), performanceResult),
  ]);

  return {
    graph: graphStatistics,
    graphHash: graph.metadata.deterministicHash,
    graphValidation: validation.value,
    diagnostics: {
      compiler: graphBuild.value.diagnostics.length,
      graph: graph.diagnostics.length,
      validationIssues: validation.value.issues?.length ?? 0,
      coverageWarnings: coverage.value.diagnostics?.length ?? 0,
    },
    coverage: coverage.value.summary?.coverage ?? null,
    trust: coverage.value.summary?.trustworthiness ?? null,
    semantic: await readSemanticSummary(repository.id),
    frameworkDetections: {
      expected: repository.frameworks,
      detected: framework.value.filter((detection) => detection.detected).map((detection) => detection.framework),
    },
    deterministic,
    performance: performanceResult,
  };
}

async function installDependencies(repository, resolved, options) {
  if (!options.install) {
    return {
      status: "SKIPPED",
      reason: "Dependency installation is opt-in for validation runs. The compiler does not require installed dependencies.",
    };
  }

  if (resolved.source === "local") {
    return {
      status: "SKIPPED",
      reason: "Local source repositories are never modified by the validation runner.",
    };
  }

  const packageJsonPath = join(resolved.path, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { status: "SKIPPED", reason: "No package.json was found." };
  }

  const command = packageManagerCommand(resolved.path);
  const started = performance.now();
  const result = spawnSync(command.bin, command.args, {
    cwd: resolved.path,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });

  return {
    status: result.status === 0 ? "PASS" : "FAIL",
    command,
    durationMs: round(performance.now() - started, 3),
    exitCode: result.status,
    stdout: result.stdout?.slice(-4000) ?? "",
    stderr: result.stderr?.slice(-4000) ?? "",
  };
}

async function resolveRepository(repository, options) {
  const localPath = repository.repository && !isRemote(repository.repository)
    ? expandHome(repository.repository)
    : null;
  if (localPath && existsSync(localPath)) {
    return { status: "available", source: "local", path: localPath, cloned: false };
  }

  const checkoutPath = join(CORPUS_ROOT, repository.corpusPath, "repository");
  if (existsSync(checkoutPath)) {
    return { status: "available", source: "corpus-clone", path: checkoutPath, cloned: false };
  }

  if (isRemote(repository.repository) && (options.clone || options.target !== "all")) {
    await mkdir(dirname(checkoutPath), { recursive: true });
    const result = spawnSync("git", [
      "clone",
      "--depth",
      "1",
      "--filter=blob:none",
      repository.repository,
      checkoutPath,
    ], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    });

    if (result.status === 0) {
      return { status: "available", source: "corpus-clone", path: checkoutPath, cloned: true };
    }

    return {
      status: "unavailable",
      source: "remote",
      path: null,
      reason: `Clone failed for ${repository.repository}: ${result.stderr || result.stdout}`,
    };
  }

  return {
    status: "unavailable",
    source: isRemote(repository.repository) ? "remote" : "local",
    path: null,
    reason: isRemote(repository.repository)
      ? "Remote repository is cataloged but not cloned. Run an explicit target or pass --clone."
      : `Repository path does not exist: ${localPath}`,
  };
}

async function createAggregate(results, registry, previousBaseline, startedAt, stress = null) {
  const releaseGates = evaluateReleaseGates(results, previousBaseline);
  const performance = performanceSummary(results, stress);
  const dashboard = dashboardModel(results, registry, performance, releaseGates);
  const badges = badgeModel(results, releaseGates);
  const regressionCurrent = regressionSnapshot(results, performance);
  const regression = compareRegression(previousBaseline, regressionCurrent);

  return {
    generatedAt: new Date().toISOString(),
    startedAt,
    repositories: results,
    performance,
    releaseGates,
    regression: {
      ...regression,
      current: regressionCurrent,
    },
    dashboard,
    badges,
  };
}

async function writeLabArtifacts(aggregate) {
  await Promise.all([
    writeJson(join(VALIDATION_ROOT, "lab-summary.json"), aggregate),
    writeFile(join(VALIDATION_ROOT, "lab-summary.md"), renderLabSummaryMarkdown(aggregate), "utf8"),
    writeJson(LAB_CURRENT_PATH, aggregate.regression.current),
    writeJson(LAB_REGRESSION_PATH, aggregate.regression),
    writePerformanceArtifacts(aggregate),
    writeDashboardArtifacts(aggregate),
    writeBadgeArtifacts(aggregate),
    writeReleaseGateArtifacts(aggregate),
    writeWebsiteAssets(aggregate),
  ]);
}

async function writeRepositoryResult(repository, result) {
  const corpus = corpusPaths(repository);
  await mkdir(corpus.results, { recursive: true });
  await Promise.all([
    writeJson(join(corpus.results, "latest.json"), result),
    writeJson(join(corpus.results, `${safeTimestamp(result.startedAt)}.json`), result),
    writeFile(join(corpus.results, "report.md"), renderRepositoryReport(result), "utf8"),
  ]);
}

async function writePerformanceArtifacts(aggregate) {
  await mkdir(PERFORMANCE_ROOT, { recursive: true });
  await Promise.all([
    writeJson(join(PERFORMANCE_ROOT, "performance.json"), aggregate.performance),
    writeFile(join(PERFORMANCE_ROOT, "performance.md"), renderPerformanceMarkdown(aggregate), "utf8"),
    writeJson(join(PERFORMANCE_ROOT, "top-fastest.json"), aggregate.performance.rankings.fastest),
    writeJson(join(PERFORMANCE_ROOT, "largest-graphs.json"), aggregate.performance.rankings.largestGraphs),
    writeJson(join(PERFORMANCE_ROOT, "most-relationships.json"), aggregate.performance.rankings.mostRelationships),
    writeJson(join(PERFORMANCE_ROOT, "largest-workspaces.json"), aggregate.performance.rankings.largestWorkspaces),
    writeJson(join(PERFORMANCE_ROOT, "coverage-rankings.json"), aggregate.performance.rankings.coverage),
    writeJson(join(PERFORMANCE_ROOT, "memory-rankings.json"), aggregate.performance.rankings.memory),
    writeFile(join(PERFORMANCE_ROOT, "top-reports.md"), renderTopReportsMarkdown(aggregate.performance), "utf8"),
  ]);
  if (aggregate.performance.stress) {
    await writeJson(join(PERFORMANCE_ROOT, "stress.json"), aggregate.performance.stress);
    await writeFile(join(PERFORMANCE_ROOT, "stress.md"), renderStressMarkdown(aggregate.performance.stress), "utf8");
  }
}

async function writeDashboardArtifacts(aggregate) {
  await Promise.all([
    writeJson(join(VALIDATION_ROOT, "dashboard.json"), aggregate.dashboard),
    writeFile(join(VALIDATION_ROOT, "dashboard.md"), renderDashboardMarkdown(aggregate), "utf8"),
    writeFile(join(VALIDATION_ROOT, "dashboard.html"), renderDashboardHtml(aggregate), "utf8"),
  ]);
}

async function writeBadgeArtifacts(aggregate) {
  await mkdir(BADGES_ROOT, { recursive: true });
  const writes = [writeJson(join(BADGES_ROOT, "index.json"), aggregate.badges)];
  for (const badge of aggregate.badges.items) {
    writes.push(writeJson(join(BADGES_ROOT, `${badge.id}.json`), badge));
    writes.push(writeFile(join(BADGES_ROOT, `${badge.id}.svg`), renderBadgeSvg(badge.label, badge.message, badge.color), "utf8"));
  }
  await Promise.all(writes);
}

async function writeReleaseGateArtifacts(aggregate) {
  await mkdir(RELEASE_GATES_ROOT, { recursive: true });
  await Promise.all([
    writeJson(join(RELEASE_GATES_ROOT, "report.json"), aggregate.releaseGates),
    writeFile(join(RELEASE_GATES_ROOT, "report.md"), renderReleaseGateMarkdown(aggregate.releaseGates), "utf8"),
  ]);
}

async function writeWebsiteAssets(aggregate) {
  await mkdir(WEBSITE_ASSETS_ROOT, { recursive: true });
  await Promise.all([
    writeJson(join(WEBSITE_ASSETS_ROOT, "repository-cards.json"), aggregate.dashboard.repositoryCards),
    writeJson(join(WEBSITE_ASSETS_ROOT, "coverage-charts.json"), aggregate.dashboard.coverageCharts),
    writeJson(join(WEBSITE_ASSETS_ROOT, "performance-charts.json"), aggregate.dashboard.performanceCharts),
    writeJson(join(WEBSITE_ASSETS_ROOT, "validation-tables.json"), aggregate.dashboard.validationTables),
    writeJson(join(WEBSITE_ASSETS_ROOT, "benchmark-tables.json"), aggregate.dashboard.benchmarkTables),
    writeJson(join(WEBSITE_ASSETS_ROOT, "framework-support-matrix.json"), aggregate.dashboard.frameworkSupportMatrix),
  ]);
}

function evaluateRepositoryGates(repository, result) {
  const failures = [];
  const warnings = [];
  const expected = expectedFromRepository(repository);

  if (result.coverage !== null && result.coverage < expected.semanticCoverage) {
    failures.push(`Semantic coverage ${result.coverage} is below expected ${expected.semanticCoverage}.`);
  }
  if (result.trust !== null && result.trust < expected.trust) {
    failures.push(`Graph trust ${result.trust} is below expected ${expected.trust}.`);
  }
  if ((result.diagnostics?.graph ?? 0) > expected.diagnosticsMax) {
    failures.push(`Unexpected diagnostics: ${result.diagnostics.graph} exceeds ${expected.diagnosticsMax}.`);
  }
  if (result.deterministic?.status === "FAIL") {
    failures.push("Graph determinism changed across identical rebuilds.");
  }
  if (result.deterministic?.status === "UNSTABLE_INPUT") {
    warnings.push(
      `Repository input changed during determinism check (${result.deterministic.inputHashBefore} -> ${result.deterministic.inputHashAfter}).`,
    );
  }
  if (result.graph?.nodes < expected.nodeRange.min || result.graph?.nodes > expected.nodeRange.max) {
    warnings.push(`Node count ${result.graph?.nodes} is outside expected range ${expected.nodeRange.min}-${expected.nodeRange.max}.`);
  }
  if (result.graph?.edges < expected.edgeRange.min || result.graph?.edges > expected.edgeRange.max) {
    warnings.push(`Edge count ${result.graph?.edges} is outside expected range ${expected.edgeRange.min}-${expected.edgeRange.max}.`);
  }

  return {
    status: failures.length > 0 ? "FAIL" : "PASS",
    failures,
    warnings,
  };
}

function evaluateReleaseGates(results, previousBaseline) {
  const failures = [];
  const warnings = [];
  const improvements = [];
  const previousById = new Map((previousBaseline?.repositories ?? []).map((repo) => [repo.id, repo]));

  for (const result of results) {
    if (result.status === "SKIPPED") {
      if (result.priority === "critical") warnings.push(`${result.id}: skipped critical repository.`);
      continue;
    }

    if (result.status === "FAIL") {
      failures.push(`${result.id}: compiler validation failed.`);
    }

    for (const failure of result.releaseGate?.failures ?? []) {
      failures.push(`${result.id}: ${failure}`);
    }
    for (const warning of result.releaseGate?.warnings ?? []) {
      warnings.push(`${result.id}: ${warning}`);
    }

    const previous = previousById.get(result.id);
    if (!previous) continue;

    const coverageDrop = numericDrop(previous.coverage, result.coverage);
    const trustDrop = numericDrop(previous.trust, result.trust);
    const previousPerformanceDuration = previous.performance?.analysisDurationMs;
    const currentPerformanceDuration = result.performance?.analysisDurationMs;
    const canComparePerformance = Number.isFinite(previousPerformanceDuration) && Number.isFinite(currentPerformanceDuration);
    const performanceGrowth = canComparePerformance
      ? percentGrowth(previousPerformanceDuration, currentPerformanceDuration)
      : 0;
    const performanceIncreaseMs = canComparePerformance ? currentPerformanceDuration - previousPerformanceDuration : 0;

    if (coverageDrop > 0.01) failures.push(`${result.id}: semantic coverage regressed by ${round(coverageDrop)} points.`);
    if (trustDrop > 0.01) failures.push(`${result.id}: graph trust regressed by ${round(trustDrop)} points.`);
    if (performanceGrowth > 15 && performanceIncreaseMs > 1000) {
      failures.push(`${result.id}: performance regressed by ${round(performanceGrowth)}% (${round(performanceIncreaseMs)}ms).`);
    }
    if (performanceGrowth > 15 && performanceIncreaseMs <= 1000) {
      warnings.push(`${result.id}: performance variance was ${round(performanceGrowth)}% but only ${round(performanceIncreaseMs)}ms.`);
    }
    if (!canComparePerformance && previous.performance && result.performance) {
      warnings.push(`${result.id}: performance baseline lacks analysisDurationMs; refresh the baseline before enforcing performance regression.`);
    }
    if (coverageDrop < -0.01) improvements.push(`${result.id}: semantic coverage improved by ${round(Math.abs(coverageDrop))} points.`);
    if (trustDrop < -0.01) improvements.push(`${result.id}: trust improved by ${round(Math.abs(trustDrop))} points.`);
  }

  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    warnings,
    improvements,
  };
}

function compareRegression(previousBaseline, current) {
  if (!previousBaseline) {
    return {
      status: "PASS",
      baseline: "initialized",
      failures: [],
      warnings: ["No previous validation lab baseline existed."],
      improvements: [],
    };
  }

  const gates = evaluateReleaseGates(current.repositories, previousBaseline);
  return {
    status: gates.status,
    baseline: "compared",
    failures: gates.failures,
    warnings: gates.warnings,
    improvements: gates.improvements,
  };
}

function regressionSnapshot(results, performance) {
  return {
    generatedAt: new Date().toISOString(),
    environment: benchmarkEnvironment(),
    repositories: results.map((result) => ({
      id: result.id,
      status: result.status,
      graphHash: result.graphHash ?? null,
      coverage: result.coverage,
      trust: result.trust,
      diagnostics: result.diagnostics,
      performance: result.performance
        ? {
            totalDurationMs: result.performance.totalDurationMs,
            analysisDurationMs: result.performance.analysisDurationMs,
            peakMemoryBytes: result.performance.peakMemoryBytes,
            queryLatencyMs: result.performance.queryLatencyMs,
            searchLatencyMs: result.performance.searchLatencyMs,
            impactLatencyMs: result.performance.impactLatencyMs,
            evidencePackLatencyMs: result.performance.evidencePackLatencyMs,
            implementationPlanLatencyMs: result.performance.implementationPlanLatencyMs,
            agentWorkflowMemoryBytes: result.performance.agentWorkflowMemoryBytes,
          }
        : null,
      graph: result.graph
        ? {
            nodes: result.graph.nodes,
            edges: result.graph.edges,
            graphSizeBytes: result.graph.graphSizeBytes,
          }
        : null,
      deterministic: result.deterministic,
    })),
    aggregate: {
      performance: performance.summary,
    },
  };
}

function benchmarkEnvironment() {
  const packageJson = readPackageJson();
  const cpuList = cpus();
  return {
    node: process.version,
    v8: process.versions.v8,
    execPath: process.execPath,
    platform: platform(),
    arch: arch(),
    osRelease: release(),
    cpuModel: cpuList[0]?.model ?? null,
    coresAvailable: cpuList.length,
    pnpm: commandVersion("pnpm", ["--version"]),
    packageManager: packageJson?.packageManager ?? null,
    engines: packageJson?.engines ?? null,
    typescript: packageJson?.devDependencies?.typescript ?? packageJson?.dependencies?.typescript ?? null,
  };
}

function readPackageJson() {
  try {
    return JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

function commandVersion(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function performanceSummary(results, stress = null) {
  const measured = results.filter((result) => result.performance && result.graph);
  const rows = measured.map((result) => ({
    id: result.id,
    name: result.name,
    frameworks: result.frameworks,
    category: result.category,
    status: result.status,
    coverage: result.coverage,
    trust: result.trust,
    nodes: result.graph.nodes,
    edges: result.graph.edges,
    packages: result.graph.nodesByType.Package ?? 0,
    files: result.graph.files,
    graphSizeBytes: result.graph.graphSizeBytes,
    analysisDurationMs: result.performance.analysisDurationMs,
    totalDurationMs: result.performance.totalDurationMs,
    peakMemoryBytes: result.performance.peakMemoryBytes,
    queryLatencyMs: result.performance.queryLatencyMs,
    searchLatencyMs: result.performance.searchLatencyMs,
    locateLatencyMs: result.performance.locateLatencyMs,
    inspectLatencyMs: result.performance.inspectLatencyMs,
    impactLatencyMs: result.performance.impactLatencyMs,
    evidencePackLatencyMs: result.performance.evidencePackLatencyMs,
    implementationPlanLatencyMs: result.performance.implementationPlanLatencyMs,
    agentWorkflowMs: result.performance.agentWorkflowMs,
    agentWorkflowMemoryBytes: result.performance.agentWorkflowMemoryBytes,
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      repositories: results.length,
      measured: measured.length,
      skipped: results.filter((result) => result.status === "SKIPPED").length,
      failed: results.filter((result) => result.status === "FAIL").length,
      averageDurationMs: round(average(rows.map((row) => row.totalDurationMs))),
      averageCoverage: round(average(rows.map((row) => row.coverage))),
      averageTrust: round(average(rows.map((row) => row.trust))),
      totalNodes: sum(rows.map((row) => row.nodes)),
      totalEdges: sum(rows.map((row) => row.edges)),
      totalGraphSizeBytes: sum(rows.map((row) => row.graphSizeBytes)),
      maxMemoryBytes: Math.max(0, ...rows.map((row) => row.peakMemoryBytes)),
    },
    rows,
    rankings: {
      fastest: sortBy(rows, "totalDurationMs", "asc").slice(0, 10),
      largestGraphs: sortBy(rows, "graphSizeBytes", "desc").slice(0, 10),
      mostRelationships: sortBy(rows, "edges", "desc").slice(0, 10),
      mostPackages: sortBy(rows, "packages", "desc").slice(0, 10),
      largestWorkspaces: sortBy(rows, "files", "desc").slice(0, 10),
      coverage: sortBy(rows, "coverage", "desc").slice(0, 10),
      lowestCoverage: sortBy(rows, "coverage", "asc").slice(0, 10),
      memory: sortBy(rows, "peakMemoryBytes", "desc").slice(0, 10),
      agentWorkflow: sortBy(rows, "agentWorkflowMs", "asc").slice(0, 10),
      agentWorkflowMemory: sortBy(rows, "agentWorkflowMemoryBytes", "desc").slice(0, 10),
    },
    stress,
  };
}

function dashboardModel(results, registry, performance, releaseGates) {
  const measured = results.filter((result) => result.graph);
  const frameworks = [...new Set(registry.flatMap((repo) => repo.frameworks ?? []))].sort();

  return {
    generatedAt: new Date().toISOString(),
    releaseGate: releaseGates.status,
    history: {
      current: performance.summary,
      baselinePath: LAB_BASELINE_PATH,
    },
    repositoryCards: results.map((result) => ({
      id: result.id,
      name: result.name,
      status: result.status,
      frameworks: result.frameworks,
      coverage: result.coverage,
      trust: result.trust,
      nodes: result.graph?.nodes ?? null,
      edges: result.graph?.edges ?? null,
      durationMs: result.performance?.totalDurationMs ?? null,
    })),
    coverageCharts: measured.map((result) => ({ id: result.id, coverage: result.coverage, trust: result.trust })),
    performanceCharts: measured.map((result) => ({
      id: result.id,
      durationMs: result.performance.totalDurationMs,
      memoryBytes: result.performance.peakMemoryBytes,
      queryLatencyMs: result.performance.queryLatencyMs,
      agentWorkflowMs: result.performance.agentWorkflowMs,
      agentWorkflowMemoryBytes: result.performance.agentWorkflowMemoryBytes,
    })),
    validationTables: {
      repositories: results.map((result) => ({
        id: result.id,
        status: result.status,
        gate: result.releaseGate?.status ?? "SKIPPED",
        failures: result.releaseGate?.failures ?? [],
        warnings: result.releaseGate?.warnings ?? [],
      })),
    },
    benchmarkTables: performance.rankings,
    frameworkSupportMatrix: frameworks.map((framework) => ({
      framework,
      repositories: registry
        .filter((repo) => (repo.frameworks ?? []).includes(framework))
        .map((repo) => ({
          id: repo.id,
          default: repo.default === true,
          expectedAnalyzer: repo.expectedAnalyzer,
          latestStatus: results.find((result) => result.id === repo.id)?.status ?? "not-run",
        })),
    })),
  };
}

function badgeModel(results, releaseGates) {
  const items = [];
  items.push(badge("validation", "validation", releaseGates.status, releaseGates.status === "PASS" ? "2ea44f" : "cf222e"));
  items.push(badge("regression", "regression", releaseGates.status, releaseGates.status === "PASS" ? "2ea44f" : "cf222e"));

  for (const result of results.filter((entry) => entry.graph)) {
    items.push(badge(`${result.id}-coverage`, `${result.id} coverage`, percentLabel(result.coverage), metricColor(result.coverage)));
    items.push(badge(`${result.id}-trust`, `${result.id} trust`, percentLabel(result.trust), metricColor(result.trust)));
    items.push(badge(`${result.id}-performance`, `${result.id} perf`, `${round(result.performance.totalDurationMs)}ms`, "0969da"));
    items.push(badge(`${result.id}-framework`, `${result.id} frameworks`, result.frameworks.join(",") || "none", "8250df"));
  }

  return { generatedAt: new Date().toISOString(), items };
}

function badge(id, label, message, color) {
  return { id, label, message, color };
}

async function runStressSuite() {
  await mkdir(PERFORMANCE_ROOT, { recursive: true });
  const results = [];
  for (const profile of STRESS_PROFILES) {
    results.push(runVirtualStressProfile(profile));
  }
  const stress = {
    generatedAt: new Date().toISOString(),
    mode: "virtual-deterministic",
    note: "Stress profiles use deterministic virtual graph workloads so release validation can run without writing hundreds of thousands of files.",
    profiles: results,
  };
  await writeJson(join(PERFORMANCE_ROOT, "stress.json"), stress);
  await writeFile(join(PERFORMANCE_ROOT, "stress.md"), renderStressMarkdown(stress), "utf8");
  return stress;
}

function runVirtualStressProfile(profile) {
  const start = performance.now();
  const cpuStart = process.cpuUsage();
  const materialized = Math.min(profile.nodes, 100_000);
  const index = new Map();
  let hash = 2166136261;

  for (let i = 0; i < materialized; i += 1) {
    const id = `node:${i}`;
    index.set(id, i);
    hash ^= i;
    hash = Math.imul(hash, 16777619);
  }

  const queryStart = performance.now();
  for (let i = 0; i < 1000; i += 1) {
    index.get(`node:${(i * 7919) % materialized}`);
  }
  const queryLatencyMs = (performance.now() - queryStart) / 1000;
  const cpu = process.cpuUsage(cpuStart);

  return {
    ...profile,
    materializedNodes: materialized,
    graphGenerationMs: round((profile.nodes / materialized) * (performance.now() - start), 3),
    indexGenerationMs: round(performance.now() - start, 3),
    queryLatencyMs: round(queryLatencyMs, 5),
    peakMemoryBytes: process.memoryUsage().rss,
    cpu,
    hash: hash >>> 0,
  };
}

function graphStatisticsFromGraph(graph, graphSizeBytes) {
  return {
    files: graph.metadata.fileCount,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    diagnostics: graph.diagnostics.length,
    graphSizeBytes,
    deterministicHash: graph.metadata.deterministicHash,
    nodesByType: countBy(graph.nodes.map((node) => node.type)),
    edgesByType: countBy(graph.edges.map((edge) => edge.type)),
  };
}

function measureAgentWorkflow(modules, graph) {
  const checkpoints = [process.memoryUsage().rss];
  const queryText = agentWorkflowQuery(graph);
  const query = modules.query.createQueryEngine(graph);
  const index = modules.core.createSemanticIndex(graph);
  const registry = modules.capabilities.createCapabilityRegistry(
    { graph, query, semanticIndex: index },
    modules.capabilities.defaultCapabilities(),
  );
  const engine = { execute: registry.execute };
  const timings = {};

  const search = timedSync("searchLatencyMs", timings, checkpoints, () =>
    modules.core.resolveIntent(index, queryText, { limit: 5 }));
  const locatedId = search.candidates[0]?.nodeId ?? graph.nodes[0]?.id ?? "";
  const located = timedSync("locateLatencyMs", timings, checkpoints, () =>
    locatedId ? query.findNode(locatedId) : undefined);
  const inspect = timedSync("inspectLatencyMs", timings, checkpoints, () =>
    located?.id ? query.neighborhood(located.id, { depth: 1 }) : { nodes: [], edges: [] });
  const impact = timedSync("impactLatencyMs", timings, checkpoints, () =>
    located?.id ? engine.execute("ImpactAnalysis", { id: located.id, mode: "direct" }) : null);
  const evidence = timedSync("evidencePackLatencyMs", timings, checkpoints, () =>
    engine.execute("EvidencePack", { query: queryText, limit: 5 }));
  const plan = timedSync("implementationPlanLatencyMs", timings, checkpoints, () =>
    engine.execute("ImplementationPlan", { task: `Change ${queryText}`, budget: 5, timeoutMs: 250 }));
  const pack = evidence.statistics?.evidencePack ?? {};
  const budget = plan.statistics?.budget ?? {};

  return {
    query: queryText,
    targetId: located?.id ?? null,
    ...timings,
    totalStepLatencyMs: round(sum(Object.values(timings)), 3),
    peakMemoryBytes: Math.max(...checkpoints),
    bounded: {
      searchCandidates: search.candidates.length,
      inspectNodes: inspect.nodes.length,
      inspectEdges: inspect.edges.length,
      impactNodeLimit: impact?.statistics?.nodeLimit ?? null,
      impactEdgeLimit: impact?.statistics?.edgeLimit ?? null,
      evidenceNodes: pack.topNodes?.length ?? 0,
      evidenceEdges: pack.topEdges?.length ?? 0,
      plannerVisitedNodes: budget.visitedNodes ?? 0,
      plannerNodeBudget: budget.nodeBudget ?? 5,
      plannerStatus: budget.status ?? "unknown",
    },
  };
}

function agentWorkflowQuery(graph) {
  const preferred = graph.nodes.find((node) =>
    /auth|login|jwt|threshold|sleep|signal|impact/i.test(`${node.id} ${node.name} ${node.file ?? ""}`),
  );
  return preferred?.name ?? graph.repository.name ?? "repository";
}

function timedSync(name, timings, checkpoints, fn) {
  const started = performance.now();
  const value = fn();
  timings[name] = round(performance.now() - started, 4);
  checkpoints.push(process.memoryUsage().rss);
  return value;
}

function selectRepositories(registry, target) {
  if (target === "all") {
    return registry.filter((repository) => repository.enabled !== false && repository.default !== false);
  }

  const normalized = normalizeKey(target);
  return registry.filter((repository) => {
    const fields = [
      repository.id,
      repository.name,
      repository.category,
      repository.repositoryType,
      repository.language,
      ...(repository.frameworks ?? []),
    ].map(normalizeKey);
    return fields.includes(normalized);
  });
}

async function loadLatestLabResults(registry) {
  const results = [];
  for (const repository of registry) {
    const latest = await readJsonIfExists(join(corpusPaths(repository).results, "latest.json"));
    if (latest) results.push(latest);
  }
  return results;
}

async function ensureLabLayout() {
  await Promise.all([
    mkdir(CORPUS_ROOT, { recursive: true }),
    mkdir(PERFORMANCE_ROOT, { recursive: true }),
    mkdir(WEBSITE_ASSETS_ROOT, { recursive: true }),
    mkdir(BADGES_ROOT, { recursive: true }),
    mkdir(RELEASE_GATES_ROOT, { recursive: true }),
    ...CORPUS_GROUPS.map((group) => mkdir(join(CORPUS_ROOT, group), { recursive: true })),
  ]);
}

async function ensureCorpusEntries(registry) {
  await Promise.all(registry.map(ensureCorpusEntry));
}

async function ensureCorpusEntry(repository) {
  const corpus = corpusPaths(repository);
  await Promise.all([
    mkdir(corpus.root, { recursive: true }),
    mkdir(corpus.results, { recursive: true }),
    mkdir(corpus.expected, { recursive: true }),
  ]);

  await Promise.all([
    writeJson(corpus.manifest, {
      id: repository.id,
      name: repository.name,
      source: repository.repository,
      corpusPath: repository.corpusPath,
      frameworks: repository.frameworks,
      language: repository.language,
      repositoryType: repository.repositoryType,
      expectedAnalyzer: repository.expectedAnalyzer,
      default: repository.default === true,
    }),
    writeJson(corpus.metadata, {
      schemaVersion: 1,
      priority: repository.priority,
      category: repository.category,
      expected: expectedFromRepository(repository),
    }),
    writeJson(join(corpus.expected, "thresholds.json"), expectedFromRepository(repository)),
  ]);

  if (!existsSync(corpus.notes)) {
    await writeFile(corpus.notes, `# ${repository.name}\n\nValidation corpus notes for ${repository.id}.\n`, "utf8");
  }
}

function corpusPaths(repository) {
  const root = join(CORPUS_ROOT, repository.corpusPath);
  return {
    root,
    results: join(root, "results"),
    expected: join(root, "expected"),
    manifest: join(root, "manifest.json"),
    metadata: join(root, "metadata.json"),
    notes: join(root, "notes.md"),
  };
}

async function loadRegistry() {
  const registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
  return registry.map((repository) => ({
    ...repository,
    frameworks: repository.frameworks ?? [],
    corpusPath: repository.corpusPath ?? `${repository.category ?? "libraries"}/${repository.id}`,
    priority: repository.priority ?? "medium",
    enabled: repository.enabled !== false,
    default: repository.default === true,
  }));
}

async function loadOntolyModules() {
  const modulePath = (packageName) => {
    const path = join(PROJECT_ROOT, "packages", packageName, "dist", "index.js");
    if (!existsSync(path)) {
      throw new Error(`Missing built Ontoly package: ${path}. Run pnpm build before validation.`);
    }
    return pathToFileURL(path).href;
  };

  const [
    compiler,
    core,
    parserTypescript,
    parserOpenApi,
    typescript,
    semantic,
    analyzers,
    query,
    capabilities,
  ] = await Promise.all([
    import(modulePath("compiler")),
    import(modulePath("core")),
    import(modulePath("parser-typescript")),
    import(modulePath("parser-openapi")),
    import(modulePath("typescript")),
    import(modulePath("semantic")),
    import(modulePath("analyzers")),
    import(modulePath("query")),
    import(modulePath("capabilities")),
  ]);

  return { compiler, core, parserTypescript, parserOpenApi, typescript, semantic, analyzers, query, capabilities };
}

async function readSemanticSummary(repositoryId) {
  const path = join(VALIDATION_ROOT, "semantic", "reports", `${repositoryId}.json`);
  const report = await readJsonIfExists(path);
  if (!report) return null;
  return {
    questions: report.questionCount,
    ontoly: report.score?.ontoly ?? null,
    graphify: report.score?.graphify ?? null,
  };
}

function packageManagerCommand(root) {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return { bin: "pnpm", args: ["install", "--ignore-scripts"] };
  if (existsSync(join(root, "yarn.lock"))) return { bin: "yarn", args: ["install", "--ignore-scripts"] };
  if (existsSync(join(root, "package-lock.json"))) return { bin: "npm", args: ["install", "--ignore-scripts"] };
  return { bin: "npm", args: ["install", "--ignore-scripts"] };
}

function expectedFromRepository(repository) {
  return {
    analyzer: repository.expectedAnalyzer,
    semanticCoverage: repository.expectedSemanticCoverage ?? 0,
    trust: repository.expectedTrust ?? 0,
    graphSizeBytes: repository.expectedGraphSizeBytes ?? { min: 0, max: Number.MAX_SAFE_INTEGER },
    nodeRange: repository.expectedNodeCountRange ?? { min: 0, max: Number.MAX_SAFE_INTEGER },
    edgeRange: repository.expectedEdgeCountRange ?? { min: 0, max: Number.MAX_SAFE_INTEGER },
    diagnosticsMax: repository.expectedDiagnosticsMax ?? Number.MAX_SAFE_INTEGER,
  };
}

function renderConsoleSummary(aggregate, persistedAggregate = true) {
  const lines = [
    "Validation lab complete.",
    `Repositories: ${aggregate.performance.summary.measured}/${aggregate.performance.summary.repositories} measured`,
    `Average coverage: ${aggregate.performance.summary.averageCoverage}`,
    `Average trust: ${aggregate.performance.summary.averageTrust}`,
    `Release gates: ${aggregate.releaseGates.status}`,
  ];

  if (persistedAggregate) {
    lines.push(`Dashboard: ${join(VALIDATION_ROOT, "dashboard.md")}`);
    lines.push(`Performance: ${join(PERFORMANCE_ROOT, "performance.md")}`);
  } else if (aggregate.repositories[0]) {
    lines.push(`Repository report: ${join(CORPUS_ROOT, aggregate.repositories[0].corpusPath, "results", "report.md")}`);
    lines.push("Aggregate dashboard was not overwritten by this targeted run.");
  }

  return lines.join("\n");
}

function renderLabSummaryMarkdown(aggregate) {
  return [
    "# Validation Lab Summary",
    "",
    `Generated: ${aggregate.generatedAt}`,
    `Release gates: ${aggregate.releaseGates.status}`,
    "",
    "| Repository | Status | Coverage | Trust | Nodes | Edges | Time | Memory |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...aggregate.repositories.map((result) =>
      `| ${result.name} | ${result.status} | ${valueOrNa(result.coverage)} | ${valueOrNa(result.trust)} | ${valueOrNa(result.graph?.nodes)} | ${valueOrNa(result.graph?.edges)} | ${valueOrNa(result.performance?.totalDurationMs)}ms | ${formatBytes(result.performance?.peakMemoryBytes)} |`,
    ),
    "",
    renderReleaseGateMarkdown(aggregate.releaseGates),
  ].join("\n");
}

function renderRepositoryReport(result) {
  return [
    `# ${result.name} Validation Result`,
    "",
    `Status: ${result.status}`,
    `Repository: ${result.source?.path ?? result.source?.reason ?? "n/a"}`,
    `Frameworks: ${result.frameworks.join(", ") || "none"}`,
    "",
    "## Metrics",
    "",
    `- Coverage: ${valueOrNa(result.coverage)}`,
    `- Trust: ${valueOrNa(result.trust)}`,
    `- Nodes: ${valueOrNa(result.graph?.nodes)}`,
    `- Edges: ${valueOrNa(result.graph?.edges)}`,
    `- Graph size: ${formatBytes(result.graph?.graphSizeBytes)}`,
    `- Total duration: ${valueOrNa(result.performance?.totalDurationMs)}ms`,
    `- Peak memory: ${formatBytes(result.performance?.peakMemoryBytes)}`,
    `- Query latency: ${valueOrNa(result.performance?.queryLatencyMs)}ms`,
    `- Agent workflow latency: ${valueOrNa(result.performance?.agentWorkflowMs)}ms`,
    `- Agent workflow memory: ${formatBytes(result.performance?.agentWorkflowMemoryBytes)}`,
    `- Agent search/impact/evidence/planner latency: ${valueOrNa(result.performance?.searchLatencyMs)}ms / ${valueOrNa(result.performance?.impactLatencyMs)}ms / ${valueOrNa(result.performance?.evidencePackLatencyMs)}ms / ${valueOrNa(result.performance?.implementationPlanLatencyMs)}ms`,
    "",
    "## Release Gate",
    "",
    `Status: ${result.releaseGate?.status ?? "n/a"}`,
    ...(result.releaseGate?.failures?.length ? result.releaseGate.failures.map((item) => `- FAIL: ${item}`) : ["- No failures."]),
    ...(result.releaseGate?.warnings?.length ? result.releaseGate.warnings.map((item) => `- WARN: ${item}`) : []),
    "",
  ].join("\n");
}

function renderPerformanceMarkdown(aggregate) {
  return [
    "# Performance Lab",
    "",
    `Generated: ${aggregate.generatedAt}`,
    "",
    "| Repository | Time | Memory | Agent Workflow | Agent Memory | Graph Size | Nodes | Edges | Coverage | Trust |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...aggregate.performance.rows.map((row) =>
      `| ${row.name} | ${row.totalDurationMs}ms | ${formatBytes(row.peakMemoryBytes)} | ${valueOrNa(row.agentWorkflowMs)}ms | ${formatBytes(row.agentWorkflowMemoryBytes)} | ${formatBytes(row.graphSizeBytes)} | ${row.nodes} | ${row.edges} | ${valueOrNa(row.coverage)} | ${valueOrNa(row.trust)} |`,
    ),
    "",
    renderTopReportsMarkdown(aggregate.performance),
  ].join("\n");
}

function renderTopReportsMarkdown(performance) {
  return [
    "# Performance Rankings",
    "",
    "## Top Fastest Repositories",
    "",
    renderRanking(performance.rankings.fastest, "totalDurationMs", "ms"),
    "",
    "## Largest Graphs",
    "",
    renderRanking(performance.rankings.largestGraphs, "graphSizeBytes", "bytes"),
    "",
    "## Most Relationships",
    "",
    renderRanking(performance.rankings.mostRelationships, "edges", ""),
    "",
    "## Most Packages",
    "",
    renderRanking(performance.rankings.mostPackages, "packages", ""),
    "",
    "## Largest Workspace",
    "",
    renderRanking(performance.rankings.largestWorkspaces, "files", "files"),
    "",
    "## Highest Semantic Coverage",
    "",
    renderRanking(performance.rankings.coverage, "coverage", ""),
    "",
    "## Lowest Semantic Coverage",
    "",
    renderRanking(performance.rankings.lowestCoverage, "coverage", ""),
    "",
    "## Largest Memory Usage",
    "",
    renderRanking(performance.rankings.memory, "peakMemoryBytes", "bytes"),
    "",
    "## Fastest Agent Workflows",
    "",
    renderRanking(performance.rankings.agentWorkflow, "agentWorkflowMs", "ms"),
    "",
    "## Agent Workflow Memory",
    "",
    renderRanking(performance.rankings.agentWorkflowMemory, "agentWorkflowMemoryBytes", "bytes"),
  ].join("\n");
}

function renderDashboardMarkdown(aggregate) {
  return [
    "# Ontoly Validation Dashboard",
    "",
    `Generated: ${aggregate.generatedAt}`,
    `Release gate: ${aggregate.releaseGates.status}`,
    "",
    "## History",
    "",
    `- Average coverage: ${aggregate.performance.summary.averageCoverage}`,
    `- Average trust: ${aggregate.performance.summary.averageTrust}`,
    `- Average duration: ${aggregate.performance.summary.averageDurationMs}ms`,
    `- Total graph size: ${formatBytes(aggregate.performance.summary.totalGraphSizeBytes)}`,
    "",
    "## Repositories",
    "",
    "| Repository | Frameworks | Status | Coverage | Trust | Nodes | Edges | Time |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...aggregate.dashboard.repositoryCards.map((card) =>
      `| ${card.name} | ${card.frameworks.join(", ") || "none"} | ${card.status} | ${valueOrNa(card.coverage)} | ${valueOrNa(card.trust)} | ${valueOrNa(card.nodes)} | ${valueOrNa(card.edges)} | ${valueOrNa(card.durationMs)}ms |`,
    ),
    "",
    "## Framework Support Matrix",
    "",
    "| Framework | Repositories |",
    "| --- | --- |",
    ...aggregate.dashboard.frameworkSupportMatrix.map((row) =>
      `| ${row.framework} | ${row.repositories.map((repo) => `${repo.id} (${repo.latestStatus})`).join(", ")} |`,
    ),
  ].join("\n");
}

function renderDashboardHtml(aggregate) {
  const rows = aggregate.dashboard.repositoryCards.map((card) =>
    `<tr><td>${escapeHtml(card.name)}</td><td>${escapeHtml(card.frameworks.join(", "))}</td><td>${card.status}</td><td>${valueOrNa(card.coverage)}</td><td>${valueOrNa(card.trust)}</td><td>${valueOrNa(card.nodes)}</td><td>${valueOrNa(card.edges)}</td><td>${valueOrNa(card.durationMs)}ms</td></tr>`,
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Ontoly Validation Dashboard</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 32px; color: #17202a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d0d7de; padding: 8px; text-align: left; }
    th { background: #f6f8fa; }
    .pass { color: #1a7f37; }
    .fail { color: #cf222e; }
  </style>
</head>
<body>
  <h1>Ontoly Validation Dashboard</h1>
  <p>Generated: ${aggregate.generatedAt}</p>
  <p>Release gate: <strong class="${aggregate.releaseGates.status === "PASS" ? "pass" : "fail"}">${aggregate.releaseGates.status}</strong></p>
  <table>
    <thead><tr><th>Repository</th><th>Frameworks</th><th>Status</th><th>Coverage</th><th>Trust</th><th>Nodes</th><th>Edges</th><th>Time</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
}

function renderReleaseGateMarkdown(releaseGates) {
  return [
    "# Release Gates",
    "",
    `Status: ${releaseGates.status}`,
    "",
    "## Failures",
    "",
    ...(releaseGates.failures.length ? releaseGates.failures.map((item) => `- ${item}`) : ["- None."]),
    "",
    "## Warnings",
    "",
    ...(releaseGates.warnings.length ? releaseGates.warnings.map((item) => `- ${item}`) : ["- None."]),
    "",
    "## Improvements",
    "",
    ...(releaseGates.improvements.length ? releaseGates.improvements.map((item) => `- ${item}`) : ["- None."]),
  ].join("\n");
}

function renderStressMarkdown(stress) {
  return [
    "# Stress Test Results",
    "",
    `Generated: ${stress.generatedAt}`,
    `Mode: ${stress.mode}`,
    "",
    "| Profile | Files | Nodes | Edges | Generation | Index | Query | Memory |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...stress.profiles.map((profile) =>
      `| ${profile.id} | ${profile.files} | ${profile.nodes} | ${profile.edges} | ${profile.graphGenerationMs}ms | ${profile.indexGenerationMs}ms | ${profile.queryLatencyMs}ms | ${formatBytes(profile.peakMemoryBytes)} |`,
    ),
    "",
  ].join("\n");
}

function renderBadgeSvg(label, message, color) {
  const labelWidth = Math.max(40, label.length * 7 + 12);
  const messageWidth = Math.max(42, String(message).length * 7 + 12);
  const width = labelWidth + messageWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeHtml(label)}: ${escapeHtml(message)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <rect width="${labelWidth}" height="20" fill="#555"/>
  <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="#${color}"/>
  <rect width="${width}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15">${escapeHtml(label)}</text>
    <text x="${labelWidth + messageWidth / 2}" y="15">${escapeHtml(message)}</text>
  </g>
</svg>
`;
}

function renderRanking(rows, field, suffix) {
  if (!rows.length) return "No measured repositories.";
  return rows.map((row, index) => {
    const raw = row[field];
    const value = suffix === "bytes" ? formatBytes(raw) : `${valueOrNa(raw)}${suffix && suffix !== "files" ? suffix : suffix === "files" ? " files" : ""}`;
    return `${index + 1}. ${row.name}: ${value}`;
  }).join("\n");
}

function writeJson(path, value) {
  return mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function timed(name, fn) {
  const start = performance.now();
  const value = await fn();
  return { name, value, durationMs: performance.now() - start };
}

function memoryCheckpoint(label) {
  const memory = process.memoryUsage();
  return {
    label,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
  };
}

function countBy(values) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sortBy(rows, field, direction) {
  return [...rows].sort((left, right) => {
    const delta = Number(left[field] ?? 0) - Number(right[field] ?? 0);
    return direction === "desc" ? -delta : delta;
  });
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  return numeric.length === 0 ? 0 : sum(numeric) / numeric.length;
}

function sum(values) {
  return values.filter((value) => Number.isFinite(value)).reduce((total, value) => total + value, 0);
}

function sourceInventoryHash(inventory) {
  const sources = (inventory?.sources ?? [])
    .map((source) => ({
      path: source.path,
      kind: source.kind,
      digest: source.digest,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return createHash("sha256").update(JSON.stringify(sources)).digest("hex");
}

function numericDrop(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return 0;
  return previous - current;
}

function percentGrowth(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "n/a";
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${round(size, 1)} ${units[unit]}`;
}

function valueOrNa(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "n/a" : String(value);
}

function percentLabel(value) {
  return Number.isFinite(value) ? `${round(value)}%` : "n/a";
}

function metricColor(value) {
  if (!Number.isFinite(value)) return "6e7781";
  if (value >= 95) return "2ea44f";
  if (value >= 80) return "bf8700";
  return "cf222e";
}

function normalizeKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeTimestamp(value) {
  return String(value).replace(/[:.]/g, "-");
}

function isRemote(value) {
  return /^https?:\/\//.test(String(value ?? "")) || String(value ?? "").endsWith(".git");
}

function expandHome(path) {
  return String(path).startsWith("~/") ? join(homedir(), String(path).slice(2)) : String(path);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseArgs(argv) {
  const [command = "validate", possibleTarget, ...rest] = argv;
  const all = possibleTarget?.startsWith("--") ? [possibleTarget, ...rest] : rest;
  const flags = new Set(all.filter((item) => item.startsWith("--")));
  return {
    command,
    target: possibleTarget && !possibleTarget.startsWith("--") ? possibleTarget : command === "validate" ? "all" : null,
    clone: flags.has("--clone"),
    install: flags.has("--install"),
    json: flags.has("--json"),
    ci: flags.has("--ci"),
    refresh: flags.has("--refresh"),
    determinism: flags.has("--determinism"),
    noDeterminism: flags.has("--no-determinism"),
  };
}
