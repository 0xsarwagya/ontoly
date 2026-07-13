#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { cpus, homedir } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const VALIDATION_ROOT = join(PROJECT_ROOT, "validation");
const SCRIPT_PATH = __filename;

const GRAPHIFY_COMMAND = process.env.GRAPHIFY_BIN ?? "graphify";
const GRAPHIFY_MAX_WORKERS = Number(process.env.GRAPHIFY_MAX_WORKERS ?? Math.max(1, Math.min(8, cpus().length - 1)));

function writeOut(message = "") {
  process.stdout.write(`${message}\n`);
}

function writeErr(message = "") {
  process.stderr.write(`${message}\n`);
}

const REPOSITORIES = [
  {
    slug: "ovok-core",
    name: "Ovok Core",
    requestedPath: "~/Desktop/work/ovok-core",
    fallbackPaths: [],
  },
  {
    slug: "0xsarwagya",
    name: "0xsarwagya",
    requestedPath: "~/Desktop/personal/0xsarwagya",
    fallbackPaths: [],
  },
  {
    slug: "innosphere",
    name: "Innosphere",
    requestedPath: "~/Desktop/work/innosphere",
    fallbackPaths: [],
  },
  {
    slug: "ghost",
    name: "Ghost",
    requestedPath: "~/Desktop/personal/ghost",
    fallbackPaths: [],
  },
  {
    slug: "durable-local",
    name: "durable-local",
    requestedPath: "~/Desktop/personal/durable-local",
    fallbackPaths: [],
  },
];

const SEMANTIC_CONCEPTS = [
  "Functions",
  "Methods",
  "Classes",
  "Interfaces",
  "Routes",
  "Controllers",
  "Modules",
  "Services",
  "Providers",
  "Repositories",
  "Packages",
  "Configuration",
  "Environment Variables",
];

const RELATIONSHIPS = [
  "CALLS",
  "IMPORTS",
  "EXPORTS",
  "CONTAINS",
  "HANDLES",
  "MOUNTS",
  "INJECTS",
  "READS",
  "WRITES",
  "USES",
  "DEPENDS_ON",
  "AUTHORIZES",
  "REGISTERED_IN",
  "IMPLEMENTS",
  "EXTENDS",
  "REFERENCES",
  "CREATES",
  "THROWS",
  "RETURNS",
  "PUBLISHES",
  "SUBSCRIBES",
];

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".next",
  ".turbo",
  ".cache",
  ".ontoly",
  "graphify-out",
  "dist",
  "build",
  "coverage",
]);

const GRAPHIFY_CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".rs",
  ".go",
  ".py",
  ".rb",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
]);

const GRAPHIFY_CODE_FILENAMES = new Set([
  "Dockerfile",
  "Makefile",
  "Procfile",
  ".env.example",
  ".env.sample",
]);

if (process.argv[2] === "--ontoly-one") {
  const [, , , slug, repoPath, outDir] = process.argv;
  if (!slug || !repoPath || !outDir) {
    writeErr("Usage: run-validation.mjs --ontoly-one <slug> <repoPath> <outDir>");
    process.exit(1);
  }

  runOntolyOne({ slug, repoPath, outDir }).catch((error) => {
    writeErr(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
} else {
  main().catch((error) => {
    writeErr(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}

async function main() {
  const startedAt = new Date().toISOString();
  await ensureValidationLayout();

  const previousBaseline = await readJsonIfExists(join(VALIDATION_ROOT, "regression-baseline.json"));
  const resolvedRepositories = await Promise.all(REPOSITORIES.map(resolveRepository));
  const results = [];

  writeOut(`Ontoly vs Graphify validation started at ${startedAt}`);
  writeOut(`Graphify: ${GRAPHIFY_COMMAND}`);
  writeOut("");

  for (const repo of resolvedRepositories) {
    writeOut(`== ${repo.name}`);
    if (!repo.exists) {
      const missing = await writeMissingRepositoryArtifacts(repo);
      results.push(missing);
      writeOut(`missing: ${repo.requestedPath}`);
      continue;
    }

    writeOut(`path: ${repo.actualPath}`);
    await prepareRepositoryOutput(repo.slug);

    const repoSummary = await collectRepositorySummary(repo);
    await writeJson(join(VALIDATION_ROOT, repo.slug, "repository.json"), repoSummary);

    const graphify = await runGraphify(repo);
    const ontoly = await runOntoly(repo);
    const comparison = await createComparison(repo, repoSummary, ontoly, graphify);

    await writeComparisonArtifacts(repo, comparison);
    await writePerRepositoryReport(repo, comparison);
    await writeTopLevelIndexes(repo, ontoly, graphify, comparison);

    results.push({
      slug: repo.slug,
      name: repo.name,
      requestedPath: repo.requestedPath,
      actualPath: repo.actualPath,
      status: comparison.status,
      repository: repoSummary,
      ontoly,
      graphify,
      comparison,
    });

    writeOut(`done: Ontoly ${formatCount(ontoly.statistics?.nodes)} nodes, Graphify ${formatCount(graphify.statistics?.nodes)} nodes`);
    writeOut("");
  }

  const summary = await createAggregateSummary(results, previousBaseline, startedAt);
  await writeJson(join(VALIDATION_ROOT, "summary.json"), summary);
  await writeFile(join(VALIDATION_ROOT, "summary.md"), renderSummaryMarkdown(summary), "utf8");
  await writeFile(join(VALIDATION_ROOT, "dashboard.md"), renderDashboardMarkdown(summary), "utf8");
  await writeJson(join(VALIDATION_ROOT, "regression-current.json"), summary.regression.current);
  await writeJson(join(VALIDATION_ROOT, "regression.json"), summary.regression);

  if (!previousBaseline) {
    await writeJson(join(VALIDATION_ROOT, "regression-baseline.json"), summary.regression.current);
  }

  writeOut(`Validation complete: ${join(VALIDATION_ROOT, "summary.md")}`);
}

async function ensureValidationLayout() {
  await Promise.all([
    mkdir(VALIDATION_ROOT, { recursive: true }),
    mkdir(join(VALIDATION_ROOT, "graphify"), { recursive: true }),
    mkdir(join(VALIDATION_ROOT, "ontoly"), { recursive: true }),
    mkdir(join(VALIDATION_ROOT, "comparisons"), { recursive: true }),
    mkdir(join(VALIDATION_ROOT, "reports"), { recursive: true }),
    mkdir(join(VALIDATION_ROOT, "benchmarks"), { recursive: true }),
    mkdir(join(VALIDATION_ROOT, "tools"), { recursive: true }),
  ]);
}

async function prepareRepositoryOutput(slug) {
  const root = join(VALIDATION_ROOT, slug);
  await mkdir(root, { recursive: true });
  await Promise.all([
    cleanDirectory(join(root, "ontoly")),
    cleanDirectory(join(root, "graphify")),
    cleanDirectory(join(root, "comparison")),
    mkdir(join(root, "benchmarks"), { recursive: true }),
  ]);
}

async function cleanDirectory(path) {
  await rm(path, { recursive: true, force: true });
  await mkdir(path, { recursive: true });
}

async function resolveRepository(definition) {
  const candidates = [definition.requestedPath, ...definition.fallbackPaths].map(expandHome);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return {
        ...definition,
        requestedPath: expandHome(definition.requestedPath),
        actualPath: candidate,
        exists: true,
        pathSubstitution: candidate !== expandHome(definition.requestedPath)
          ? {
              requestedPath: expandHome(definition.requestedPath),
              actualPath: candidate,
              reason: "Requested path did not exist; repository was found at fallback path.",
            }
          : null,
      };
    }
  }

  return {
    ...definition,
    requestedPath: expandHome(definition.requestedPath),
    actualPath: null,
    exists: false,
    pathSubstitution: null,
  };
}

async function writeMissingRepositoryArtifacts(repo) {
  const root = join(VALIDATION_ROOT, repo.slug);
  await mkdir(join(root, "ontoly"), { recursive: true });
  await mkdir(join(root, "graphify"), { recursive: true });
  await mkdir(join(root, "comparison"), { recursive: true });

  const comparison = {
    repository: {
      slug: repo.slug,
      name: repo.name,
      requestedPath: repo.requestedPath,
      actualPath: null,
      status: "missing",
    },
    status: "missing",
    measured: false,
    reason: "Repository path was not found.",
    recommendations: [
      {
        priority: "Critical",
        description: "Repository was not available at the requested path.",
        suggestedFix: "Provide the repository path or update the validation repository registry.",
      },
    ],
  };

  await writeJson(join(root, "comparison", "comparison.json"), comparison);
  await writeFile(join(root, "comparison", "comparison.md"), renderMissingComparison(repo), "utf8");
  await writeFile(join(root, "report.md"), renderMissingComparison(repo), "utf8");
  await writeJson(join(VALIDATION_ROOT, "comparisons", `${repo.slug}.json`), comparison);
  await writeFile(join(VALIDATION_ROOT, "reports", `${repo.slug}.md`), renderMissingComparison(repo), "utf8");

  return {
    slug: repo.slug,
    name: repo.name,
    status: "missing",
    repository: comparison.repository,
    comparison,
  };
}

async function collectRepositorySummary(repo) {
  const files = await walkFiles(repo.actualPath);
  const packageJsonPaths = files.filter((file) => basename(file) === "package.json");
  const rootPackageJson = await readJsonIfExists(join(repo.actualPath, "package.json"));
  const packageJsons = (await Promise.all(packageJsonPaths.map((file) => readJsonIfExists(file)))).filter(Boolean);
  const dependencyNames = [...new Set(packageJsons.flatMap(collectDependencyNames))];
  const frameworks = detectFrameworks(packageJsons, files);
  const lockfiles = files
    .map((file) => relative(repo.actualPath, file))
    .filter((file) => ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb", "bun.lock"].includes(file));
  const packageManager = lockfiles.some((file) => file === "pnpm-lock.yaml")
    ? "pnpm"
    : lockfiles.some((file) => file === "yarn.lock")
      ? "yarn"
      : lockfiles.some((file) => file === "bun.lock" || file === "bun.lockb")
        ? "bun"
        : lockfiles.some((file) => file === "package-lock.json")
          ? "npm"
          : null;

  const byExtension = countBy(files.map((file) => extname(file).toLowerCase() || "(none)"));
  const sourceFiles = files.filter(isSourceFile);
  const typeScriptFiles = files.filter((file) => [".ts", ".tsx", ".mts", ".cts"].includes(extname(file).toLowerCase()));
  const documentationFiles = files.filter((file) => [".md", ".mdx", ".rst", ".txt"].includes(extname(file).toLowerCase()));

  return {
    slug: repo.slug,
    name: repo.name,
    requestedPath: repo.requestedPath,
    actualPath: repo.actualPath,
    pathSubstitution: repo.pathSubstitution,
    packageName: rootPackageJson?.name ?? null,
    packageManager,
    packageJsonCount: packageJsonPaths.length,
    workspacePackages: workspacePackages(rootPackageJson),
    files: {
      total: files.length,
      source: sourceFiles.length,
      typescript: typeScriptFiles.length,
      documentation: documentationFiles.length,
      byExtension,
    },
    frameworks,
    dependencies: dependencyNames.sort(),
  };
}

async function runGraphify(repo) {
  const outDir = join(VALIDATION_ROOT, repo.slug, "graphify");
  const fullOutDir = join(outDir, "full");
  const fullArtifactRoot = join(fullOutDir, "graphify-out");
  await mkdir(fullOutDir, { recursive: true });

  const fullStdoutPath = join(fullOutDir, "stdout.log");
  const fullStderrPath = join(fullOutDir, "stderr.log");
  const fullCommand = {
    executable: GRAPHIFY_COMMAND,
    args: [
      "extract",
      repo.actualPath,
      "--out",
      fullOutDir,
      "--no-cluster",
      "--max-workers",
      String(GRAPHIFY_MAX_WORKERS),
      "--max-concurrency",
      "1",
    ],
    cwd: fullOutDir,
    note: "Uses graphify extract with --out to avoid writing into the source repository. --no-cluster keeps the run headless and deterministic for release validation.",
  };

  await writeJson(join(outDir, "command.json"), fullCommand);
  await writeJson(join(fullOutDir, "command.json"), fullCommand);
  const fullResult = await runTimedCommand(fullCommand.executable, fullCommand.args, {
    cwd: fullCommand.cwd,
    stdoutPath: fullStdoutPath,
    stderrPath: fullStderrPath,
  });

  const fullGraphPath = join(fullArtifactRoot, "graph.json");
  let graphPath = fullGraphPath;
  let artifactRoot = fullArtifactRoot;
  let graph = await readJsonIfExists(fullGraphPath);
  let manifest = await readJsonIfExists(join(fullArtifactRoot, "manifest.json"));
  let outputFiles = await listFilesIfExists(fullArtifactRoot);
  let activeRun = {
    mode: "full",
    command: fullCommand,
    result: fullResult,
    stdoutPath: fullStdoutPath,
    stderrPath: fullStderrPath,
    artifactRoot: fullArtifactRoot,
    projection: null,
  };
  let fallbackRun = null;

  if (!graph && await shouldUseGraphifyStructuralFallback(fullStderrPath)) {
    const projection = await createGraphifyCodeProjection(repo, outDir);
    const fallbackOutDir = join(outDir, "structural");
    const fallbackArtifactRoot = join(fallbackOutDir, "graphify-out");
    const fallbackStdoutPath = join(fallbackOutDir, "stdout.log");
    const fallbackStderrPath = join(fallbackOutDir, "stderr.log");
    await mkdir(fallbackOutDir, { recursive: true });

    const fallbackCommand = {
      executable: GRAPHIFY_COMMAND,
      args: [
        "extract",
        projection.projectionRoot,
        "--out",
        fallbackOutDir,
        "--no-cluster",
        "--max-workers",
        String(GRAPHIFY_MAX_WORKERS),
        "--max-concurrency",
        "1",
      ],
      cwd: fallbackOutDir,
      note: "Structural fallback: full Graphify extraction required an LLM backend for docs/images, so this run analyzes a validation-side code projection only. Source repositories remain untouched.",
    };

    await writeJson(join(fallbackOutDir, "command.json"), fallbackCommand);
    const fallbackResult = await runTimedCommand(fallbackCommand.executable, fallbackCommand.args, {
      cwd: fallbackCommand.cwd,
      stdoutPath: fallbackStdoutPath,
      stderrPath: fallbackStderrPath,
    });

    const fallbackGraphPath = join(fallbackArtifactRoot, "graph.json");
    const fallbackGraph = await readJsonIfExists(fallbackGraphPath);
    fallbackRun = {
      mode: "structural-code-projection",
      command: fallbackCommand,
      result: fallbackResult,
      stdoutPath: fallbackStdoutPath,
      stderrPath: fallbackStderrPath,
      artifactRoot: fallbackArtifactRoot,
      projection,
      graphProduced: Boolean(fallbackGraph),
    };

    if (fallbackGraph) {
      graphPath = fallbackGraphPath;
      artifactRoot = fallbackArtifactRoot;
      graph = fallbackGraph;
      manifest = await readJsonIfExists(join(fallbackArtifactRoot, "manifest.json"));
      outputFiles = await listFilesIfExists(fallbackArtifactRoot);
      activeRun = fallbackRun;
    }
  }

  let diagnostics = [];
  let diagnoseResult = null;

  if (graph) {
    diagnoseResult = await runGraphifyDiagnose(graphPath, outDir);
    diagnostics = graphifyDiagnostics(fullResult, graph, diagnoseResult, activeRun, fallbackRun);
  } else {
    diagnostics = graphifyDiagnostics(fullResult, null, diagnoseResult, activeRun, fallbackRun);
  }

  const statistics = graph ? graphifyStatistics(graph) : null;
  const graphHash = graph ? await fileSha256(graphPath) : null;
  const benchmark = {
    tool: "graphify",
    mode: activeRun.mode,
    command: activeRun.command,
    fullRun: {
      command: fullCommand,
      exitCode: fullResult.exitCode,
      durationMs: fullResult.durationMs,
      time: fullResult.time,
      stdout: fullStdoutPath,
      stderr: fullStderrPath,
    },
    fallbackRun: fallbackRun
      ? {
          command: fallbackRun.command,
          exitCode: fallbackRun.result.exitCode,
          durationMs: fallbackRun.result.durationMs,
          time: fallbackRun.result.time,
          stdout: fallbackRun.stdoutPath,
          stderr: fallbackRun.stderrPath,
          projection: fallbackRun.projection,
        }
      : null,
    exitCode: activeRun.result.exitCode,
    durationMs: activeRun.result.durationMs,
    time: activeRun.result.time,
    graphHash,
    outputFiles,
    statistics,
    diagnostics,
  };

  await writeJson(join(outDir, "statistics.json"), statistics);
  await writeJson(join(outDir, "diagnostics.json"), diagnostics);
  await writeJson(join(outDir, "benchmark.json"), benchmark);
  await writeJson(join(outDir, "mode.json"), {
    activeMode: activeRun.mode,
    fullRunSucceeded: fullResult.exitCode === 0 && await pathExists(fullGraphPath),
    structuralFallbackUsed: activeRun.mode === "structural-code-projection",
    structuralFallbackReason: fallbackRun ? "Full Graphify extraction required an LLM backend for repository docs/images." : null,
  });
  await writeJson(join(outDir, "artifacts.json"), {
    graph: graph ? graphPath : null,
    manifest: manifest ? join(artifactRoot, "manifest.json") : null,
    activeArtifactRoot: artifactRoot,
    fullArtifactRoot,
    structuralArtifactRoot: fallbackRun?.artifactRoot ?? null,
    projection: fallbackRun?.projection ?? null,
    outputFiles,
  });
  await writeJson(join(VALIDATION_ROOT, repo.slug, "benchmarks", "graphify.json"), benchmark);

  return {
    status: activeRun.result.exitCode === 0 && Boolean(graph)
      ? activeRun.mode === "full" ? "success" : "success_with_fallback"
      : "failed",
    tool: "graphify",
    version: await graphifyVersion(),
    mode: activeRun.mode,
    command: activeRun.command,
    fullRun: benchmark.fullRun,
    fallbackRun: benchmark.fallbackRun,
    paths: {
      outputDirectory: outDir,
      graph: graph ? graphPath : null,
      manifest: manifest ? join(artifactRoot, "manifest.json") : null,
      stdout: activeRun.stdoutPath,
      stderr: activeRun.stderrPath,
    },
    benchmark,
    statistics,
    diagnostics,
    graphHash,
    manifest,
    graph,
    outputFiles,
  };
}

async function runGraphifyDiagnose(graphPath, outDir) {
  const stdoutPath = join(outDir, "diagnose.stdout.log");
  const stderrPath = join(outDir, "diagnose.stderr.log");
  const command = {
    executable: GRAPHIFY_COMMAND,
    args: ["diagnose", "multigraph", "--graph", graphPath, "--json", "--directed"],
    cwd: outDir,
  };
  const result = await runCommand(command.executable, command.args, {
    cwd: command.cwd,
    stdoutPath,
    stderrPath,
  });
  const stdout = await readTextIfExists(stdoutPath);
  const parsed = tryParseJson(stdout);

  await writeJson(join(outDir, "diagnose.command.json"), command);
  if (parsed) {
    await writeJson(join(outDir, "diagnose.json"), parsed);
  }

  return {
    command,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    parsed,
  };
}

async function shouldUseGraphifyStructuralFallback(stderrPath) {
  const stderr = await readTextIfExists(stderrPath);
  return stderr.includes("no LLM API key found") || stderr.includes("need semantic extraction");
}

async function createGraphifyCodeProjection(repo, outDir) {
  const projectionRoot = join(outDir, "code-projection");
  await rm(projectionRoot, { recursive: true, force: true });
  await mkdir(projectionRoot, { recursive: true });

  const files = await walkFiles(repo.actualPath);
  const included = files.filter(isGraphifyCodeFile);
  const copied = [];

  for (const file of included) {
    const relativePath = relative(repo.actualPath, file);
    const target = join(projectionRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
    copied.push(relativePath);
  }

  const manifest = {
    repository: repo.name,
    sourceRoot: repo.actualPath,
    projectionRoot,
    mode: "code-only projection for Graphify structural fallback",
    includedFiles: copied.length,
    excludedFiles: files.length - copied.length,
    includedExtensions: countBy(copied.map((file) => extname(file).toLowerCase() || basename(file))),
    files: copied,
  };

  await writeJson(join(outDir, "code-projection-manifest.json"), manifest);
  return manifest;
}

function isGraphifyCodeFile(file) {
  const name = basename(file);
  const extension = extname(file).toLowerCase();
  return GRAPHIFY_CODE_FILENAMES.has(name) || GRAPHIFY_CODE_EXTENSIONS.has(extension);
}

async function runOntoly(repo) {
  const outDir = join(VALIDATION_ROOT, repo.slug, "ontoly");
  const stdoutPath = join(outDir, "stdout.log");
  const stderrPath = join(outDir, "stderr.log");
  const command = {
    executable: process.execPath,
    args: [SCRIPT_PATH, "--ontoly-one", repo.slug, repo.actualPath, outDir],
    cwd: PROJECT_ROOT,
    note: "Runs Ontoly through its built package APIs with write:false so source repositories are not modified.",
  };

  await writeJson(join(outDir, "command.json"), command);
  const result = await runTimedCommand(command.executable, command.args, {
    cwd: command.cwd,
    stdoutPath,
    stderrPath,
  });

  const runResult = await readJsonIfExists(join(outDir, "result.json"));
  const graph = await readJsonIfExists(join(outDir, "SoftwareGraph.json"));
  const statistics = await readJsonIfExists(join(outDir, "statistics.json"));
  const coverage = await readJsonIfExists(join(outDir, "coverage.json"));
  const frameworks = await readJsonIfExists(join(outDir, "frameworks.json"));
  const diagnostics = await readJsonIfExists(join(outDir, "diagnostics.json")) ?? [];
  const graphValidation = await readJsonIfExists(join(outDir, "graph-validation.json"));
  const semanticModelSummary = await readJsonIfExists(join(outDir, "semantic-model-summary.json"));
  const graphHash = graph?.metadata?.deterministicHash ?? null;
  const outputFiles = await listFilesIfExists(outDir);
  const benchmark = {
    tool: "ontoly",
    command,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    time: result.time,
    graphHash,
    outputFiles,
    graphDurationMs: graph?.metadata?.durationMs ?? null,
    statistics,
    coverage: coverage?.summary ?? null,
    diagnostics: diagnostics.length,
  };

  await writeJson(join(outDir, "benchmark.json"), benchmark);
  await writeJson(join(outDir, "artifacts.json"), {
    graph: graph ? join(outDir, "SoftwareGraph.json") : null,
    semanticModel: existsSync(join(outDir, "semantic-model.json")) ? join(outDir, "semantic-model.json") : null,
    diagnostics: join(outDir, "diagnostics.json"),
    statistics: join(outDir, "statistics.json"),
    coverage: join(outDir, "coverage.json"),
    quality: join(outDir, "quality.json"),
    indexes: join(outDir, "indexes.json"),
    frameworks: join(outDir, "frameworks.json"),
    outputFiles,
  });
  await writeJson(join(VALIDATION_ROOT, repo.slug, "benchmarks", "ontoly.json"), benchmark);

  return {
    status: result.exitCode === 0 && Boolean(graph) ? "success" : "failed",
    tool: "ontoly",
    command,
    paths: {
      outputDirectory: outDir,
      graph: graph ? join(outDir, "SoftwareGraph.json") : null,
      stdout: stdoutPath,
      stderr: stderrPath,
    },
    benchmark,
    runResult,
    statistics,
    coverage,
    frameworks,
    diagnostics,
    graphValidation,
    semanticModelSummary,
    graphHash,
    graph,
    outputFiles,
  };
}

async function runOntolyOne({ slug, repoPath, outDir }) {
  await mkdir(outDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const modules = await loadOntolyModules();

  const result = await modules.compiler.buildSoftwareGraphWithArtifacts({
    root: repoPath,
    write: false,
    mode: "clean",
    passes: [
      modules.compiler.createRepositoryIntelligencePass(),
      modules.parserTypescript.createTypeScriptFrontendPass(),
      modules.parserOpenApi.createOpenApiFrontendPass(),
    ],
  });

  if (!result.graph) {
    await writeJson(join(outDir, "result.json"), {
      slug,
      status: result.status,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: performance.now() - start,
      diagnostics: result.diagnostics,
      stages: result.stages,
    });
    throw new Error("Ontoly did not produce a graph.");
  }

  const graph = result.graph;
  const semanticModel = modules.typescript.analyzeTypeScriptProject({ root: repoPath });
  const semanticModelValidation = modules.typescript.validateTypeScriptSemanticModel(semanticModel);
  const registry = modules.semantic.createDefaultFrameworkRegistry();
  const detections = registry.detect(semanticModel);
  const coverage = modules.analyzers.analyzeSemanticCoverage(graph);
  const graphValidation = modules.compiler.validateCoreGraph(graph);
  const statistics = softwareGraphStatistics(graph);
  const quality = {
    repository: graph.repository.name,
    graphHash: graph.metadata.deterministicHash,
    summary: coverage.summary,
    graphValidation,
    semanticModelValidation,
    diagnostics: coverage.diagnostics,
    relationshipDistribution: coverage.relationshipDistribution,
    confidenceHistogram: coverage.confidenceHistogram,
  };
  const semanticReports = Object.fromEntries(
    ["framework", "controllers", "routes", "modules", "providers"].map((target) => [
      target,
      modules.analyzers.createSemanticEntityReport(graph, target),
    ]),
  );

  await Promise.all([
    writeJson(join(outDir, "SoftwareGraph.json"), graph),
    writeJson(join(outDir, "diagnostics.json"), graph.diagnostics),
    writeJson(join(outDir, "metadata.json"), graph.metadata),
    writeJson(join(outDir, "indexes.json"), graph.indexes),
    writeJson(join(outDir, "statistics.json"), statistics),
    writeFile(join(outDir, "semantic-model.json"), modules.typescript.serializeTypeScriptProject(semanticModel), "utf8"),
    writeJson(join(outDir, "semantic-model-summary.json"), semanticModelSummary(semanticModel, semanticModelValidation)),
    writeJson(join(outDir, "coverage.json"), coverage),
    writeJson(join(outDir, "quality.json"), quality),
    writeJson(join(outDir, "frameworks.json"), {
      repository: graph.repository.name,
      graphHash: graph.metadata.deterministicHash,
      detections,
      detected: detections.filter((detection) => detection.detected),
    }),
    writeJson(join(outDir, "semantic-entities.json"), semanticReports),
    writeJson(join(outDir, "graph-validation.json"), graphValidation),
  ]);

  await writeJson(join(outDir, "result.json"), {
    slug,
    status: result.status,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: performance.now() - start,
    graphHash: graph.metadata.deterministicHash,
    files: result.discovery.files.length,
    stages: result.stages,
    compilerDiagnostics: result.diagnostics,
    graphValidation,
    semanticModelValidation,
  });

  writeOut(JSON.stringify({
    slug,
    status: result.status,
    files: result.discovery.files.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    diagnostics: graph.diagnostics.length,
    hash: graph.metadata.deterministicHash,
  }));
}

async function loadOntolyModules() {
  const modulePath = (packageName) => pathToFileURL(join(PROJECT_ROOT, "packages", packageName, "dist", "index.js")).href;

  const [
    compiler,
    parserTypescript,
    parserOpenApi,
    typescript,
    semantic,
    analyzers,
  ] = await Promise.all([
    import(modulePath("compiler")),
    import(modulePath("parser-typescript")),
    import(modulePath("parser-openapi")),
    import(modulePath("typescript")),
    import(modulePath("semantic")),
    import(modulePath("analyzers")),
  ]);

  return {
    compiler,
    parserTypescript,
    parserOpenApi,
    typescript,
    semantic,
    analyzers,
  };
}

async function createComparison(repo, repositorySummary, ontoly, graphify) {
  const ontolyNormalized = normalizeOntoly(ontoly);
  const graphifyNormalized = normalizeGraphify(graphify);
  const semanticComparison = compareCounts(SEMANTIC_CONCEPTS, ontolyNormalized.concepts, graphifyNormalized.concepts);
  const relationshipComparison = compareCounts(RELATIONSHIPS, ontolyNormalized.relationships, graphifyNormalized.relationships);
  const frameworkUnderstanding = compareFrameworkUnderstanding(repositorySummary, ontoly, graphify, semanticComparison, relationshipComparison);
  const strengths = identifyStrengths(ontoly, graphify, semanticComparison, relationshipComparison, frameworkUnderstanding);
  const weaknesses = identifyWeaknesses(ontoly, graphify, semanticComparison, relationshipComparison, frameworkUnderstanding);
  const recommendations = createRecommendations(repositorySummary, ontoly, graphify, semanticComparison, relationshipComparison, frameworkUnderstanding, weaknesses);
  const status = ontoly.status === "success" && graphify.status === "success" ? "success" : "partial";

  return {
    repository: {
      slug: repo.slug,
      name: repo.name,
      requestedPath: repo.requestedPath,
      actualPath: repo.actualPath,
      pathSubstitution: repo.pathSubstitution,
    },
    status,
    generatedAt: new Date().toISOString(),
    measured: {
      note: "Counts and timings are measured from generated artifacts. Strengths, weaknesses, and recommendations are inferred from normalized counts, diagnostics, and coverage metrics.",
      ontolyStatus: ontoly.status,
      graphifyStatus: graphify.status,
      graphifyMode: graphify.mode ?? null,
    },
    repositorySummary,
    graphStatistics: {
      ontoly: ontoly.statistics,
      graphify: graphify.statistics,
      ontolyCoverage: ontoly.coverage?.summary ?? null,
      ontolyQuality: ontoly.coverage?.summary ?? null,
      graphifyDiagnostics: graphify.diagnostics,
      ontolyDiagnostics: ontoly.diagnostics,
      ontolyGraphValidation: ontoly.graphValidation,
    },
    normalized: {
      ontoly: ontolyNormalized,
      graphify: graphifyNormalized,
    },
    semanticComparison,
    relationshipComparison,
    frameworkUnderstanding,
    performance: {
      ontoly: ontoly.benchmark,
      graphify: graphify.benchmark,
    },
    diagnostics: {
      ontoly: summarizeDiagnostics(ontoly.diagnostics, ontoly.graphValidation, ontoly.coverage),
      graphify: graphify.diagnostics,
    },
    strengths,
    weaknesses,
    recommendations,
  };
}

function normalizeOntoly(ontoly) {
  const graph = ontoly.graph;
  if (!graph) {
    return {
      concepts: {},
      relationships: {},
      frameworks: [],
      diagnostics: ontoly.diagnostics ?? [],
    };
  }

  const concepts = countBy(graph.nodes.map((node) => conceptForOntolyNode(node)).filter(Boolean));
  const relationships = countBy(graph.edges.map((edge) => canonicalRelationship(edge.type)).filter(Boolean));
  const frameworks = ontoly.frameworks?.detected?.map((detection) => ({
    name: detection.framework,
    confidence: detection.confidence,
    coverage: detection.coverage ?? null,
    evidence: detection.evidence ?? [],
  })) ?? [];

  return {
    concepts,
    relationships,
    frameworks,
    diagnostics: ontoly.diagnostics ?? [],
  };
}

function normalizeGraphify(graphify) {
  const graph = graphify.graph;
  if (!graph) {
    return {
      concepts: {},
      relationships: {},
      frameworks: [],
      diagnostics: graphify.diagnostics ?? [],
    };
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = graphifyEdges(graph);
  const concepts = countBy(nodes.map(conceptForGraphifyNode).filter(Boolean));
  const relationships = countBy(edges.map((edge) => canonicalRelationship(edge.relation ?? edge.type ?? edge.label)).filter(Boolean));
  const frameworks = inferGraphifyFrameworks(nodes, edges);

  return {
    concepts,
    relationships,
    frameworks,
    diagnostics: graphify.diagnostics ?? [],
  };
}

function compareCounts(labels, ontolyCounts, graphifyCounts) {
  return labels.map((label) => {
    const ontoly = ontolyCounts[label] ?? 0;
    const graphify = graphifyCounts[label] ?? 0;
    const delta = ontoly - graphify;
    const status = comparisonStatus(ontoly, graphify);

    return {
      concept: label,
      relationship: label,
      ontoly,
      graphify,
      delta,
      supported: ontoly > 0 && graphify > 0,
      missing: missingSide(ontoly, graphify),
      additional: additionalSide(ontoly, graphify),
      incorrect: "not measured",
      status,
    };
  });
}

function comparisonStatus(ontoly, graphify) {
  if (ontoly > 0 && graphify > 0) {
    const max = Math.max(ontoly, graphify);
    const min = Math.min(ontoly, graphify);
    return min / max >= 0.75 ? "supported" : "divergent";
  }

  if (ontoly > 0 && graphify === 0) {
    return "graphify_missing";
  }

  if (ontoly === 0 && graphify > 0) {
    return "ontoly_missing";
  }

  return "not_observed";
}

function missingSide(ontoly, graphify) {
  if (ontoly > 0 && graphify === 0) {
    return ["graphify"];
  }
  if (ontoly === 0 && graphify > 0) {
    return ["ontoly"];
  }
  return [];
}

function additionalSide(ontoly, graphify) {
  if (ontoly > graphify) {
    return ["ontoly"];
  }
  if (graphify > ontoly) {
    return ["graphify"];
  }
  return [];
}

function compareFrameworkUnderstanding(repositorySummary, ontoly, graphify, semanticComparison, relationshipComparison) {
  const expected = repositorySummary.frameworks;
  const ontolyDetected = ontoly.frameworks?.detected ?? [];
  const graphifyInferred = normalizeGraphify(graphify).frameworks;

  return expected.map((framework) => {
    const ontolyMatch = ontolyDetected.find((detection) => namesMatch(detection.framework, framework.name));
    const graphifyMatch = graphifyInferred.find((detection) => namesMatch(detection.name, framework.name));
    const missingConcepts = semanticComparison
      .filter((item) => item.ontoly === 0 && ["Routes", "Controllers", "Modules", "Services", "Providers"].includes(item.concept))
      .map((item) => item.concept);
    const relationshipGaps = relationshipComparison
      .filter((item) => item.ontoly === 0 && ["HANDLES", "MOUNTS", "INJECTS", "REGISTERED_IN", "AUTHORIZES"].includes(item.relationship))
      .map((item) => item.relationship);

    return {
      framework: framework.name,
      measured: {
        expectedFromRepository: framework.evidence,
        ontolyDetected: Boolean(ontolyMatch),
        graphifyInferred: Boolean(graphifyMatch),
      },
      coverage: ontolyMatch?.coverage ?? ontoly.coverage?.summary?.coverage ?? null,
      confidence: ontolyMatch?.confidence ?? null,
      missingConcepts,
      incorrectConcepts: "not measured",
      relationshipGaps,
    };
  });
}

function identifyStrengths(ontoly, graphify, semanticComparison, relationshipComparison, frameworkUnderstanding) {
  const strengths = [];
  const coverage = ontoly.coverage?.summary;

  if (coverage?.trustworthiness >= 90) {
    strengths.push({
      area: "Deterministic graph validation",
      evidence: `Ontoly trustworthiness is ${coverage.trustworthiness} with consistency ${coverage.consistency}.`,
      basis: "measured",
    });
  }

  for (const item of semanticComparison) {
    if (item.status === "graphify_missing" && item.ontoly > 0) {
      strengths.push({
        area: item.concept,
        evidence: `Ontoly produced ${item.ontoly} ${item.concept}; Graphify produced 0 in the normalized model.`,
        basis: "inferred from normalized counts",
      });
    }
  }

  for (const item of relationshipComparison) {
    if (["HANDLES", "MOUNTS", "INJECTS", "REGISTERED_IN", "AUTHORIZES"].includes(item.relationship) && item.ontoly > item.graphify) {
      strengths.push({
        area: item.relationship,
        evidence: `Ontoly produced ${item.ontoly} ${item.relationship} relationships; Graphify produced ${item.graphify}.`,
        basis: "inferred from normalized counts",
      });
    }
  }

  for (const framework of frameworkUnderstanding) {
    if (framework.measured.ontolyDetected && !framework.measured.graphifyInferred) {
      strengths.push({
        area: `${framework.framework} framework understanding`,
        evidence: "Ontoly detected the framework explicitly; Graphify only exposes framework understanding when it appears in normalized labels/relations.",
        basis: "inferred from framework detections",
      });
    }
  }

  if (strengths.length === 0 && ontoly.status === "success") {
    strengths.push({
      area: "Graph generation",
      evidence: "Ontoly produced a valid SoftwareGraph artifact for this repository.",
      basis: "measured",
    });
  }

  return strengths;
}

function identifyWeaknesses(ontoly, graphify, semanticComparison, relationshipComparison, frameworkUnderstanding) {
  const weaknesses = [];
  const validationIssues = ontoly.graphValidation?.issues ?? [];
  const errorIssues = validationIssues.filter((issue) => issue.severity === "error");
  const warningIssues = validationIssues.filter((issue) => issue.severity === "warning");

  if (ontoly.status !== "success") {
    weaknesses.push({
      area: "Ontoly execution",
      evidence: "Ontoly did not produce a SoftwareGraph artifact.",
      basis: "measured",
    });
  }

  if (graphify.status === "success_with_fallback") {
    weaknesses.push({
      area: "Graphify full semantic extraction",
      evidence: "Graphify required an LLM backend for docs/images, so the comparison uses a structural code-only fallback graph.",
      basis: "measured",
    });
  } else if (graphify.status !== "success") {
    weaknesses.push({
      area: "Graphify execution",
      evidence: "Graphify did not produce a graph artifact for comparison.",
      basis: "measured",
    });
  }

  if (errorIssues.length > 0) {
    weaknesses.push({
      area: "Graph validation errors",
      evidence: `${errorIssues.length} validation errors were reported.`,
      basis: "measured",
    });
  }

  if (warningIssues.length > 0) {
    weaknesses.push({
      area: "Graph validation warnings",
      evidence: `${warningIssues.length} validation warnings were reported.`,
      basis: "measured",
    });
  }

  for (const item of semanticComparison) {
    if (item.status === "ontoly_missing" && item.graphify > 0) {
      weaknesses.push({
        area: item.concept,
        evidence: `Graphify produced ${item.graphify} ${item.concept}; Ontoly produced 0 in the normalized model.`,
        basis: "inferred from normalized counts",
      });
    }
  }

  for (const item of relationshipComparison) {
    if (item.status === "ontoly_missing" && item.graphify > 0) {
      weaknesses.push({
        area: item.relationship,
        evidence: `Graphify produced ${item.graphify} ${item.relationship} relationships; Ontoly produced 0.`,
        basis: "inferred from normalized counts",
      });
    }
  }

  for (const framework of frameworkUnderstanding) {
    if (!framework.measured.ontolyDetected && framework.measured.expectedFromRepository.length > 0) {
      weaknesses.push({
        area: `${framework.framework} detection`,
        evidence: `Repository evidence suggests ${framework.framework}, but Ontoly did not explicitly detect it.`,
        basis: "inferred from package metadata",
      });
    }
  }

  return weaknesses;
}

function createRecommendations(repositorySummary, ontoly, graphify, semanticComparison, relationshipComparison, frameworkUnderstanding, weaknesses) {
  const recommendations = [];
  const validationIssues = ontoly.graphValidation?.issues ?? [];
  const groupedValidationIssues = groupBy(validationIssues, (issue) => issue.code);

  for (const [code, issues] of Object.entries(groupedValidationIssues)) {
    const priority = issues.some((issue) => issue.severity === "error") ? "Critical" : "High";
    recommendations.push({
      priority,
      description: `${issues.length} graph validation issue(s) with code ${code}.`,
      suggestedFix: suggestedFixForValidationCode(code),
      evidence: issues.slice(0, 5).map((issue) => issue.message),
    });
  }

  for (const item of relationshipComparison) {
    if (item.ontoly === 0 && item.graphify > 0) {
      recommendations.push({
        priority: ["CALLS", "IMPORTS", "EXPORTS", "CONTAINS"].includes(item.relationship) ? "High" : "Medium",
        description: `Ontoly did not emit ${item.relationship}, while Graphify emitted ${item.graphify}.`,
        suggestedFix: `Add or extend relationship extraction for ${item.relationship} and cover it with deterministic snapshots.`,
        evidence: [`Normalized Graphify ${item.relationship} count: ${item.graphify}`],
      });
    }
  }

  for (const framework of frameworkUnderstanding) {
    if (framework.framework === "NestJS" && framework.relationshipGaps.length > 0) {
      recommendations.push({
        priority: "High",
        description: `NestJS semantic relationships are incomplete: ${framework.relationshipGaps.join(", ")}.`,
        suggestedFix: "Extend the NestJS analyzer for module/controller/provider wiring and add per-framework validation fixtures.",
        evidence: framework.relationshipGaps,
      });
    }

    if (!framework.measured.ontolyDetected) {
      recommendations.push({
        priority: "Medium",
        description: `${framework.framework} was inferred from repository metadata but not detected by Ontoly.`,
        suggestedFix: `Add a ${framework.framework} framework detector or map existing package evidence to a Framework node.`,
        evidence: framework.measured.expectedFromRepository,
      });
    }
  }

  if (ontoly.coverage?.summary?.trustworthiness < 90) {
    recommendations.push({
      priority: "High",
      description: `Ontoly trustworthiness is ${ontoly.coverage.summary.trustworthiness}.`,
      suggestedFix: "Prioritize coverage metrics with warn/fail status and convert the failing cases into repository-specific fixtures.",
      evidence: ontoly.coverage.metrics
        .filter((metric) => metric.status !== "pass" && metric.total > 0)
        .map((metric) => `${metric.label}: ${metric.coverage}%`),
    });
  }

  if (graphify.status === "success_with_fallback") {
    recommendations.push({
      priority: "Medium",
      description: "Graphify full semantic extraction was unavailable without an LLM backend.",
      suggestedFix: "For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.",
      evidence: graphify.diagnostics.map((diagnostic) => diagnostic.message),
    });
  } else if (graphify.status !== "success") {
    recommendations.push({
      priority: "Medium",
      description: "Graphify failed or did not produce graph.json.",
      suggestedFix: "Inspect Graphify stdout/stderr artifacts and decide whether the validation invocation needs a repo-specific exclusion or backend configuration.",
      evidence: graphify.diagnostics.map((diagnostic) => diagnostic.message),
    });
  }

  return dedupeRecommendations(recommendations, weaknesses);
}

function suggestedFixForValidationCode(code) {
  switch (code) {
    case "ROUTE_MISSING_HANDLES":
      return "Connect route nodes to handler methods during framework semantic graph construction.";
    case "ROUTE_MISSING_CONTROLLER":
      return "Connect route nodes to controllers/modules through MOUNTS, CONTAINS, or EXPOSES edges.";
    case "CONTROLLER_MISSING_MODULE":
      return "Resolve framework module declarations and register controllers under their declaring module.";
    case "PROVIDER_WITHOUT_CONSUMERS":
      return "Improve provider consumer detection or mark intentionally public/root providers with explicit metadata.";
    case "INVALID_DI_TARGET":
      return "Resolve dependency injection targets to provider/service/repository nodes instead of packages or external placeholders.";
    case "DUPLICATE_ROUTE":
      return "Include controller mount path and method path normalization in stable route IDs.";
    default:
      return "Add a deterministic fixture for this validation issue and repair the graph construction invariant.";
  }
}

function dedupeRecommendations(recommendations) {
  const seen = new Set();
  return recommendations.filter((item) => {
    const key = `${item.priority}|${item.description}|${item.suggestedFix}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function writeComparisonArtifacts(repo, comparison) {
  const comparisonDir = join(VALIDATION_ROOT, repo.slug, "comparison");
  await writeJson(join(comparisonDir, "comparison.json"), comparison);
  await writeFile(join(comparisonDir, "comparison.md"), renderComparisonMarkdown(comparison), "utf8");
}

async function writePerRepositoryReport(repo, comparison) {
  const report = renderRepositoryReport(comparison);
  await writeFile(join(VALIDATION_ROOT, repo.slug, "report.md"), report, "utf8");
}

async function writeTopLevelIndexes(repo, ontoly, graphify, comparison) {
  const graphifyDir = join(VALIDATION_ROOT, "graphify", repo.slug);
  const ontolyDir = join(VALIDATION_ROOT, "ontoly", repo.slug);
  const comparisonsDir = join(VALIDATION_ROOT, "comparisons", repo.slug);
  await Promise.all([
    mkdir(graphifyDir, { recursive: true }),
    mkdir(ontolyDir, { recursive: true }),
    mkdir(comparisonsDir, { recursive: true }),
  ]);

  await Promise.all([
    writeJson(join(graphifyDir, "artifacts.json"), {
      status: graphify.status,
      paths: graphify.paths,
      statistics: graphify.statistics,
      benchmark: graphify.benchmark,
      outputFiles: graphify.outputFiles,
    }),
    writeJson(join(ontolyDir, "artifacts.json"), {
      status: ontoly.status,
      paths: ontoly.paths,
      statistics: ontoly.statistics,
      coverage: ontoly.coverage?.summary ?? null,
      benchmark: ontoly.benchmark,
      outputFiles: ontoly.outputFiles,
    }),
    writeJson(join(comparisonsDir, "comparison.json"), comparison),
    writeFile(join(comparisonsDir, "comparison.md"), renderComparisonMarkdown(comparison), "utf8"),
    writeJson(join(VALIDATION_ROOT, "benchmarks", `${repo.slug}.json`), {
      repository: repo.name,
      ontoly: ontoly.benchmark,
      graphify: graphify.benchmark,
    }),
    writeFile(join(VALIDATION_ROOT, "reports", `${repo.slug}.md`), renderRepositoryReport(comparison), "utf8"),
  ]);
}

async function createAggregateSummary(results, previousBaseline, startedAt) {
  const analyzed = results.filter((result) => result.status !== "missing");
  const totals = analyzed.reduce((acc, result) => {
    acc.files += result.repository?.files?.total ?? 0;
    acc.sourceFiles += result.repository?.files?.source ?? 0;
    acc.ontolyNodes += result.ontoly?.statistics?.nodes ?? 0;
    acc.ontolyEdges += result.ontoly?.statistics?.edges ?? 0;
    acc.graphifyNodes += result.graphify?.statistics?.nodes ?? 0;
    acc.graphifyEdges += result.graphify?.statistics?.edges ?? 0;
    acc.ontolyDurationMs += result.ontoly?.benchmark?.durationMs ?? 0;
    acc.graphifyDurationMs += result.graphify?.benchmark?.durationMs ?? 0;
    return acc;
  }, {
    files: 0,
    sourceFiles: 0,
    ontolyNodes: 0,
    ontolyEdges: 0,
    graphifyNodes: 0,
    graphifyEdges: 0,
    ontolyDurationMs: 0,
    graphifyDurationMs: 0,
  });
  const coverageValues = analyzed
    .map((result) => result.ontoly?.coverage?.summary?.coverage)
    .filter((value) => typeof value === "number");
  const trustValues = analyzed
    .map((result) => result.ontoly?.coverage?.summary?.trustworthiness)
    .filter((value) => typeof value === "number");
  const frameworkCoverageValues = analyzed
    .flatMap((result) => result.comparison?.frameworkUnderstanding ?? [])
    .map((framework) => framework.coverage)
    .filter((value) => typeof value === "number");
  const relationshipCoverage = relationshipCoverageSummary(analyzed);
  const frameworkCoverage = frameworkCoverageSummary(analyzed);
  const current = {
    generatedAt: new Date().toISOString(),
    repositories: analyzed.map((result) => ({
      slug: result.slug,
      status: result.status,
      ontoly: {
        nodes: result.ontoly?.statistics?.nodes ?? 0,
        edges: result.ontoly?.statistics?.edges ?? 0,
        coverage: result.ontoly?.coverage?.summary?.coverage ?? null,
        trustworthiness: result.ontoly?.coverage?.summary?.trustworthiness ?? null,
        durationMs: result.ontoly?.benchmark?.durationMs ?? null,
      },
      graphify: {
        nodes: result.graphify?.statistics?.nodes ?? 0,
        edges: result.graphify?.statistics?.edges ?? 0,
        durationMs: result.graphify?.benchmark?.durationMs ?? null,
      },
      graphHash: result.ontoly?.graphHash ?? null,
    })),
  };
  const regression = compareRegression(previousBaseline, current);

  return {
    generatedAt: new Date().toISOString(),
    startedAt,
    repositoriesAnalyzed: analyzed.length,
    repositoriesRequested: results.length,
    repositories: results.map((result) => aggregateRepositoryRow(result)),
    totals,
    averages: {
      semanticCoverage: round(average(coverageValues)),
      trustScore: round(average(trustValues)),
      graphQuality: round(average(trustValues)),
      frameworkCoverage: round(average(frameworkCoverageValues)),
      ontolyAnalysisTimeMs: round(average(analyzed.map((result) => result.ontoly?.benchmark?.durationMs ?? 0))),
      graphifyAnalysisTimeMs: round(average(analyzed.map((result) => result.graphify?.benchmark?.durationMs ?? 0))),
    },
    graphSize: {
      ontoly: {
        nodes: totals.ontolyNodes,
        edges: totals.ontolyEdges,
      },
      graphify: {
        nodes: totals.graphifyNodes,
        edges: totals.graphifyEdges,
      },
    },
    memory: {
      ontolyPeakBytes: sum(analyzed.map((result) => result.ontoly?.benchmark?.time?.peakMemoryBytes ?? 0)),
      graphifyPeakBytes: sum(analyzed.map((result) => result.graphify?.benchmark?.time?.peakMemoryBytes ?? 0)),
    },
    performance: {
      ontolyTotalMs: round(totals.ontolyDurationMs),
      graphifyTotalMs: round(totals.graphifyDurationMs),
    },
    relationshipCoverage,
    frameworkCoverage,
    topStrengths: topItems(analyzed.flatMap((result) => result.comparison?.strengths ?? []), "area"),
    topWeaknesses: topItems(analyzed.flatMap((result) => result.comparison?.weaknesses ?? []), "area"),
    highestPriorityImprovements: analyzed
      .flatMap((result) => (result.comparison?.recommendations ?? []).map((recommendation) => ({
        repository: result.name,
        ...recommendation,
      })))
      .sort(compareRecommendations)
      .slice(0, 20),
    regression: {
      ...regression,
      current,
    },
  };
}

function aggregateRepositoryRow(result) {
  if (result.status === "missing") {
    return {
      slug: result.slug,
      name: result.name,
      status: "missing",
      requestedPath: result.repository?.requestedPath,
    };
  }

  return {
    slug: result.slug,
    name: result.name,
    status: result.status,
    requestedPath: result.requestedPath,
    actualPath: result.actualPath,
    frameworks: result.repository.frameworks.map((framework) => framework.name),
    files: result.repository.files.total,
    packages: result.repository.packageJsonCount,
    ontoly: {
      nodes: result.ontoly.statistics?.nodes ?? 0,
      edges: result.ontoly.statistics?.edges ?? 0,
      diagnostics: result.ontoly.diagnostics?.length ?? 0,
      trust: result.ontoly.coverage?.summary?.trustworthiness ?? null,
      coverage: result.ontoly.coverage?.summary?.coverage ?? null,
      durationMs: result.ontoly.benchmark?.durationMs ?? null,
    },
    graphify: {
      nodes: result.graphify.statistics?.nodes ?? 0,
      edges: result.graphify.statistics?.edges ?? 0,
      diagnostics: result.graphify.diagnostics?.length ?? 0,
      durationMs: result.graphify.benchmark?.durationMs ?? null,
    },
  };
}

function compareRegression(previousBaseline, current) {
  if (!previousBaseline) {
    return {
      status: "PASS",
      baseline: "initialized",
      failures: [],
      warnings: ["No previous baseline existed. Current results were written as regression-baseline.json."],
    };
  }

  const failures = [];
  const warnings = [];
  const previousBySlug = new Map((previousBaseline.repositories ?? []).map((repo) => [repo.slug, repo]));

  for (const repo of current.repositories) {
    const previous = previousBySlug.get(repo.slug);
    if (!previous) {
      warnings.push(`${repo.slug}: no previous baseline entry.`);
      continue;
    }

    const coverageDrop = numericDrop(previous.ontoly?.coverage, repo.ontoly?.coverage);
    const trustDrop = numericDrop(previous.ontoly?.trustworthiness, repo.ontoly?.trustworthiness);
    const nodeDrop = ratioDrop(previous.ontoly?.nodes, repo.ontoly?.nodes);
    const edgeDrop = ratioDrop(previous.ontoly?.edges, repo.ontoly?.edges);
    const durationIncrease = ratioIncrease(previous.ontoly?.durationMs, repo.ontoly?.durationMs);

    if (coverageDrop > 2) {
      failures.push(`${repo.slug}: semantic coverage dropped by ${round(coverageDrop)} points.`);
    }
    if (trustDrop > 2) {
      failures.push(`${repo.slug}: trustworthiness dropped by ${round(trustDrop)} points.`);
    }
    if (nodeDrop > 0.05) {
      failures.push(`${repo.slug}: Ontoly node count dropped by ${round(nodeDrop * 100)}%.`);
    }
    if (edgeDrop > 0.05) {
      failures.push(`${repo.slug}: Ontoly edge count dropped by ${round(edgeDrop * 100)}%.`);
    }
    if (durationIncrease > 0.25) {
      warnings.push(`${repo.slug}: Ontoly analysis time increased by ${round(durationIncrease * 100)}%.`);
    }
  }

  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    baseline: "compared",
    failures,
    warnings,
  };
}

function relationshipCoverageSummary(results) {
  return RELATIONSHIPS.map((relationship) => {
    const rows = results.map((result) =>
      result.comparison?.relationshipComparison?.find((item) => item.relationship === relationship),
    ).filter(Boolean);
    return {
      relationship,
      repositoriesObserved: rows.filter((row) => row.ontoly > 0 || row.graphify > 0).length,
      ontolyTotal: sum(rows.map((row) => row.ontoly)),
      graphifyTotal: sum(rows.map((row) => row.graphify)),
      supportedRepositories: rows.filter((row) => row.supported).length,
    };
  });
}

function frameworkCoverageSummary(results) {
  const frameworks = new Map();
  for (const result of results) {
    for (const framework of result.comparison?.frameworkUnderstanding ?? []) {
      const existing = frameworks.get(framework.framework) ?? {
        framework: framework.framework,
        repositories: 0,
        ontolyDetected: 0,
        graphifyInferred: 0,
        coverageValues: [],
      };
      existing.repositories += 1;
      existing.ontolyDetected += framework.measured.ontolyDetected ? 1 : 0;
      existing.graphifyInferred += framework.measured.graphifyInferred ? 1 : 0;
      if (typeof framework.coverage === "number") {
        existing.coverageValues.push(framework.coverage);
      }
      frameworks.set(framework.framework, existing);
    }
  }

  return [...frameworks.values()]
    .map((framework) => ({
      framework: framework.framework,
      repositories: framework.repositories,
      ontolyDetected: framework.ontolyDetected,
      graphifyInferred: framework.graphifyInferred,
      averageCoverage: round(average(framework.coverageValues)),
    }))
    .sort((left, right) => left.framework.localeCompare(right.framework));
}

function graphifyStatistics(graph) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = graphifyEdges(graph);
  const relationCounts = countBy(edges.map((edge) => String(edge.relation ?? edge.type ?? "unknown")));
  const semanticRelationshipCounts = countBy(edges.map((edge) => canonicalRelationship(edge.relation ?? edge.type ?? "unknown")).filter(Boolean));
  const fileTypeCounts = countBy(nodes.map((node) => String(node.file_type ?? node.type ?? "unknown")));
  const conceptCounts = countBy(nodes.map(conceptForGraphifyNode).filter(Boolean));

  return {
    nodes: nodes.length,
    edges: edges.length,
    hyperedges: Array.isArray(graph.hyperedges) ? graph.hyperedges.length : 0,
    directed: graph.directed ?? null,
    multigraph: graph.multigraph ?? null,
    nodesByFileType: fileTypeCounts,
    concepts: conceptCounts,
    relations: relationCounts,
    semanticRelationships: semanticRelationshipCounts,
  };
}

function softwareGraphStatistics(graph) {
  return {
    files: graph.metadata.fileCount,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    diagnostics: graph.diagnostics.length,
    nodesByType: countBy(graph.nodes.map((node) => node.type)),
    edgesByType: countBy(graph.edges.map((edge) => edge.type)),
    parserVersions: graph.metadata.parserVersions,
    deterministicHash: graph.metadata.deterministicHash,
  };
}

function semanticModelSummary(project, validation) {
  return {
    version: project.version,
    compilerVersion: project.compilerVersion,
    files: project.files.length,
    symbols: project.symbols.length,
    classes: project.classes.length,
    interfaces: project.interfaces.length,
    functions: project.functions.length,
    methods: project.methods.length,
    variables: project.variables.length,
    enums: project.enums.length,
    namespaces: project.namespaces.length,
    imports: project.imports.length,
    exports: project.exports.length,
    calls: project.calls.length,
    decorators: project.decorators.length,
    types: project.types.length,
    constructors: project.constructors.length,
    creates: project.creates.length,
    throws: project.throws.length,
    environmentAccesses: project.environmentAccesses.length,
    diagnostics: project.diagnostics.length,
    hash: project.metadata.deterministicHash,
    validation,
  };
}

function graphifyDiagnostics(runResult, graph, diagnoseResult, activeRun, fallbackRun) {
  const diagnostics = [];

  if (runResult.exitCode !== 0) {
    diagnostics.push({
      severity: activeRun?.mode === "structural-code-projection" ? "warning" : "error",
      code: "GRAPHIFY_EXIT_NONZERO",
      message: `Graphify exited with code ${runResult.exitCode}.`,
      source: "graphify",
    });
  }

  if (fallbackRun) {
    diagnostics.push({
      severity: activeRun?.mode === "structural-code-projection" ? "warning" : "error",
      code: "GRAPHIFY_FULL_REQUIRES_LLM",
      message: "Full Graphify extraction required an LLM backend for repository docs/images.",
      source: "graphify",
    });
  }

  if (activeRun?.mode === "structural-code-projection") {
    diagnostics.push({
      severity: "warning",
      code: "GRAPHIFY_STRUCTURAL_FALLBACK_USED",
      message: `Graphify comparison uses a code-only projection with ${fallbackRun?.projection?.includedFiles ?? 0} files.`,
      source: "validation harness",
    });
  }

  if (!graph) {
    diagnostics.push({
      severity: "error",
      code: "GRAPHIFY_MISSING_GRAPH",
      message: "Graphify did not produce graphify-out/graph.json.",
      source: "graphify",
    });
  }

  if (diagnoseResult?.exitCode && diagnoseResult.exitCode !== 0) {
    diagnostics.push({
      severity: "warning",
      code: "GRAPHIFY_DIAGNOSE_FAILED",
      message: `graphify diagnose exited with code ${diagnoseResult.exitCode}.`,
      source: "graphify",
    });
  }

  const parsed = diagnoseResult?.parsed;
  if (parsed?.warnings) {
    for (const warning of parsed.warnings) {
      diagnostics.push({
        severity: "warning",
        code: "GRAPHIFY_DIAGNOSE_WARNING",
        message: typeof warning === "string" ? warning : JSON.stringify(warning),
        source: "graphify diagnose",
      });
    }
  }

  return diagnostics;
}

function summarizeDiagnostics(diagnostics, graphValidation, coverage) {
  return {
    compilerDiagnostics: diagnostics.length,
    graphValidation: {
      ok: graphValidation?.ok ?? null,
      issues: graphValidation?.issues?.length ?? 0,
      errors: graphValidation?.issues?.filter((issue) => issue.severity === "error").length ?? 0,
      warnings: graphValidation?.issues?.filter((issue) => issue.severity === "warning").length ?? 0,
      byCode: countBy((graphValidation?.issues ?? []).map((issue) => issue.code)),
    },
    coverageWarnings: coverage?.diagnostics?.length ?? 0,
  };
}

function conceptForOntolyNode(node) {
  switch (node.type) {
    case "Function":
      return "Functions";
    case "Method":
      return "Methods";
    case "Class":
      return "Classes";
    case "Interface":
      return "Interfaces";
    case "Route":
      return "Routes";
    case "Controller":
      return "Controllers";
    case "Module":
      return "Modules";
    case "Service":
      return "Services";
    case "Provider":
      return "Providers";
    case "Repository":
      return "Repositories";
    case "Package":
      return "Packages";
    case "Configuration":
      return "Configuration";
    case "EnvironmentVariable":
      return "Environment Variables";
    default:
      return null;
  }
}

function conceptForGraphifyNode(node) {
  const label = String(node.label ?? node.name ?? node.id ?? "");
  const lower = label.toLowerCase();
  const extension = extname(label).toLowerCase();

  if ([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].includes(extension)) {
    return "Modules";
  }

  if (/\b[A-Z]+:\/[^/]/.test(label) || /\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//.test(label)) {
    return "Routes";
  }

  if (label.endsWith("Controller") || lower.includes(" controller")) {
    return "Controllers";
  }

  if (label.endsWith("Module") || lower.includes(" module")) {
    return "Modules";
  }

  if (label.endsWith("Service") || lower.includes(" service")) {
    return "Services";
  }

  if (label.endsWith("Repository") || lower.includes(" repository")) {
    return "Repositories";
  }

  if (label.endsWith("Provider") || lower.includes(" provider")) {
    return "Providers";
  }

  if (lower.includes("config") || lower.includes("configuration")) {
    return "Configuration";
  }

  if (/^[A-Z0-9_]{4,}$/.test(label) && label.includes("_")) {
    return "Environment Variables";
  }

  if (label.includes("()") || /^\.[A-Za-z_$][\w$]*\(\)/.test(label)) {
    return label.startsWith(".") ? "Methods" : "Functions";
  }

  if (/^I[A-Z][A-Za-z0-9_]+$/.test(label)) {
    return "Interfaces";
  }

  if (/^[A-Z][A-Za-z0-9_]+$/.test(label)) {
    return "Classes";
  }

  return null;
}

function canonicalRelationship(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().replace(/[-\s]/g, "_").toUpperCase();
  const aliases = {
    CALL: "CALLS",
    CALLS: "CALLS",
    IMPORT: "IMPORTS",
    IMPORTS: "IMPORTS",
    EXPORT: "EXPORTS",
    EXPORTS: "EXPORTS",
    CONTAIN: "CONTAINS",
    CONTAINS: "CONTAINS",
    HANDLES: "HANDLES",
    HANDLE: "HANDLES",
    MOUNTS: "MOUNTS",
    MOUNT: "MOUNTS",
    INJECTS: "INJECTS",
    INJECT: "INJECTS",
    READ: "READS",
    READS: "READS",
    WRITE: "WRITES",
    WRITES: "WRITES",
    USE: "USES",
    USES: "USES",
    DEPENDS: "DEPENDS_ON",
    DEPENDS_ON: "DEPENDS_ON",
    AUTHORIZES: "AUTHORIZES",
    AUTHORIZE: "AUTHORIZES",
    REGISTERED_IN: "REGISTERED_IN",
    REGISTERED: "REGISTERED_IN",
    REGISTEREDIN: "REGISTERED_IN",
    IMPLEMENTS: "IMPLEMENTS",
    IMPLEMENT: "IMPLEMENTS",
    EXTENDS: "EXTENDS",
    EXTEND: "EXTENDS",
    REFERENCES: "REFERENCES",
    REFERENCE: "REFERENCES",
    REFERS_TO: "REFERENCES",
    CREATES: "CREATES",
    CREATE: "CREATES",
    THROWS: "THROWS",
    THROW: "THROWS",
    RETURNS: "RETURNS",
    RETURN: "RETURNS",
    PUBLISHES: "PUBLISHES",
    PUBLISH: "PUBLISHES",
    SUBSCRIBES: "SUBSCRIBES",
    SUBSCRIBE: "SUBSCRIBES",
  };

  return aliases[normalized] ?? null;
}

function inferGraphifyFrameworks(nodes, edges) {
  const haystack = [
    ...nodes.map((node) => `${node.label ?? ""} ${node.source_file ?? ""}`),
    ...edges.map((edge) => `${edge.relation ?? ""} ${edge.source_file ?? ""}`),
  ].join("\n").toLowerCase();
  const frameworks = [];

  for (const framework of [
    ["NestJS", ["nestjs", "@nestjs", "controller", "injectable"]],
    ["Next.js", ["next.config", "nextjs", "next.js"]],
    ["React", ["react", ".tsx"]],
    ["Express", ["express"]],
    ["Fastify", ["fastify"]],
    ["Prisma", ["prisma", "schema.prisma"]],
    ["Turborepo", ["turbo.json", "turborepo"]],
  ]) {
    const evidence = framework[1].filter((needle) => haystack.includes(needle));
    if (evidence.length > 0) {
      frameworks.push({
        name: framework[0],
        confidence: evidence.length > 1 ? "inferred" : "low",
        evidence,
      });
    }
  }

  return frameworks;
}

function detectFrameworks(packageJsonInput, files) {
  const packageJsons = Array.isArray(packageJsonInput) ? packageJsonInput : [packageJsonInput].filter(Boolean);
  const dependencies = [...new Set(packageJsons.flatMap(collectDependencyNames))];
  const fileNames = files.map((file) => file.toLowerCase());
  const repoFileSet = new Set(files.map((file) => basename(file).toLowerCase()));
  const frameworks = [];
  const add = (name, evidence, confidence = "inferred") => {
    if (evidence.length > 0) {
      frameworks.push({ name, confidence, evidence: [...new Set(evidence)].sort() });
    }
  };

  add("NestJS", dependencies.filter((dep) => dep.startsWith("@nestjs/")), "exact");
  add("Next.js", dependencies.filter((dep) => dep === "next"), "exact");
  add("React", dependencies.filter((dep) => dep === "react" || dep === "react-dom"), "exact");
  add("Express", dependencies.filter((dep) => dep === "express"), "exact");
  add("Fastify", dependencies.filter((dep) => dep === "fastify" || dep.startsWith("@fastify/")), "exact");
  add("Hono", dependencies.filter((dep) => dep === "hono"), "exact");
  add("Prisma", [
    ...dependencies.filter((dep) => dep === "prisma" || dep === "@prisma/client"),
    ...fileNames.filter((file) => file.endsWith("schema.prisma")),
  ], "exact");
  add("GraphQL", dependencies.filter((dep) => dep === "graphql" || dep.includes("apollo")), "exact");
  add("tRPC", dependencies.filter((dep) => dep.startsWith("@trpc/")), "exact");
  add("Turborepo", [
    ...dependencies.filter((dep) => dep === "turbo"),
    ...(repoFileSet.has("turbo.json") ? ["turbo.json"] : []),
  ], "exact");
  add("Vite", dependencies.filter((dep) => dep === "vite"), "exact");

  return frameworks.sort((left, right) => left.name.localeCompare(right.name));
}

function collectDependencyNames(packageJson) {
  if (!packageJson || typeof packageJson !== "object") {
    return [];
  }

  return Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
  });
}

function workspacePackages(packageJson) {
  if (!packageJson?.workspaces) {
    return [];
  }

  if (Array.isArray(packageJson.workspaces)) {
    return packageJson.workspaces;
  }

  if (Array.isArray(packageJson.workspaces.packages)) {
    return packageJson.workspaces.packages;
  }

  return [];
}

function graphifyEdges(graph) {
  if (Array.isArray(graph.links)) {
    return graph.links;
  }
  if (Array.isArray(graph.edges)) {
    return graph.edges;
  }
  return [];
}

async function runTimedCommand(command, args, options) {
  const timePath = "/usr/bin/time";
  const useTime = existsSync(timePath);
  const executable = useTime ? timePath : command;
  const finalArgs = useTime ? ["-l", command, ...args] : args;
  const result = await runCommand(executable, finalArgs, options);
  const stderr = await readTextIfExists(options.stderrPath);
  return {
    ...result,
    time: parseTimeOutput(stderr),
  };
}

async function runCommand(command, args, options) {
  const started = performance.now();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolveExit) => {
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      resolveExit(127);
    });
    child.on("close", (code) => resolveExit(code ?? 0));
  });

  const durationMs = performance.now() - started;
  await Promise.all([
    writeFile(options.stdoutPath, stdout, "utf8"),
    writeFile(options.stderrPath, stderr, "utf8"),
  ]);

  return {
    exitCode,
    durationMs,
  };
}

function parseTimeOutput(stderr) {
  const realSeconds = matchNumber(stderr, /^\s*([\d.]+)\s+real/m);
  const maxResident = matchInteger(stderr, /^\s*(\d+)\s+maximum resident set size/m);
  const peakFootprint = matchInteger(stderr, /^\s*(\d+)\s+peak memory footprint/m);
  return {
    realSeconds,
    maxResidentSetBytes: maxResident,
    peakMemoryFootprintBytes: peakFootprint,
    peakMemoryBytes: Math.max(maxResident ?? 0, peakFootprint ?? 0) || null,
    source: "/usr/bin/time -l",
  };
}

function matchNumber(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function matchInteger(text, pattern) {
  const match = text.match(pattern);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function graphifyVersion() {
  const out = join(VALIDATION_ROOT, "graphify-version.stdout.log");
  const err = join(VALIDATION_ROOT, "graphify-version.stderr.log");
  const result = await runCommand(GRAPHIFY_COMMAND, ["--version"], {
    cwd: VALIDATION_ROOT,
    stdoutPath: out,
    stderrPath: err,
  });
  if (result.exitCode !== 0) {
    return null;
  }
  return (await readTextIfExists(out)).trim() || null;
}

async function walkFiles(root) {
  const files = [];
  async function visit(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await visit(join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        files.push(join(dir, entry.name));
      }
    }
  }

  await visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

async function listFilesIfExists(root) {
  if (!(await pathExists(root))) {
    return [];
  }
  const files = await walkFiles(root);
  return files.map((file) => relative(root, file)).sort((left, right) => left.localeCompare(right));
}

function isSourceFile(file) {
  return [
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".yml",
    ".yaml",
    ".graphql",
    ".prisma",
    ".sql",
  ].includes(extname(file).toLowerCase());
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function readTextIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fileSha256(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}

function expandHome(path) {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return isAbsolute(path) ? path : resolve(path);
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    if (!value) {
      continue;
    }
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function groupBy(items, keyFn) {
  const groups = {};
  for (const item of items) {
    const key = keyFn(item);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
  }
  return groups;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function average(values) {
  const numeric = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return numeric.length === 0 ? 0 : sum(numeric) / numeric.length;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function numericDrop(previous, current) {
  if (typeof previous !== "number" || typeof current !== "number") {
    return 0;
  }
  return Math.max(0, previous - current);
}

function ratioDrop(previous, current) {
  if (!previous || typeof current !== "number") {
    return 0;
  }
  return Math.max(0, (previous - current) / previous);
}

function ratioIncrease(previous, current) {
  if (!previous || typeof current !== "number") {
    return 0;
  }
  return Math.max(0, (current - previous) / previous);
}

function topItems(items, key) {
  const counts = countBy(items.map((item) => item[key]).filter(Boolean));
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 10);
}

function compareRecommendations(left, right) {
  const priorityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9)
    || left.repository.localeCompare(right.repository)
    || left.description.localeCompare(right.description);
}

function namesMatch(left, right) {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatCount(value) {
  return typeof value === "number" ? value.toLocaleString("en-US") : "n/a";
}

function formatMs(value) {
  return typeof value === "number" ? `${round(value)}ms` : "n/a";
}

function formatBytes(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "n/a";
  }
  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${round(current, 1)} ${units[index]}`;
}

function renderComparisonMarkdown(comparison) {
  if (comparison.status === "missing") {
    return renderMissingComparison(comparison.repository);
  }

  return [
    `# ${comparison.repository.name} Comparison`,
    "",
    "## Repository Summary",
    "",
    `- Requested path: ${comparison.repository.requestedPath}`,
    `- Actual path: ${comparison.repository.actualPath}`,
    comparison.repository.pathSubstitution ? `- Path note: ${comparison.repository.pathSubstitution.reason}` : null,
    `- Files: ${comparison.repositorySummary.files.total}`,
    `- Source files: ${comparison.repositorySummary.files.source}`,
    `- Packages: ${comparison.repositorySummary.packageJsonCount}`,
    `- Frameworks: ${comparison.repositorySummary.frameworks.map((framework) => framework.name).join(", ") || "none detected from package metadata"}`,
    "",
    "## Graph Statistics",
    "",
    "| Tool | Nodes | Edges | Diagnostics | Hash |",
    "| --- | ---: | ---: | ---: | --- |",
    `| Ontoly | ${comparison.graphStatistics.ontoly?.nodes ?? 0} | ${comparison.graphStatistics.ontoly?.edges ?? 0} | ${comparison.graphStatistics.ontoly?.diagnostics ?? 0} | ${comparison.performance.ontoly.graphHash ?? "n/a"} |`,
    `| Graphify | ${comparison.graphStatistics.graphify?.nodes ?? 0} | ${comparison.graphStatistics.graphify?.edges ?? 0} | ${comparison.graphStatistics.graphify?.diagnostics ?? 0} | ${comparison.performance.graphify.graphHash ?? "n/a"} |`,
    "",
    "## Semantic Comparison",
    "",
    renderComparisonTable(comparison.semanticComparison, "concept"),
    "",
    "## Relationship Comparison",
    "",
    renderComparisonTable(comparison.relationshipComparison, "relationship"),
    "",
    "## Framework Understanding",
    "",
    renderFrameworkTable(comparison.frameworkUnderstanding),
    "",
    "## Performance",
    "",
    "| Tool | Cold Analysis | Peak Memory | Graph Hash |",
    "| --- | ---: | ---: | --- |",
    `| Ontoly | ${formatMs(comparison.performance.ontoly.durationMs)} | ${formatBytes(comparison.performance.ontoly.time?.peakMemoryBytes)} | ${comparison.performance.ontoly.graphHash ?? "n/a"} |`,
    `| Graphify | ${formatMs(comparison.performance.graphify.durationMs)} | ${formatBytes(comparison.performance.graphify.time?.peakMemoryBytes)} | ${comparison.performance.graphify.graphHash ?? "n/a"} |`,
    "",
    "## Diagnostics",
    "",
    `- Ontoly compiler diagnostics: ${comparison.diagnostics.ontoly.compilerDiagnostics}`,
    `- Ontoly graph validation: ${comparison.diagnostics.ontoly.graphValidation.ok ? "PASS" : "WARN/FAIL"} (${comparison.diagnostics.ontoly.graphValidation.issues} issues)`,
    `- Graphify diagnostics: ${comparison.diagnostics.graphify.length}`,
    "",
    "## Strengths",
    "",
    renderEvidenceList(comparison.strengths),
    "",
    "## Weaknesses",
    "",
    renderEvidenceList(comparison.weaknesses),
    "",
    "## Recommendations",
    "",
    renderRecommendationList(comparison.recommendations),
    "",
    "## Reproducibility",
    "",
    "Measured results come from artifacts under this repository's validation folder. Inferred observations are labelled in the Strengths and Weaknesses sections.",
    "",
  ].filter((line) => line !== null).join("\n");
}

function renderRepositoryReport(comparison) {
  return renderComparisonMarkdown(comparison);
}

function renderComparisonTable(rows, labelKey) {
  return [
    "| Item | Ontoly | Graphify | Delta | Status | Incorrect |",
    "| --- | ---: | ---: | ---: | --- | --- |",
    ...rows.map((row) => `| ${row[labelKey]} | ${row.ontoly} | ${row.graphify} | ${row.delta} | ${row.status} | ${row.incorrect} |`),
  ].join("\n");
}

function renderFrameworkTable(frameworks) {
  if (frameworks.length === 0) {
    return "No framework evidence was detected from package metadata.";
  }

  return [
    "| Framework | Ontoly Detected | Graphify Inferred | Coverage | Confidence | Missing Concepts | Relationship Gaps |",
    "| --- | --- | --- | ---: | --- | --- | --- |",
    ...frameworks.map((framework) =>
      `| ${framework.framework} | ${framework.measured.ontolyDetected ? "yes" : "no"} | ${framework.measured.graphifyInferred ? "yes" : "no"} | ${framework.coverage ?? "n/a"} | ${framework.confidence ?? "n/a"} | ${framework.missingConcepts.join(", ") || "none measured"} | ${framework.relationshipGaps.join(", ") || "none measured"} |`,
    ),
  ].join("\n");
}

function renderEvidenceList(items) {
  if (!items.length) {
    return "- none";
  }
  return items.map((item) => `- ${item.area}: ${item.evidence} (${item.basis})`).join("\n");
}

function renderRecommendationList(items) {
  if (!items.length) {
    return "- none";
  }
  return items.map((item) => [
    `- Priority: ${item.priority}`,
    `  Description: ${item.description}`,
    `  Suggested Fix: ${item.suggestedFix}`,
  ].join("\n")).join("\n");
}

function renderMissingComparison(repo) {
  return [
    `# ${repo.name} Comparison`,
    "",
    "Repository was not analyzed because the requested path was not found.",
    "",
    `- Requested path: ${repo.requestedPath}`,
    "",
    "Regression: FAIL for this repository until the path is corrected or the repository is made available.",
    "",
  ].join("\n");
}

function renderSummaryMarkdown(summary) {
  return [
    "# Ontoly vs Graphify Validation Summary",
    "",
    `Generated: ${summary.generatedAt}`,
    `Repositories analyzed: ${summary.repositoriesAnalyzed}/${summary.repositoriesRequested}`,
    "",
    "## Totals",
    "",
    `- Files analyzed: ${summary.totals.files}`,
    `- Ontoly graph size: ${summary.graphSize.ontoly.nodes} nodes, ${summary.graphSize.ontoly.edges} edges`,
    `- Graphify graph size: ${summary.graphSize.graphify.nodes} nodes, ${summary.graphSize.graphify.edges} edges`,
    `- Average semantic coverage: ${summary.averages.semanticCoverage}`,
    `- Average trust score: ${summary.averages.trustScore}`,
    `- Regression: ${summary.regression.status}`,
    "",
    "## Benchmark Dashboard",
    "",
    renderDashboardTable(summary),
    "",
    "## Relationship Coverage",
    "",
    "| Relationship | Ontoly Total | Graphify Total | Supported Repos |",
    "| --- | ---: | ---: | ---: |",
    ...summary.relationshipCoverage.map((row) => `| ${row.relationship} | ${row.ontolyTotal} | ${row.graphifyTotal} | ${row.supportedRepositories} |`),
    "",
    "## Framework Coverage",
    "",
    summary.frameworkCoverage.length === 0
      ? "No framework coverage was measured."
      : [
          "| Framework | Repos | Ontoly Detected | Graphify Inferred | Avg Coverage |",
          "| --- | ---: | ---: | ---: | ---: |",
          ...summary.frameworkCoverage.map((row) => `| ${row.framework} | ${row.repositories} | ${row.ontolyDetected} | ${row.graphifyInferred} | ${row.averageCoverage} |`),
        ].join("\n"),
    "",
    "## Top Strengths",
    "",
    summary.topStrengths.map((item) => `- ${item.name}: ${item.count}`).join("\n") || "- none",
    "",
    "## Top Weaknesses",
    "",
    summary.topWeaknesses.map((item) => `- ${item.name}: ${item.count}`).join("\n") || "- none",
    "",
    "## Highest Priority Improvements",
    "",
    summary.highestPriorityImprovements.map((item) => `- ${item.priority} ${item.repository}: ${item.description} Suggested fix: ${item.suggestedFix}`).join("\n") || "- none",
    "",
    "## Regression",
    "",
    `Status: ${summary.regression.status}`,
    summary.regression.failures.length ? summary.regression.failures.map((failure) => `- FAIL: ${failure}`).join("\n") : "- No failures.",
    summary.regression.warnings.length ? summary.regression.warnings.map((warning) => `- WARN: ${warning}`).join("\n") : "",
    "",
  ].join("\n");
}

function renderDashboardMarkdown(summary) {
  return [
    "# Ontoly vs Graphify Benchmark Dashboard",
    "",
    renderDashboardTable(summary),
    "",
    "| Total | Framework | Files | Graphify | Ontoly | Trust | Coverage |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    `| All analyzed | mixed | ${summary.totals.files} | ${summary.graphSize.graphify.nodes} nodes / ${summary.graphSize.graphify.edges} edges | ${summary.graphSize.ontoly.nodes} nodes / ${summary.graphSize.ontoly.edges} edges | ${summary.averages.trustScore} | ${summary.averages.semanticCoverage} |`,
    "",
  ].join("\n");
}

function renderDashboardTable(summary) {
  return [
    "| Repository | Framework | Files | Graphify | Ontoly | Trust | Coverage |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...summary.repositories.map((repo) => {
      if (repo.status === "missing") {
        return `| ${repo.name} | n/a | n/a | missing | missing | n/a | n/a |`;
      }
      return `| ${repo.name} | ${(repo.frameworks ?? []).join(", ") || "none"} | ${repo.files} | ${repo.graphify.nodes} nodes / ${repo.graphify.edges} edges | ${repo.ontoly.nodes} nodes / ${repo.ontoly.edges} edges | ${repo.ontoly.trust ?? "n/a"} | ${repo.ontoly.coverage ?? "n/a"} |`;
    }),
  ].join("\n");
}
