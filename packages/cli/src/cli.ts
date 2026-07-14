import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeSemanticCoverage,
  createSemanticEntityReport,
  formatCoverageHuman,
  formatCoverageMarkdown,
  type SemanticCoverageReport,
  type SemanticEntityReport,
} from "@0xsarwagya/ontoly-analyzers";
import { getGraphArtifactPaths, loadGraph } from "@0xsarwagya/ontoly-cache";
import {
  buildSoftwareGraph,
  buildSoftwareGraphWithArtifacts,
  createRepositoryIntelligencePass,
  doctorRepository,
  initializeOntolyProject,
  watchSoftwareGraph,
} from "@0xsarwagya/ontoly-compiler";
import {
  summarizeGraph,
  type JsonObject,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphDiagnostic,
  type SoftwareGraphNode,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";
import { createMcpRuntime, McpCapabilityError, type McpCapabilityName } from "@0xsarwagya/ontoly-mcp";
import { createOpenApiFrontendPass } from "@0xsarwagya/ontoly-parser-openapi";
import { createTypeScriptFrontendPass } from "@0xsarwagya/ontoly-parser-typescript";
import { createInteractiveHtmlGraph } from "@0xsarwagya/ontoly-plugin-html";
import { createQueryEngine, type GraphStatistics, type GraphTraversal } from "@0xsarwagya/ontoly-query";
import { createDefaultFrameworkRegistry } from "@0xsarwagya/ontoly-semantic";
import {
  analyzeTypeScriptProject,
  deserializeTypeScriptProject,
  serializeTypeScriptProject,
  validateTypeScriptSemanticModel,
  type TypeScriptProject,
} from "@0xsarwagya/ontoly-typescript";
import {
  doctorOntolySkills,
  listOntolySkills,
  validateOntolySkills,
  type SkillValidationReport,
} from "./skills";
import { createOntolyOutputBundle, type OntolyOutputBundle } from "./output";

interface ParsedCli {
  readonly command: string;
  readonly positional: readonly string[];
  readonly flags: ReadonlyMap<string, string | boolean>;
}

type CliLogLevel = "info" | "success" | "warning" | "error" | "debug" | "trace";

interface CliLogger {
  readonly write: (message?: string) => void;
  readonly info: (message: string) => void;
  readonly success: (message: string) => void;
  readonly warning: (message: string) => void;
  readonly error: (message: string) => void;
  readonly debug: (message: string) => void;
  readonly trace: (message: string) => void;
}

interface CliErrorInput {
  readonly code: string;
  readonly message: string;
  readonly suggestion?: string | undefined;
  readonly docs?: string | undefined;
  readonly cause?: unknown;
  readonly exitCode?: number | undefined;
}

class OntolyCliError extends Error {
  readonly code: string;
  readonly suggestion?: string | undefined;
  readonly docs?: string | undefined;
  readonly exitCode: number;

  constructor(input: CliErrorInput) {
    super(input.message, { cause: input.cause });
    this.name = "OntolyCliError";
    this.code = input.code;
    this.suggestion = input.suggestion;
    this.docs = input.docs;
    this.exitCode = input.exitCode ?? 1;
  }
}

const parsed = parseCli(process.argv.slice(2));
const logger = createCliLogger(parsed);

if (isCliEntrypoint()) {
  run(parsed).catch((error) => {
    logger.error(formatCliError(error));
    process.exitCode = error instanceof OntolyCliError ? error.exitCode : 1;
  });
}

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return canonicalPath(process.argv[1]) === canonicalPath(fileURLToPath(import.meta.url));
}

function canonicalPath(file: string): string {
  try {
    return realpathSync(resolve(file));
  } catch {
    return resolve(file);
  }
}

async function run(cli: ParsedCli): Promise<void> {
  if (flagBoolean(cli, "help") && cli.command !== "help") {
    printCommandHelp(cli.command);
    return;
  }

  if (flagBoolean(cli, "debug")) {
    logger.debug("Debug logging enabled.");
  }

  switch (cli.command) {
    case "init":
      await initCommand(cli);
      return;

    case "build":
      await buildCommand(cli);
      return;

    case "output":
    case "compile":
      await outputCommand(cli);
      return;

    case "analyze":
      await analyzeCommand(cli);
      return;

    case "semantic":
      await semanticCommand(cli);
      return;

    case "frameworks":
      await frameworksCommand(cli);
      return;

    case "watch":
      await watchCommand(cli);
      return;

    case "inspect":
      await inspectCommand(cli);
      return;

    case "graph":
      await graphCommand(cli);
      return;

    case "trace":
      await traceCommand(cli);
      return;

    case "stats":
      await statsCommand(cli);
      return;

    case "architecture":
      await architectureCommand(cli);
      return;

    case "coverage":
      await coverageCommand(cli);
      return;

    case "report":
      await reportCommand(cli);
      return;

    case "query":
      await queryCommand(cli);
      return;

    case "doctor":
      await doctorCommand(cli);
      return;

    case "export":
      await exportCommand(cli);
      return;

    case "mcp":
      await mcpCommand(cli);
      return;

    case "skills":
      await skillsCommand(cli);
      return;

    case "validate":
      await validateCommand(cli);
      return;

    case "evaluate":
      await evaluateCommand(cli);
      return;

    case "leaderboard":
      await leaderboardCommand(cli);
      return;

    case "diff":
      await diffCommand(cli);
      return;

    case "benchmark":
      await benchmarkCommand(cli);
      return;

    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;

    default:
      throw new OntolyCliError({
        code: "ONTOLY0001",
        message: `Unknown command: ${cli.command}`,
        suggestion: "Run ontoly --help to see available commands.",
        docs: "docs/cli.md",
      });
  }
}

async function initCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const result = await initializeOntolyProject(root);

  logger.success(`Initialized Ontoly at ${result.root}`);
  logger.info(`Config: ${result.configPath}`);
  logger.info(`Artifacts: ${result.directory}`);
}

async function buildCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const outputDir = flagString(cli, "output", "ontoly-output");
  const writeCompilerArtifacts = !isOntolyOutputDirectory(outputDir);
  const result = await buildSoftwareGraphWithArtifacts({
    root,
    outputDir,
    write: writeCompilerArtifacts,
    passes: defaultCompilerPasses(),
  });
  let bundle: OntolyOutputBundle | undefined;

  if (!result.graph || result.status === "failed") {
    if (flagBoolean(cli, "json")) {
      logger.write(JSON.stringify({
        status: result.status,
        files: result.discovery.files.length,
        nodes: 0,
        edges: 0,
        diagnostics: result.diagnostics.length,
        artifacts: result.artifacts,
      }, null, 2));
    } else {
      logger.info(`Indexed ${result.discovery.files.length} files`);
      logger.info("Built 0 nodes");
      logger.info("Generated 0 relationships");
    }
    logger.error("Build failed before a validated Software Graph was produced");
    process.exitCode = 1;
    return;
  }

  if (shouldWriteOutputBundle(cli, outputDir)) {
    bundle = await writeOutputBundle(
      root,
      flagString(cli, "bundle-output", isOntolyOutputDirectory(outputDir) ? outputDir : "ontoly-output"),
      result.graph,
      cli,
    );
  }

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify({
      status: result.status,
      files: result.discovery.files.length,
      nodes: result.graph.nodes.length,
      edges: result.graph.edges.length,
      diagnostics: result.graph.diagnostics.length,
      hash: result.graph.metadata.deterministicHash,
      artifacts: result.artifacts,
      outputBundle: bundle ? {
        directory: bundle.directory,
        files: bundle.files.length,
        communities: bundle.communities.length,
      } : undefined,
    }, null, 2));
    process.exitCode = result.status === "success" ? 0 : 1;
    return;
  }

  logger.info(`Indexed ${result.discovery.files.length} files`);
  logger.info(`Built ${result.graph.nodes.length} nodes${formatCounts(result.graph.nodes.map((node) => node.type))}`);
  logger.info(`Generated ${result.graph.edges.length} relationships${formatCounts(result.graph.edges.map((edge) => edge.type))}`);

  const duration = result.graph.metadata.durationMs ?? 0;
  logger.success("Built Software Graph");
  logger.info(`Diagnostics: ${result.graph.diagnostics.length}`);
  logger.info(`Hash: ${result.graph.metadata.deterministicHash}`);
  logger.success(`Build completed in ${(duration / 1000).toFixed(2)}s`);

  if (result.artifacts) {
    logger.info(`Graph: ${result.artifacts.graph}`);
    logger.info(`Diagnostics: ${result.artifacts.diagnostics}`);
    logger.info(`Statistics: ${result.artifacts.statistics}`);
  }

  if (bundle) {
    logger.info(`Output bundle: ${bundle.directory}`);
    logger.info(`Output files: ${bundle.files.length}`);
    logger.info(`Communities: ${bundle.communities.length}`);
    if (!flagBoolean(cli, "no-html")) {
      logger.info(`HTML: ${bundle.directory}/html/graph.html`);
      logger.info(`HTML architecture: ${bundle.directory}/html/architecture.html`);
    }
  }
}

async function outputCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const outputDir = flagString(cli, "output", "ontoly-output");
  const result = await buildSoftwareGraphWithArtifacts({
    root,
    outputDir,
    write: false,
    passes: defaultCompilerPasses(),
  });

  if (!result.graph || result.status === "failed") {
    throw new OntolyCliError({
      code: "ONTOLY4001",
      message: "Could not create ontoly-output because graph compilation failed.",
      suggestion: "Run ontoly build . --debug and resolve compiler diagnostics first.",
      docs: "docs/cli.md#output",
    });
  }

  const bundle = await writeOutputBundle(root, outputDir, result.graph, cli);

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify({
      directory: bundle.directory,
      files: bundle.files,
      communities: bundle.communities.length,
      graphHash: result.graph.metadata.deterministicHash,
    }, null, 2));
    return;
  }

  logger.success(`Compiled Ontoly output bundle: ${bundle.directory}`);
  logger.info(`Files: ${bundle.files.length}`);
  logger.info(`Communities: ${bundle.communities.length}`);
  logger.info(`Graph: ${bundle.directory}/SoftwareGraph.json`);
  logger.info(`HTML: ${bundle.directory}/html/graph.html`);
  logger.info(`HTML architecture: ${bundle.directory}/html/architecture.html`);
}

async function analyzeCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const outputDir = flagString(cli, "output", ".ontoly");
  const project = await writeSemanticModelArtifact(root, outputDir);
  const validation = validateTypeScriptSemanticModel(project);
  const summary = semanticModelSummary(project);

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify({
      ...summary,
      validation,
      path: semanticModelPath(root, outputDir),
    }, null, 2));
    process.exitCode = validation.ok ? 0 : 1;
    return;
  }

  logger.write("TypeScript Semantic Model");
  logger.write(`Files: ${summary.files}`);
  logger.write(`Symbols: ${summary.symbols}`);
  logger.write(`Classes: ${summary.classes}`);
  logger.write(`Functions: ${summary.functions}`);
  logger.write(`Methods: ${summary.methods}`);
  logger.write(`Imports: ${summary.imports}`);
  logger.write(`Exports: ${summary.exports}`);
  logger.write(`Calls: ${summary.calls}`);
  logger.write(`Decorators: ${summary.decorators}`);
  logger.write(`Hash: ${summary.hash}`);
  logger.write(`Semantic model: ${semanticModelPath(root, outputDir)}`);

  if (!validation.ok) {
    logger.warning(`Validation issues: ${validation.issues.length}`);
    process.exitCode = 1;
  }
}

async function semanticCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const outputDir = flagString(cli, "output", ".ontoly");
  const project = await loadOrAnalyzeSemanticModel(root, outputDir);
  const format = flagString(cli, "format", flagBoolean(cli, "json") ? "json" : "summary");

  if (format === "json") {
    logger.write(serializeTypeScriptProject(project).trimEnd());
    return;
  }

  const validation = validateTypeScriptSemanticModel(project);
  const summary = semanticModelSummary(project);

  logger.write("TypeScript Semantic Model");
  logger.write(`Version: ${summary.version}`);
  logger.write(`Files: ${summary.files}`);
  logger.write(`Symbols: ${summary.symbols}`);
  logger.write(`Classes: ${summary.classes}`);
  logger.write(`Interfaces: ${summary.interfaces}`);
  logger.write(`Functions: ${summary.functions}`);
  logger.write(`Methods: ${summary.methods}`);
  logger.write(`Imports: ${summary.imports}`);
  logger.write(`Exports: ${summary.exports}`);
  logger.write(`Calls: ${summary.calls}`);
  logger.write(`Decorators: ${summary.decorators}`);
  logger.write(`Types: ${summary.types}`);
  logger.write(`Hash: ${summary.hash}`);
  logger.write(`Validation: ${validation.ok ? "ok" : `${validation.issues.length} issues`}`);
}

async function frameworksCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const outputDir = flagString(cli, "output", ".ontoly");
  const project = await loadOrAnalyzeSemanticModel(root, outputDir);
  const registry = createDefaultFrameworkRegistry();
  const detections = registry.detect(project).filter((detection) => detection.detected);
  const graph = await loadOrBuildGraph({ ...cli, positional: [root] });
  const coverage = analyzeSemanticCoverage(graph);
  const result = {
    repository: graph.repository.name,
    graphHash: graph.metadata.deterministicHash,
    coverage: coverage.summary.trustworthiness,
    frameworks: detections.map((detection) => ({
      name: detection.framework,
      analyzerId: detection.analyzerId,
      analyzerVersion: detection.analyzerVersion,
      confidence: detection.confidence,
      coverage: detection.coverage ?? 0,
      evidence: detection.evidence,
    })),
  };

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(result, null, 2));
    return;
  }

  logger.write("Detected Frameworks");
  logger.write("");

  if (result.frameworks.length === 0) {
    logger.warning("No frameworks detected.");
    return;
  }

  for (const framework of result.frameworks) {
    logger.write(framework.name);
    logger.write(`Coverage: ${framework.coverage}%`);
    logger.write(`Analyzer Version: ${framework.analyzerVersion}`);
    logger.write("");
  }

  logger.write(`Graph Coverage: ${result.coverage}%`);
}

async function watchCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  logger.info(`Watching ${resolve(root)}`);

  watchSoftwareGraph({
    root,
    write: true,
    passes: defaultCompilerPasses(),
    onBuild: (result) => {
      if (!result.graph) {
        logger.error("Build failed before a validated Software Graph was produced");
        return;
      }

      const duration = result.graph.metadata.durationMs ?? 0;
      logger.success(
        `Built ${result.graph.nodes.length} nodes and ${result.graph.edges.length} relationships in ${duration}ms`,
      );
    },
    onError: (error) => {
      logger.error(error instanceof Error ? error.message : String(error));
    },
  });
}

async function inspectCommand(cli: ParsedCli): Promise<void> {
  const graph = await loadOrBuildGraph(cli, { positionalRoot: false });
  const query = createQueryEngine(graph);
  const target = cli.positional[0];

  if (!target) {
    if (flagBoolean(cli, "json")) {
      logger.write(JSON.stringify({ graph: summarizeGraph(graph), stats: query.stats() }, null, 2));
      return;
    }

    logger.write(summarizeGraph(graph));
    return;
  }

  const inspection = inspectTarget(query, target);

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(inspection, null, 2));
    return;
  }

  logger.write(formatInspection(inspection));
}

async function graphCommand(cli: ParsedCli): Promise<void> {
  const graph = await loadOrBuildGraph(cli);
  const format = flagString(cli, "format", flagBoolean(cli, "json") ? "json" : "summary");

  if (format === "json") {
    logger.write(JSON.stringify(graph, null, 2));
    return;
  }

  if (format === "mermaid") {
    logger.write(exportMermaid(graph));
    return;
  }

  if (format === "dot") {
    logger.write(exportDot(graph));
    return;
  }

  if (format === "graphml") {
    logger.write(exportGraphML(graph));
    return;
  }

  if (format === "html") {
    logger.write(createInteractiveHtmlGraph(graph));
    return;
  }

  logger.write(summarizeGraph(graph));
}

async function traceCommand(cli: ParsedCli): Promise<void> {
  const id = cli.positional[0];

  if (!id) {
    throw new OntolyCliError({
      code: "ONTOLY1001",
      message: "trace requires a node id or node name.",
      suggestion: "Run ontoly inspect <file-or-node> first, then pass the node id to ontoly trace.",
      docs: "docs/cli.md#trace",
    });
  }

  const graph = await loadOrBuildGraph(cli, { positionalRoot: false });
  const query = createQueryEngine(graph);
  const depth = Number(flagString(cli, "depth", "3"));
  const node = resolveNode(query, id);
  const trace = query.trace(node.id, { depth });

  if (flagString(cli, "format", "") === "mermaid") {
    logger.write(exportTraversalMermaid(trace));
    return;
  }

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(trace, null, 2));
    return;
  }

  logger.write(formatTrace(trace));
}

async function statsCommand(cli: ParsedCli): Promise<void> {
  const graph = await loadOrBuildGraph(cli);
  const stats = createQueryEngine(graph).stats();

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(stats, null, 2));
    return;
  }

  logger.write(formatStats(stats));
}

async function architectureCommand(cli: ParsedCli): Promise<void> {
  const graph = await loadOrBuildGraph(cli);
  const query = createQueryEngine(graph);
  const summary = architectureSummary(query);
  const format = flagString(cli, "format", "");

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(summary, null, 2));
    return;
  }

  if (format === "mermaid") {
    logger.write(architectureMermaid(query));
    return;
  }

  if (format === "html") {
    logger.write(createInteractiveHtmlGraph(architectureGraph(query), {
      title: `${graph.repository.name} Software Graph Explorer`,
      maxNodes: flagNumber(cli, "max-nodes", 1200),
      maxEdges: flagNumber(cli, "max-edges", 2400),
      includeIsolatedNodes: false,
    }));
    return;
  }

  logger.write(formatArchitectureSummary(summary));
}

async function coverageCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const outputDir = flagString(cli, "output", ".ontoly");
  const graph = await loadOrBuildGraph(cli);
  const report = analyzeSemanticCoverage(graph);
  await writeCoverageArtifacts(root, outputDir, report);

  const format = flagString(cli, "format", flagBoolean(cli, "json") ? "json" : "human");

  if (format === "json") {
    logger.write(JSON.stringify(report, null, 2));
    return;
  }

  if (format === "markdown") {
    logger.write(formatCoverageMarkdown(report));
    return;
  }

  logger.write(formatCoverageHuman(report));
}

async function reportCommand(cli: ParsedCli): Promise<void> {
  const target = cli.positional[0] ?? "summary";
  const graph = await loadOrBuildGraph(cli, { positionalRoot: false });
  const query = createQueryEngine(graph);
  const report = createReport(query, target);
  const format = flagString(cli, "format", flagBoolean(cli, "json") ? "json" : "markdown");

  if (format === "json") {
    logger.write(JSON.stringify(report, null, 2));
    return;
  }

  if (format === "mermaid") {
    logger.write(reportMermaid(query, target));
    return;
  }

  logger.write(formatReport(report));
}

async function queryCommand(cli: ParsedCli): Promise<void> {
  const [operation, target] = cli.positional;

  if (!operation) {
    throw new OntolyCliError({
      code: "ONTOLY1002",
      message: "query requires an operation.",
      suggestion: "Use one of: callers, callees, dependencies, dependents, find, routes, frameworks, configuration, cycles.",
      docs: "docs/query-engine.md",
    });
  }

  const graph = await loadOrBuildGraph(cli, { positionalRoot: false });
  const query = createQueryEngine(graph);
  const result = executeQueryOperation(query, operation, target, Number(flagString(cli, "depth", "3")));

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(result, null, 2));
    return;
  }

  logger.write(formatQueryResult(operation, result));
}

async function doctorCommand(cli: ParsedCli): Promise<void> {
  const root = rootFromCli(cli);
  const checks = await doctorRepository(root);
  const recommendations = doctorRecommendations(checks);
  const ok = checks.every((check) => check.ok);

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify({ checks, recommendations }, null, 2));
    process.exitCode = ok ? 0 : 1;
    return;
  }

  for (const check of checks) {
    if (check.ok) {
      logger.success(`${check.name}: ${check.message}`);
    } else {
      logger.warning(`${check.name}: ${check.message}`);
    }
  }

  if (recommendations.length > 0) {
    logger.write("");
    logger.write("Recommendations:");
    for (const recommendation of recommendations) {
      logger.write(`- ${recommendation}`);
    }
  }

  process.exitCode = ok ? 0 : 1;
}

async function exportCommand(cli: ParsedCli): Promise<void> {
  const target = cli.positional[0] ?? "software-graph.json";
  const graph = await loadOrBuildGraph(cli, { positionalRoot: false });
  await writeFile(resolve(target), `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  logger.success(`Exported graph to ${resolve(target)}`);
}

async function mcpCommand(cli: ParsedCli): Promise<void> {
  const graph = await loadOrBuildGraph(cli);
  const runtime = createMcpRuntime(graph);

  if (flagBoolean(cli, "list")) {
    logger.write(JSON.stringify(runtime.capabilities, null, 2));
    return;
  }

  process.stderr.write("info    Ontoly MCP runtime started. Send one JSON request per line.\n");
  process.stdin.setEncoding("utf8");

  let buffer = "";
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const request = JSON.parse(line) as {
          readonly capability: McpCapabilityName;
          readonly input?: unknown;
        };
        const response = runtime.execute({
          capability: request.capability,
          input: toJsonObject(request.input),
        });
        process.stdout.write(`${JSON.stringify(response)}\n`);
      } catch (error) {
        process.stdout.write(
          `${JSON.stringify(serializeMcpError(error))}\n`,
        );
      }
    }
  });
}

async function skillsCommand(cli: ParsedCli): Promise<void> {
  const action = cli.positional[0] ?? "list";

  switch (action) {
    case "list": {
      const skills = await listOntolySkills(process.cwd());
      if (flagBoolean(cli, "json")) {
        logger.write(JSON.stringify({ skills }, null, 2));
        return;
      }

      logger.write("Ontoly Skills");
      logger.write("");
      for (const skill of skills) {
        logger.write(`${skill.id.padEnd(24)} ${skill.version.padEnd(7)} ${skill.capabilities.join(", ")}`);
      }
      logger.write("");
      logger.write(`${skills.length} skills`);
      return;
    }

    case "validate": {
      const report = await validateOntolySkills(process.cwd());
      if (flagBoolean(cli, "json")) {
        logger.write(JSON.stringify(report, null, 2));
      } else {
        logger.write(formatSkillValidation(report));
      }
      if ((flagBoolean(cli, "ci") || flagBoolean(cli, "strict")) && report.status === "FAIL") {
        process.exitCode = 1;
      }
      return;
    }

    case "doctor": {
      const report = await doctorOntolySkills(process.cwd());
      if (flagBoolean(cli, "json")) {
        logger.write(JSON.stringify(report, null, 2));
        return;
      }

      logger.write(`Skills doctor: ${report.status}`);
      logger.write("");
      for (const recommendation of report.recommendations) {
        logger.write(`- ${recommendation}`);
      }
      if ((flagBoolean(cli, "ci") || flagBoolean(cli, "strict")) && report.status === "FAIL") {
        process.exitCode = 1;
      }
      return;
    }

    default:
      throw new OntolyCliError({
        code: "ONTOLY3001",
        message: `Unknown skills command: ${action}`,
        suggestion: "Use one of: list, validate, doctor.",
        docs: "docs/agent-skills.md",
      });
  }
}

async function benchmarkCommand(cli: ParsedCli): Promise<void> {
  if (cli.positional[0] === "semantic") {
    await runSemanticEvaluationScript([
      ...cli.positional.slice(1),
      "--benchmark",
      ...semanticEvaluationFlags(cli),
    ]);
    return;
  }

  if (cli.positional[0] === "performance") {
    await runValidationLabScript([
      "benchmark",
      "performance",
      ...forwardedFlags(cli, ["json", "refresh", "determinism", "no-determinism"]),
    ]);
    return;
  }

  const root = rootFromCli(cli);
  const runs = Number(flagString(cli, "runs", "3"));
  const durations: number[] = [];

  for (let index = 0; index < runs; index += 1) {
    const graph = await buildSoftwareGraph({ root, passes: defaultCompilerPasses() });
    durations.push(graph.metadata.durationMs ?? 0);
  }

  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const average = durations.length > 0 ? total / durations.length : 0;
  logger.info(`Runs: ${runs}`);
  logger.success(`Average: ${average.toFixed(2)}ms`);
  logger.info(`Durations: ${durations.map((duration) => `${duration.toFixed(2)}ms`).join(", ")}`);
}

async function validateCommand(cli: ParsedCli): Promise<void> {
  await runValidationLabScript([
    "validate",
    cli.positional[0] ?? "all",
    ...forwardedFlags(cli, ["json", "ci", "refresh", "clone", "install", "determinism", "no-determinism"]),
  ]);
}

async function evaluateCommand(cli: ParsedCli): Promise<void> {
  await runSemanticEvaluationScript([
    ...cli.positional,
    ...semanticEvaluationFlags(cli),
  ]);
}

async function leaderboardCommand(cli: ParsedCli): Promise<void> {
  await runSemanticEvaluationScript([
    "--leaderboard-only",
    ...semanticEvaluationFlags(cli),
  ]);
}

async function diffCommand(cli: ParsedCli): Promise<void> {
  await runProjectScript(
    join("validation", "tools", "graph-diff.mjs"),
    [
      ...cli.positional,
      ...forwardedFlags(cli, ["json", "ci", "output"]),
    ],
  );
}

function semanticEvaluationFlags(cli: ParsedCli): string[] {
  return forwardedFlags(cli, ["json", "ci", "refresh"]);
}

function forwardedFlags(cli: ParsedCli, names: readonly string[]): string[] {
  const flags: string[] = [];

  for (const name of names) {
    const value = cli.flags.get(name);
    if (value === true) {
      flags.push(`--${name}`);
    } else if (typeof value === "string") {
      flags.push(`--${name}`, value);
    }
  }

  return flags;
}

async function runValidationLabScript(args: readonly string[]): Promise<void> {
  await runProjectScript(join("validation", "tools", "run-validation-lab.mjs"), args);
}

async function runSemanticEvaluationScript(args: readonly string[]): Promise<void> {
  await runProjectScript(join("validation", "semantic", "evaluators", "run-semantic-evaluation.mjs"), args);
}

async function runProjectScript(relativePath: string, args: readonly string[]): Promise<void> {
  const script = await findProjectFile(relativePath);
  const packageJson = await findProjectFile("package.json");
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: dirname(packageJson),
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    throw new Error(`${relativePath} terminated by ${result.signal}.`);
  }

  process.exitCode = result.status ?? 1;
}

async function findProjectFile(relativePath: string): Promise<string> {
  let directory = resolve(process.cwd());

  while (true) {
    const candidate = join(directory, relativePath);
    try {
      await access(candidate);
      return candidate;
    } catch {
      const parent = dirname(directory);
      if (parent === directory) {
        throw new OntolyCliError({
          code: "ONTOLY2001",
          message: `Could not find ${relativePath}.`,
          suggestion: "Run this command from the Ontoly repository root.",
          docs: "docs/validation-lab.md",
        });
      }
      directory = parent;
    }
  }
}

async function loadOrBuildGraph(
  cli: ParsedCli,
  options: { readonly positionalRoot?: boolean | undefined } = {},
): Promise<Awaited<ReturnType<typeof buildSoftwareGraph>>> {
  const root = rootFromCli(cli, { positional: options.positionalRoot ?? true });
  const outputDir = flagString(cli, "output", ".ontoly");
  const paths = getGraphArtifactPaths({ root: resolve(root), directory: outputDir });

  try {
    try {
      await access(paths.graph);
    } catch {
      await access(paths.legacyGraph);
    }
    return await loadGraph({ root, directory: outputDir });
  } catch {
    return buildSoftwareGraph({ root, passes: defaultCompilerPasses() });
  }
}

async function writeSemanticModelArtifact(rootInput: string, outputDir: string): Promise<TypeScriptProject> {
  const root = resolve(rootInput);
  const directory = join(root, outputDir);
  const project = analyzeTypeScriptProject({ root });
  await mkdir(directory, { recursive: true });
  await writeFile(semanticModelPath(root, outputDir), serializeTypeScriptProject(project), "utf8");
  return project;
}

async function loadOrAnalyzeSemanticModel(rootInput: string, outputDir: string): Promise<TypeScriptProject> {
  const root = resolve(rootInput);
  const path = semanticModelPath(root, outputDir);

  try {
    return deserializeTypeScriptProject(await readFile(path, "utf8"));
  } catch {
    return writeSemanticModelArtifact(root, outputDir);
  }
}

function semanticModelPath(rootInput: string, outputDir: string): string {
  return join(resolve(rootInput), outputDir, "semantic-model.json");
}

function semanticModelSummary(project: TypeScriptProject): JsonObject {
  return {
    version: project.version,
    files: project.files.length,
    symbols: project.symbols.length,
    classes: project.classes.length,
    interfaces: project.interfaces.length,
    functions: project.functions.length,
    methods: project.methods.length,
    imports: project.imports.length,
    exports: project.exports.length,
    calls: project.calls.length,
    decorators: project.decorators.length,
    types: project.types.length,
    constructors: project.constructors.length,
    diagnostics: project.diagnostics.length,
    hash: project.metadata.deterministicHash,
  };
}

async function writeCoverageArtifacts(
  rootInput: string,
  outputDir: string,
  report: SemanticCoverageReport,
): Promise<void> {
  const directory = join(resolve(rootInput), outputDir);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(join(directory, "quality.json"), `${JSON.stringify({
      repository: report.repository,
      graphHash: report.graphHash,
      summary: report.summary,
      diagnostics: report.diagnostics,
      relationshipDistribution: report.relationshipDistribution,
      confidenceHistogram: report.confidenceHistogram,
    }, null, 2)}\n`, "utf8"),
  ]);
}

function shouldWriteOutputBundle(cli: ParsedCli, outputDir: string): boolean {
  return flagBoolean(cli, "bundle") || isOntolyOutputDirectory(outputDir);
}

function isOntolyOutputDirectory(path: string): boolean {
  return path.replace(/\\/g, "/").split("/").pop() === "ontoly-output";
}

async function writeOutputBundle(
  root: string,
  outputDir: string,
  graph: SoftwareGraph,
  cli: ParsedCli,
): Promise<OntolyOutputBundle> {
  const semanticModel = flagBoolean(cli, "no-semantic") ? undefined : analyzeTypeScriptProject({ root });
  return createOntolyOutputBundle({
    root,
    directory: outputDir,
    graph,
    semanticModel,
    includeHtml: !flagBoolean(cli, "no-html"),
    maxHtmlNodes: flagNumber(cli, "max-nodes", 2500),
    maxHtmlEdges: flagNumber(cli, "max-edges", 5000),
  });
}

function defaultCompilerPasses() {
  return [createRepositoryIntelligencePass(), createTypeScriptFrontendPass(), createOpenApiFrontendPass()];
}

function architectureSummary(query: ReturnType<typeof createQueryEngine>): JsonObject {
  const nodes = query.findNodes();
  const frameworks = nodes.filter((node) => node.type === "Framework").map(serializeNode);
  const packages = nodes.filter((node) => node.type === "Package").map(serializeNode);
  const services = nodes.filter((node) => node.type === "Service").map(serializeNode);
  const repositories = nodes.filter((node) => node.type === "Repository").map(serializeNode);
  const routes = nodes.filter((node) => node.type === "Route").map(serializeNode);
  const configuration = nodes
    .filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable")
    .map(serializeNode);

  return {
    repository: query.graph.repository.name,
    hash: query.graph.metadata.deterministicHash,
    statistics: query.stats() as unknown as JsonObject,
    frameworks,
    packages,
    services,
    repositories,
    routes,
    configuration,
  };
}

function createReport(query: ReturnType<typeof createQueryEngine>, target: string): JsonObject {
  switch (target) {
    case "api":
      return apiReport(query);
    case "dependencies":
      return dependencyReport(query);
    case "configuration":
      return configurationReport(query);
    case "framework":
      return semanticEntityReportToJson(createSemanticEntityReport(query.graph, "framework"));
    case "frameworks":
      return frameworkReport(query);
    case "controllers":
      return semanticEntityReportToJson(createSemanticEntityReport(query.graph, "controllers"));
    case "routes":
      return semanticEntityReportToJson(createSemanticEntityReport(query.graph, "routes"));
    case "modules":
      return semanticEntityReportToJson(createSemanticEntityReport(query.graph, "modules"));
    case "providers":
      return semanticEntityReportToJson(createSemanticEntityReport(query.graph, "providers"));
    case "workspace":
      return workspaceReport(query);
    case "architecture":
    case "summary":
      return {
        title: "Architecture Summary",
        ...architectureSummary(query),
      };
    default:
      throw new Error(`Unknown report: ${target}. Expected summary, architecture, api, dependencies, configuration, framework, frameworks, controllers, routes, modules, providers, or workspace.`);
  }
}

function semanticEntityReportToJson(report: SemanticEntityReport): JsonObject {
  return {
    title: report.title,
    repository: report.repository,
    graphHash: report.graphHash,
    items: [...report.items],
    diagnostics: report.diagnostics.map(serializeDiagnostic),
  };
}

function apiReport(query: ReturnType<typeof createQueryEngine>): JsonObject {
  const routes = query.routes().map((route) => ({
    ...serializeNode(route),
    handlers: query.outgoing(route.id, ["HANDLES"]).map((edge) => serializeNodeOrEdgeTarget(query, edge)),
    middleware: query.outgoing(route.id, ["USES"]).map((edge) => serializeNodeOrEdgeTarget(query, edge)),
    authorization: query.incoming(route.id, ["AUTHORIZES"]).map((edge) => serializeNodeOrEdgeSource(query, edge)),
  }));
  const operations = query.findNodes({ type: "Operation" }).map(serializeNode);

  return {
    title: "API Report",
    routes,
    operations,
  };
}

function dependencyReport(query: ReturnType<typeof createQueryEngine>): JsonObject {
  const packages = query.findNodes({ type: "Package" }).map((node) => ({
    ...serializeNode(node),
    dependencies: query.outgoing(node.id, ["DEPENDS_ON"]).map((edge) => ({
      edge: serializeEdge(edge),
      target: serializeNodeOrEdgeTarget(query, edge),
      metadata: edge.metadata ?? {},
    })),
    frameworks: query.outgoing(node.id, ["USES"]).map((edge) => serializeNodeOrEdgeTarget(query, edge)),
  }));
  const cycles = query.detectCycles(["DEPENDS_ON", "IMPORTS"]).map((cycle) => [...cycle]);

  return {
    title: "Dependency Report",
    packages,
    cycles,
  };
}

function configurationReport(query: ReturnType<typeof createQueryEngine>): JsonObject {
  const configuration = query.findNodes()
    .filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable" || node.type === "BuildTarget")
    .map((node) => ({
      ...serializeNode(node),
      incoming: query.incoming(node.id, ["CONFIGURES", "READS", "WRITES"]).map(serializeEdge),
      outgoing: query.outgoing(node.id, ["CONFIGURES", "READS", "WRITES"]).map(serializeEdge),
    }));

  return {
    title: "Configuration Report",
    configuration,
  };
}

function frameworkReport(query: ReturnType<typeof createQueryEngine>): JsonObject {
  const frameworks = query.findNodes({ type: "Framework" }).map((node) => ({
    ...serializeNode(node),
    users: query.incoming(node.id, ["USES", "REGISTERED_IN", "PROVIDES"]).map((edge) => serializeNodeOrEdgeSource(query, edge)),
  }));

  return {
    title: "Framework Report",
    frameworks,
  };
}

function workspaceReport(query: ReturnType<typeof createQueryEngine>): JsonObject {
  const workspaces = query.findNodes({ type: "Workspace" }).map((node) => ({
    ...serializeNode(node),
    contains: query.outgoing(node.id, ["CONTAINS"]).map((edge) => serializeNodeOrEdgeTarget(query, edge)),
  }));
  const scripts = query.findNodes({ type: "Script" }).map((node) => ({
    ...serializeNode(node),
    executes: query.outgoing(node.id, ["EXECUTES"]).map((edge) => serializeNodeOrEdgeTarget(query, edge)),
  }));
  const pipelines = query.findNodes({ type: "Pipeline" }).map(serializeNode);
  const workflows = query.findNodes({ type: "Workflow" }).map(serializeNode);

  return {
    title: "Workspace Report",
    workspaces,
    scripts,
    pipelines,
    workflows,
  };
}

function serializeNodeOrEdgeTarget(
  query: ReturnType<typeof createQueryEngine>,
  edge: SoftwareGraphEdge,
): JsonObject {
  return serializeNodeOrMissing(query, edge.to);
}

function serializeNodeOrEdgeSource(
  query: ReturnType<typeof createQueryEngine>,
  edge: SoftwareGraphEdge,
): JsonObject {
  return serializeNodeOrMissing(query, edge.from);
}

function serializeNodeOrMissing(query: ReturnType<typeof createQueryEngine>, id: string): JsonObject {
  const node = query.findNode(id);
  return node ? serializeNode(node) : { id, missing: true };
}

function inspectTarget(query: ReturnType<typeof createQueryEngine>, target: string): JsonObject {
  const fileNodes = query.findByFile(target);

  if (fileNodes.length > 0) {
    const module = fileNodes.find((node) => node.type === "Module");
    return {
      kind: "file",
      file: target,
      module: module ? serializeNode(module) : null,
      nodes: fileNodes.map(serializeNode),
      imports: module ? query.outgoing(module.id, ["IMPORTS"]).map(serializeEdge) : [],
      exports: module ? query.outgoing(module.id, ["EXPORTS"]).map(serializeEdge) : [],
      diagnostics: query.graph.diagnostics
        .filter((diagnostic) => diagnostic.span?.file === target)
        .map(serializeDiagnostic),
    };
  }

  const node = resolveNode(query, target);
  return {
    kind: "node",
    node: serializeNode(node),
    metadata: node.metadata ?? {},
    source: node.span ? serializeSpan(node.span) : null,
    callers: query.callers(node.id).map(serializeNode),
    callees: query.callees(node.id).map(serializeNode),
    incoming: query.incoming(node.id).map(serializeEdge),
    outgoing: query.outgoing(node.id).map(serializeEdge),
    related: query.related(node.id).map(serializeNode),
    diagnostics: query.graph.diagnostics.filter((diagnostic) => diagnostic.nodeId === node.id).map(serializeDiagnostic),
  };
}

function executeQueryOperation(
  query: ReturnType<typeof createQueryEngine>,
  operation: string,
  target: string | undefined,
  depth: number,
): JsonObject {
  const readNode = (): SoftwareGraphNode => {
    if (!target) {
      throw new Error(`query ${operation} requires a target.`);
    }

    return resolveNode(query, target);
  };

  switch (operation) {
    case "find":
      return { nodes: query.findNodes(target ?? "").map(serializeNode) };
    case "callers": {
      const node = readNode();
      return { node: serializeNode(node), callers: query.callers(node.id).map(serializeNode) };
    }
    case "callees": {
      const node = readNode();
      return { node: serializeNode(node), callees: query.callees(node.id).map(serializeNode) };
    }
    case "dependencies": {
      const node = readNode();
      return { node: serializeNode(node), traversal: serializeTraversal(query.dependencies(node.id, depth)) };
    }
    case "dependents": {
      const node = readNode();
      return { node: serializeNode(node), traversal: serializeTraversal(query.dependents(node.id, depth)) };
    }
    case "related": {
      const node = readNode();
      return { node: serializeNode(node), related: query.related(node.id).map(serializeNode) };
    }
    case "impact": {
      const node = readNode();
      return { node: serializeNode(node), traversal: serializeTraversal(query.dependents(node.id, depth)) };
    }
    case "routes":
      return { nodes: query.routes().map(serializeNode) };
    case "frameworks":
      return { nodes: query.findNodes({ type: "Framework" }).map(serializeNode) };
    case "configuration":
      return {
        nodes: query.findNodes()
          .filter((node) => node.type === "Configuration" || node.type === "EnvironmentVariable")
          .map(serializeNode),
      };
    case "cycles":
      return { cycles: query.detectCycles().map((cycle) => [...cycle]) };
    default:
      throw new Error(`Unknown query operation: ${operation}`);
  }
}

function resolveNode(
  query: ReturnType<typeof createQueryEngine>,
  value: string,
): SoftwareGraphNode {
  const node = query.findNode(value);

  if (node) {
    return node;
  }

  const matches = query.findNodes(value);

  if (matches.length === 1 && matches[0]) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new OntolyCliError({
      code: "ONTOLY1003",
      message: `Ambiguous node "${value}".`,
      suggestion: `Use one of these stable ids: ${matches.map((match) => match.id).join(", ")}`,
      docs: "docs/getting-started/query-the-graph",
    });
  }

  throw new OntolyCliError({
    code: "ONTOLY1004",
    message: `Node not found: ${value}`,
    suggestion: "Run ontoly inspect or ontoly query find <name> to discover matching nodes.",
    docs: "docs/getting-started/query-the-graph",
  });
}

function serializeNode(node: SoftwareGraphNode): JsonObject {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    file: node.file,
    span: node.span ? serializeSpan(node.span) : undefined,
  };
}

function serializeEdge(edge: SoftwareGraphEdge): JsonObject {
  return {
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
  };
}

function serializeSpan(span: SourceSpan): JsonObject {
  return {
    file: span.file,
    startLine: span.startLine,
    startColumn: span.startColumn,
    endLine: span.endLine,
    endColumn: span.endColumn,
  };
}

function serializeDiagnostic(diagnostic: SoftwareGraphDiagnostic): JsonObject {
  return {
    id: diagnostic.id,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    nodeId: diagnostic.nodeId,
    edgeId: diagnostic.edgeId,
    span: diagnostic.span ? serializeSpan(diagnostic.span) : undefined,
    metadata: diagnostic.metadata,
  };
}

function serializeMcpError(error: unknown): JsonObject {
  if (error instanceof McpCapabilityError) {
    return {
      error: {
        code: error.code,
        explanation: error.explanation,
        expectedSchema: error.expectedSchema,
        suggestedFix: error.suggestedFix,
      },
    };
  }

  return {
    error: {
      code: "MCP_INTERNAL_ERROR",
      explanation: error instanceof Error ? error.message : String(error),
      suggestedFix: "Check the request JSON and retry. Run ontoly mcp --list to inspect supported capabilities.",
    },
  };
}

function serializeTraversal(traversal: GraphTraversal): JsonObject {
  return {
    startId: traversal.startId,
    order: [...traversal.order],
    nodes: traversal.nodes.map(serializeNode),
    edges: traversal.edges.map(serializeEdge),
  };
}

function formatInspection(inspection: JsonObject): string {
  if (inspection.kind === "file") {
    const nodes = (inspection.nodes as readonly JsonObject[]).map((node) => `  ${node.type} ${node.id}`).join("\n");
    const imports = (inspection.imports as readonly JsonObject[]).map((edge) => `  ${edge.from} -> ${edge.to}`).join("\n") || "  none";
    const exports = (inspection.exports as readonly JsonObject[]).map((edge) => `  ${edge.from} -> ${edge.to}`).join("\n") || "  none";
    return [`File: ${inspection.file}`, "Nodes:", nodes || "  none", "Imports:", imports, "Exports:", exports].join("\n");
  }

  const node = inspection.node as JsonObject;
  const source = inspection.source as JsonObject | null;
  const callers = (inspection.callers as readonly JsonObject[]).map((item) => `  ${item.id}`).join("\n") || "  none";
  const callees = (inspection.callees as readonly JsonObject[]).map((item) => `  ${item.id}`).join("\n") || "  none";
  const incoming = (inspection.incoming as readonly JsonObject[]).map((edge) => `  ${edge.type} ${edge.from} -> ${edge.to}`).join("\n") || "  none";
  const outgoing = (inspection.outgoing as readonly JsonObject[]).map((edge) => `  ${edge.type} ${edge.from} -> ${edge.to}`).join("\n") || "  none";

  return [
    `${node.type}: ${node.id}`,
    `Name: ${node.name}`,
    `File: ${node.file ?? "n/a"}`,
    `Source: ${source ? `${source.file}:${source.startLine}:${source.startColumn}` : "n/a"}`,
    "Callers:",
    callers,
    "Callees:",
    callees,
    "Incoming:",
    incoming,
    "Outgoing:",
    outgoing,
  ].join("\n");
}

function formatSkillValidation(report: SkillValidationReport): string {
  const issueLines = report.issues
    .slice(0, 20)
    .map((issue) => `  ${issue.severity.toUpperCase()} ${issue.skill}: ${issue.message}`);

  return [
    "Ontoly Skills Validation",
    "",
    `Status: ${report.status}`,
    `Skills: ${report.validSkills}/${report.totalSkills}`,
    `Agent evaluation: ${report.agentEvaluation.status}`,
    `Regression: ${report.agentEvaluation.regression.status}`,
    "",
    "Skills:",
    ...report.skills.map((skill) => `  ${skill.id} (${skill.version}) -> ${skill.capabilities.join(", ")}`),
    "",
    "Issues:",
    ...(issueLines.length ? issueLines : ["  none"]),
    ...(report.issues.length > issueLines.length ? [`  ... ${report.issues.length - issueLines.length} more`] : []),
    "",
    "Reports:",
    "  validation/skills/report.md",
    "  validation/skills/agent-evaluation.md",
  ].join("\n");
}

function formatTrace(trace: GraphTraversal): string {
  if (trace.order.length === 0) {
    return `No trace found from ${trace.startId}`;
  }

  return trace.order.join("\n↓\n");
}

function formatStats(stats: GraphStatistics): string {
  return [
    `Nodes: ${stats.nodeCount}${formatCountRecord(stats.nodeKinds)}`,
    `Edges: ${stats.edgeCount}${formatCountRecord(stats.relationshipCounts)}`,
    `Average degree: ${stats.averageDegree}`,
    `Maximum degree: ${stats.maximumDegree.nodeId ?? "none"} (${stats.maximumDegree.degree})`,
    `Disconnected components: ${stats.disconnectedComponents}`,
    `Cycles: ${stats.cycles.length}`,
    `Longest call chain: ${stats.longestCallChain.join(" -> ") || "none"}`,
    `Most imported module: ${stats.mostImportedModule.nodeId ?? "none"} (${stats.mostImportedModule.count})`,
    `Most depended upon service: ${stats.mostDependedUponService.nodeId ?? "none"} (${stats.mostDependedUponService.count})`,
    `Graph density: ${stats.graphDensity}`,
    `Largest component: ${stats.largestComponent}`,
    `Average path length: ${stats.averagePathLength ?? "n/a"}`,
  ].join("\n");
}

function formatArchitectureSummary(summary: JsonObject): string {
  const stats = summary.statistics as JsonObject;

  return [
    "# Architecture Summary",
    "",
    `Repository: ${summary.repository}`,
    `Graph hash: ${summary.hash}`,
    `Nodes: ${stats.nodeCount ?? 0}`,
    `Edges: ${stats.edgeCount ?? 0}`,
    "",
    `Frameworks: ${formatNodeList(summary.frameworks as readonly JsonObject[])}`,
    `Packages: ${formatNodeList(summary.packages as readonly JsonObject[])}`,
    `Services: ${formatNodeList(summary.services as readonly JsonObject[])}`,
    `Repositories: ${formatNodeList(summary.repositories as readonly JsonObject[])}`,
    `Routes: ${formatNodeList(summary.routes as readonly JsonObject[])}`,
    `Configuration: ${formatNodeList(summary.configuration as readonly JsonObject[])}`,
  ].join("\n");
}

function formatReport(report: JsonObject): string {
  const lines = [`# ${report.title ?? "Ontoly Report"}`, ""];

  for (const [key, value] of Object.entries(report).sort(([left], [right]) => left.localeCompare(right))) {
    if (key === "title") {
      continue;
    }

    lines.push(`## ${titleCase(key)}`);
    lines.push(formatReportValue(value));
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function formatReportValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "none";
    }

    return value.map((item) => `- ${formatReportScalar(item)}`).join("\n");
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `- ${key}: ${formatReportScalar(entry)}`)
      .join("\n");
  }

  return String(value ?? "n/a");
}

function formatReportScalar(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    const object = value as Record<string, unknown>;
    const id = typeof object.id === "string" ? object.id : undefined;
    const type = typeof object.type === "string" ? object.type : undefined;
    const name = typeof object.name === "string" ? object.name : undefined;

    if (id) {
      return `${type ? `${type} ` : ""}${id}${name && name !== id ? ` (${name})` : ""}`;
    }

    return JSON.stringify(value);
  }

  return String(value ?? "n/a");
}

function formatNodeList(nodes: readonly JsonObject[]): string {
  return nodes.length > 0
    ? nodes.map((node) => `${node.type} ${node.id}`).join(", ")
    : "none";
}

function architectureMermaid(query: ReturnType<typeof createQueryEngine>): string {
  return exportMermaid(architectureGraph(query));
}

function architectureGraph(query: ReturnType<typeof createQueryEngine>): SoftwareGraph {
  const relevantTypes = new Set(["Workspace", "Package", "Framework", "Service", "Repository", "Route", "Configuration"]);
  const nodes = query.findNodes().filter((node) => relevantTypes.has(node.type));
  const nodeIds = new Set(nodes.map((node) => node.id));

  return {
    ...query.graph,
    nodes,
    edges: query.graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
  };
}

function reportMermaid(query: ReturnType<typeof createQueryEngine>, target: string): string {
  if (target === "api" || target === "routes" || target === "controllers") {
    const routeIds = new Set(query.routes().map((route) => route.id));
    const controllerIds = new Set(query.findNodes({ type: "Controller" }).map((node) => node.id));
    const edges = query.graph.edges.filter((edge) =>
      routeIds.has(edge.from) ||
      routeIds.has(edge.to) ||
      controllerIds.has(edge.from) ||
      controllerIds.has(edge.to) ||
      ["HANDLES", "AUTHORIZES", "USES", "MOUNTS", "DECLARES", "REGISTERS"].includes(edge.type),
    );
    const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
    const graph: SoftwareGraph = {
      ...query.graph,
      nodes: query.graph.nodes.filter((node) => nodeIds.has(node.id)),
      edges,
    };
    return exportMermaid(graph);
  }

  if (target === "modules" || target === "providers" || target === "framework") {
    const relevantTypes = new Set(["Application", "Framework", "Module", "Controller", "Provider", "Factory", "Service", "Repository"]);
    const nodes = query.graph.nodes.filter((node) => relevantTypes.has(node.type));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = query.graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    return exportMermaid({ ...query.graph, nodes, edges });
  }

  if (target === "dependencies") {
    const edges = query.graph.edges.filter((edge) => edge.type === "DEPENDS_ON" || edge.type === "IMPORTS");
    const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
    const graph: SoftwareGraph = {
      ...query.graph,
      nodes: query.graph.nodes.filter((node) => nodeIds.has(node.id)),
      edges,
    };
    return exportMermaid(graph);
  }

  return architectureMermaid(query);
}

function formatQueryResult(operation: string, result: JsonObject): string {
  if ("nodes" in result) {
    return ((result.nodes as readonly JsonObject[]) ?? []).map((node) => `${node.type} ${node.id}`).join("\n") || "No nodes found";
  }

  if ("callers" in result) {
    return ((result.callers as readonly JsonObject[]) ?? []).map((node) => `${node.type} ${node.id}`).join("\n") || "No callers found";
  }

  if ("callees" in result) {
    return ((result.callees as readonly JsonObject[]) ?? []).map((node) => `${node.type} ${node.id}`).join("\n") || "No callees found";
  }

  if ("traversal" in result) {
    return formatTrace((result.traversal as JsonObject) as unknown as GraphTraversal);
  }

  if ("related" in result) {
    return ((result.related as readonly JsonObject[]) ?? []).map((node) => `${node.type} ${node.id}`).join("\n") || "No related nodes found";
  }

  if ("cycles" in result) {
    return ((result.cycles as readonly string[][]) ?? []).map((cycle) => cycle.join(" -> ")).join("\n") || "No cycles found";
  }

  return `${operation}: ${JSON.stringify(result, null, 2)}`;
}

function titleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function exportMermaid(graph: SoftwareGraph): string {
  const lines = ["graph TD"];
  const nodeNames = new Map(graph.nodes.map((node, index) => [node.id, `n${index}`] as const));

  for (const node of graph.nodes) {
    lines.push(`  ${nodeNames.get(node.id)}["${escapeMermaid(`${node.name}\\n${node.type}`)}"]`);
  }

  for (const edge of graph.edges) {
    lines.push(`  ${nodeNames.get(edge.from)} -->|"${edge.type}"| ${nodeNames.get(edge.to)}`);
  }

  return lines.join("\n");
}

function exportTraversalMermaid(trace: GraphTraversal): string {
  const lines = ["graph TD"];

  for (const node of trace.nodes) {
    lines.push(`  "${escapeMermaid(node.id)}"["${escapeMermaid(`${node.name}\\n${node.type}`)}"]`);
  }

  for (const edge of trace.edges) {
    lines.push(`  "${escapeMermaid(edge.from)}" -->|"${edge.type}"| "${escapeMermaid(edge.to)}"`);
  }

  return lines.join("\n");
}

function exportDot(graph: SoftwareGraph): string {
  return [
    "digraph SoftwareGraph {",
    ...graph.nodes.map((node) => `  "${escapeDot(node.id)}" [label="${escapeDot(`${node.name}\\n${node.type}`)}"];`),
    ...graph.edges.map((edge) => `  "${escapeDot(edge.from)}" -> "${escapeDot(edge.to)}" [label="${edge.type}"];`),
    "}",
  ].join("\n");
}

function exportGraphML(graph: SoftwareGraph): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '  <graph edgedefault="directed">',
    ...graph.nodes.map((node) => `    <node id="${escapeXml(node.id)}"><data key="label">${escapeXml(node.name)}</data><data key="type">${node.type}</data></node>`),
    ...graph.edges.map((edge) => `    <edge id="${escapeXml(edge.id)}" source="${escapeXml(edge.from)}" target="${escapeXml(edge.to)}"><data key="type">${edge.type}</data></edge>`),
    "  </graph>",
    "</graphml>",
  ].join("\n");
}

function formatCountRecord(record: Record<string, number>): string {
  const summary = Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");

  return summary ? ` (${summary})` : "";
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, "'");
}

function escapeDot(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseCli(args: readonly string[]): ParsedCli {
  const [command = "help", ...rest] = args;
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = rest[index + 1];

    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }

  return {
    command,
    positional,
    flags,
  };
}

function flagString(cli: ParsedCli, name: string, fallback: string): string {
  const value = cli.flags.get(name);
  return typeof value === "string" ? value : fallback;
}

function flagNumber(cli: ParsedCli, name: string, fallback: number): number {
  const value = Number(flagString(cli, name, String(fallback)));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function flagBoolean(cli: ParsedCli, name: string): boolean {
  return cli.flags.get(name) === true;
}

function rootFromCli(
  cli: ParsedCli,
  options: { readonly positional?: boolean | undefined } = {},
): string {
  const fallback = options.positional === false ? process.cwd() : cli.positional[0] ?? process.cwd();
  return flagString(cli, "root", fallback);
}

function formatCounts(values: readonly string[]): string {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const summary = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => `${value} ${count}`)
    .join(", ");

  return summary ? ` (${summary})` : "";
}

function doctorRecommendations(
  checks: Awaited<ReturnType<typeof doctorRepository>>,
): readonly string[] {
  const recommendations: string[] = [];
  const byName = new Map(checks.map((check) => [check.name, check]));

  if (byName.get("package.json")?.ok === false) {
    recommendations.push("Add a package.json at the repository root or run ontoly from the project directory.");
  }

  if (byName.get("source inventory")?.ok === false) {
    recommendations.push("Add TypeScript or JavaScript source files before building a Software Graph.");
  }

  if (byName.get("graph artifacts")?.ok === false) {
    recommendations.push("Run ontoly build . to generate .ontoly/SoftwareGraph.json.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Repository is ready. Run ontoly build . and ontoly coverage . next.");
  }

  return recommendations;
}

function toJsonObject(value: unknown): JsonObject | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return undefined;
}

function createCliLogger(cli: ParsedCli): CliLogger {
  const json = flagBoolean(cli, "log-json");
  const debugEnabled = flagBoolean(cli, "debug") || flagBoolean(cli, "verbose");
  const traceEnabled = flagBoolean(cli, "trace");
  const colorEnabled = !flagBoolean(cli, "no-color") && !process.env.NO_COLOR;

  const emit = (level: CliLogLevel, message: string, stream: NodeJS.WriteStream): void => {
    if (json) {
      stream.write(`${JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
      })}\n`);
      return;
    }

    stream.write(`${formatLogPrefix(level, colorEnabled)} ${message}\n`);
  };

  return {
    write: (message = "") => {
      process.stdout.write(`${message}\n`);
    },
    info: (message) => emit("info", message, process.stdout),
    success: (message) => emit("success", message, process.stdout),
    warning: (message) => emit("warning", message, process.stderr),
    error: (message) => emit("error", message, process.stderr),
    debug: (message) => {
      if (debugEnabled) emit("debug", message, process.stderr);
    },
    trace: (message) => {
      if (traceEnabled) emit("trace", message, process.stderr);
    },
  };
}

function formatLogPrefix(level: CliLogLevel, colorEnabled: boolean): string {
  const labels: Record<CliLogLevel, string> = {
    info: "info",
    success: "success",
    warning: "warning",
    error: "error",
    debug: "debug",
    trace: "trace",
  };
  const colors: Record<CliLogLevel, string> = {
    info: "36",
    success: "32",
    warning: "33",
    error: "31",
    debug: "35",
    trace: "90",
  };
  const label = labels[level].padEnd(7);
  return colorEnabled ? `\u001b[${colors[level]}m${label}\u001b[0m` : label;
}

function formatCliError(error: unknown): string {
  if (error instanceof OntolyCliError) {
    return [
      error.code,
      "",
      error.message,
      error.suggestion ? ["", "Suggestion:", error.suggestion].join("\n") : "",
      error.docs ? ["", "Documentation:", error.docs].join("\n") : "",
      error.cause ? ["", "Cause:", formatErrorCause(error.cause)].join("\n") : "",
    ].filter(Boolean).join("\n");
  }

  if (error instanceof Error) {
    return [
      "ONTOLY0000",
      "",
      error.message,
      "",
      "Suggestion:",
      "Run the command again with --debug. If the issue persists, include the command output in a bug report.",
    ].join("\n");
  }

  return String(error);
}

function formatErrorCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function printCommandHelp(command: string): void {
  const help = commandHelp()[command];
  if (!help) {
    throw new OntolyCliError({
      code: "ONTOLY0002",
      message: `No help entry exists for command "${command}".`,
      suggestion: "Run ontoly --help to see the command list.",
      docs: "docs/cli.md",
    });
  }

  logger.write(renderCommandHelp(help));
}

interface CommandHelp {
  readonly title: string;
  readonly usage: readonly string[];
  readonly description: string;
  readonly options?: readonly string[] | undefined;
  readonly examples: readonly string[];
}

function commandHelp(): Record<string, CommandHelp> {
  return {
    init: {
    title: "ontoly init",
    description: "Create the local Ontoly artifact directory and default config.",
    usage: ["ontoly init [root] [--root path]"],
    options: ["--root path    Repository root."],
    examples: ["ontoly init", "ontoly init packages/api"],
  },
  build: {
    title: "ontoly build",
    description: "Compile a repository into a deterministic Software Graph.",
    usage: ["ontoly build [root] [--root path] [--output ontoly-output] [--bundle] [--json]"],
    options: [
      "--output path        Artifact directory. Default: ontoly-output.",
      "--bundle             Also write a rich ontoly-output bundle when using another --output path.",
      "--bundle-output path Rich output directory. Default: ontoly-output.",
      "--no-html            Skip HTML files in the rich output bundle.",
      "--json               Print a machine-readable summary.",
      "--debug              Print debug logs.",
    ],
    examples: ["ontoly build .", "ontoly build examples/basic --output .ontoly", "ontoly build . --output .ontoly --bundle", "ontoly build . --json"],
  },
  output: {
    title: "ontoly output",
    description: "Compile a repository into a rich ontoly-output folder with JSON reports, communities, and HTML explorers.",
    usage: ["ontoly output [root] [--output ontoly-output] [--json]"],
    options: [
      "--output path   Output bundle directory. Default: ontoly-output.",
      "--no-html       Skip html/graph.html and html/architecture.html.",
      "--no-semantic   Skip semantic-model.json.",
      "--max-nodes n   Maximum nodes for HTML graph output. Default: 2500.",
      "--max-edges n   Maximum edges for HTML graph output. Default: 5000.",
      "--json          Print JSON summary.",
    ],
    examples: ["ontoly output .", "ontoly output examples/basic", "ontoly output . --output ontoly-output --json"],
  },
  analyze: {
    title: "ontoly analyze",
    description: "Write the TypeScript Semantic Model without requiring graph consumers.",
    usage: ["ontoly analyze [root] [--output .ontoly] [--json]"],
    options: ["--output path  Artifact directory.", "--json         Print JSON summary."],
    examples: ["ontoly analyze .", "ontoly analyze examples/basic --json"],
  },
  semantic: {
    title: "ontoly semantic",
    description: "Read or create the TypeScript Semantic Model and print a summary or JSON.",
    usage: ["ontoly semantic [root] [--format summary|json] [--json]"],
    options: ["--format kind  summary or json.", "--json         Alias for --format json."],
    examples: ["ontoly semantic", "ontoly semantic . --format json"],
  },
  frameworks: {
    title: "ontoly frameworks",
    description: "Detect framework evidence from the semantic model and graph.",
    usage: ["ontoly frameworks [root] [--json]"],
    options: ["--json         Print JSON."],
    examples: ["ontoly frameworks", "ontoly frameworks examples/basic --json"],
  },
  watch: {
    title: "ontoly watch",
    description: "Watch a repository and rebuild its graph when files change.",
    usage: ["ontoly watch [root] [--root path]"],
    options: ["--root path    Repository root."],
    examples: ["ontoly watch .", "ontoly watch apps/api"],
  },
  inspect: {
    title: "ontoly inspect",
    description: "Inspect a file, node id, or symbol name in the Software Graph.",
    usage: ["ontoly inspect [file-or-node] [--root path] [--json]"],
    options: ["--root path    Repository root.", "--json         Print JSON."],
    examples: ["ontoly inspect src/auth.service.ts", "ontoly inspect AuthService", "ontoly inspect fn:src/auth.ts:login --json"],
  },
  trace: {
    title: "ontoly trace",
    description: "Trace graph relationships from a node.",
    usage: ["ontoly trace <node-id-or-name> [--depth 3] [--format mermaid] [--json]"],
    options: ["--depth n      Traversal depth.", "--format mermaid  Render a Mermaid graph.", "--json         Print JSON."],
    examples: ["ontoly trace AuthController.login", "ontoly trace fn:src/auth.ts:login --depth 4", "ontoly trace AuthService --format mermaid"],
  },
  graph: {
    title: "ontoly graph",
    description: "Print or export the current Software Graph.",
    usage: ["ontoly graph [root] [--format summary|json|mermaid|dot|graphml|html]"],
    options: ["--format kind  summary, json, mermaid, dot, graphml, or html.", "--json         Alias for --format json."],
    examples: ["ontoly graph .", "ontoly graph --format mermaid", "ontoly graph --format html > graph.html", "ontoly graph --json"],
  },
  stats: {
    title: "ontoly stats",
    description: "Print graph statistics from the query engine.",
    usage: ["ontoly stats [root] [--json]"],
    options: ["--json         Print JSON."],
    examples: ["ontoly stats", "ontoly stats . --json"],
  },
  architecture: {
    title: "ontoly architecture",
    description: "Print an architecture summary from graph entities.",
    usage: ["ontoly architecture [root] [--format mermaid|html] [--json]"],
    options: [
      "--format kind  mermaid or html.",
      "--max-nodes n  Maximum nodes for HTML output. Default: 1200.",
      "--max-edges n  Maximum edges for HTML output. Default: 2400.",
      "--json         Print JSON.",
    ],
    examples: ["ontoly architecture", "ontoly architecture --format mermaid", "ontoly architecture --format html > architecture.html"],
  },
  evaluate: {
    title: "ontoly evaluate",
    description: "Run deterministic semantic evaluation questions against validation artifacts.",
    usage: ["ontoly evaluate [repository] [--json] [--ci] [--refresh]"],
    options: ["--ci          Fail on semantic regression.", "--refresh     Rebuild validation artifacts before scoring.", "--json        Print JSON."],
    examples: ["ontoly evaluate", "ontoly evaluate ovok-core", "ontoly evaluate --ci"],
  },
  validate: {
    title: "ontoly validate",
    description: "Run the permanent validation lab and release gates.",
    usage: ["ontoly validate [all|repository|framework] [--json] [--ci] [--clone] [--install]"],
    options: ["--ci          Fail on release-gate failure.", "--clone       Clone remote corpus entries.", "--install     Install dependencies for validation-owned clones.", "--json        Print JSON."],
    examples: ["ontoly validate all", "ontoly validate ovok-core", "ontoly validate nextjs --clone"],
  },
  coverage: {
    title: "ontoly coverage",
    description: "Analyze graph coverage, trust, quality diagnostics, and recommendations.",
    usage: ["ontoly coverage [root] [--format human|markdown|json] [--json]"],
    options: ["--format kind  Output format.", "--json         Print JSON."],
    examples: ["ontoly coverage .", "ontoly coverage . --format markdown", "ontoly coverage . --json"],
  },
  report: {
    title: "ontoly report",
    description: "Generate graph-native reports for APIs, dependencies, frameworks, and workspace entities.",
    usage: ["ontoly report [summary|api|dependencies|configuration|framework|frameworks|controllers|routes|modules|providers|workspace] [--format markdown|json|mermaid]"],
    options: ["--format kind  markdown, json, or mermaid.", "--json         Alias for --format json."],
    examples: ["ontoly report api", "ontoly report routes", "ontoly report dependencies --json"],
  },
  query: {
    title: "ontoly query",
    description: "Run deterministic query-engine operations against the graph.",
    usage: ["ontoly query <find|callers|callees|dependencies|dependents|related|impact|routes|frameworks|configuration|cycles> [target] [--json]"],
    options: ["--depth n      Traversal depth for dependency operations.", "--json         Print JSON."],
    examples: ["ontoly query find AuthService", "ontoly query callers UserService.load", "ontoly query routes --json"],
  },
  leaderboard: {
    title: "ontoly leaderboard",
    description: "Print the latest semantic evaluation leaderboard.",
    usage: ["ontoly leaderboard [--json]"],
    options: ["--json         Print JSON."],
    examples: ["ontoly leaderboard", "ontoly leaderboard --json"],
  },
  benchmark: {
    title: "ontoly benchmark",
    description: "Benchmark graph builds, semantic evaluation, or the performance lab.",
    usage: ["ontoly benchmark [root] [--runs 3]", "ontoly benchmark semantic", "ontoly benchmark performance"],
    options: ["--runs n      Number of graph build runs.", "--json        Print JSON when supported."],
    examples: ["ontoly benchmark .", "ontoly benchmark semantic", "ontoly benchmark performance"],
  },
  diff: {
    title: "ontoly diff",
    description: "Compare two Software Graph JSON artifacts.",
    usage: ["ontoly diff <old.graph> <new.graph> [--json] [--output path]"],
    options: ["--json         Print JSON.", "--output path  Write the diff to a file."],
    examples: ["ontoly diff old.graph new.graph", "ontoly diff before.json after.json --json"],
  },
  export: {
    title: "ontoly export",
    description: "Write the Software Graph JSON to a chosen path.",
    usage: ["ontoly export [path]"],
    options: ["--root path    Repository root."],
    examples: ["ontoly export software-graph.json", "ontoly export /tmp/graph.json"],
  },
  mcp: {
    title: "ontoly mcp",
    description: "Start the structured MCP runtime over the Software Graph.",
    usage: ["ontoly mcp [--list]"],
    options: ["--list         Print supported capabilities instead of starting the runtime."],
    examples: ["ontoly mcp --list", "ontoly mcp"],
  },
  skills: {
    title: "ontoly skills",
    description: "List, validate, and diagnose portable Ontoly Agent Skills.",
    usage: ["ontoly skills list [--json]", "ontoly skills validate [--json] [--ci]", "ontoly skills doctor [--json] [--ci]"],
    options: ["--json         Print JSON.", "--ci           Fail on validation failure."],
    examples: ["ontoly skills list", "ontoly skills validate", "ontoly skills doctor --json"],
  },
  doctor: {
    title: "ontoly doctor",
    description: "Check repository readiness and print actionable recommendations.",
    usage: ["ontoly doctor [root] [--json]"],
    options: ["--json         Print JSON."],
    examples: ["ontoly doctor", "ontoly doctor examples/basic --json"],
  },
  };
}

function renderCommandHelp(help: CommandHelp): string {
  return [
    help.title,
    "",
    help.description,
    "",
    "Usage:",
    ...help.usage.map((line) => `  ${line}`),
    "",
    ...(help.options?.length ? ["Options:", ...help.options.map((line) => `  ${line}`), ""] : []),
    "Examples:",
    ...help.examples.map((line) => `  ${line}`),
  ].join("\n");
}

function printHelp(): void {
  logger.write(`Ontoly

TypeScript-native software intelligence. Ontoly builds deterministic Software Graphs.

Usage:
  ontoly init [root] [--root path]
  ontoly build [root] [--root path] [--output ontoly-output] [--bundle]
  ontoly output [root] [--root path] [--output ontoly-output]
  ontoly analyze [root] [--root path] [--output .ontoly] [--json]
  ontoly semantic [root] [--root path] [--format summary|json]
  ontoly frameworks [root] [--root path] [--json]
  ontoly watch [root] [--root path]
  ontoly inspect [file-or-node] [--root path] [--json]
  ontoly trace <node-id-or-name> [--depth 3] [--format mermaid] [--json]
  ontoly stats [root] [--root path] [--json]
  ontoly architecture [root] [--root path] [--format mermaid|html] [--json]
  ontoly coverage [root] [--root path] [--format human|markdown|json] [--json]
  ontoly report [summary|api|dependencies|configuration|framework|frameworks|controllers|routes|modules|providers|workspace] [--root path] [--format markdown|json|mermaid]
  ontoly graph [root] [--root path] [--format summary|json|mermaid|dot|graphml|html]
  ontoly query <find|callers|callees|dependencies|dependents|related|impact|routes|frameworks|configuration|cycles> [target] [--json]
  ontoly doctor [root] [--root path] [--json]
  ontoly export [path]
  ontoly mcp [--list]
  ontoly skills <list|validate|doctor> [--json] [--ci]
  ontoly validate [all|repository|framework] [--json] [--ci] [--clone] [--install]
  ontoly evaluate [repository] [--json] [--ci] [--refresh]
  ontoly leaderboard [--json]
  ontoly diff <old.graph> <new.graph> [--json] [--output path]
  ontoly benchmark [root] [--runs 3]
  ontoly benchmark semantic [--json] [--refresh]
  ontoly benchmark performance [--json]

Examples:
  ontoly build .
  ontoly output .
  ontoly build . --bundle
  ontoly analyze .
  ontoly semantic
  ontoly frameworks
  ontoly stats
  ontoly inspect src/service.ts
  ontoly trace fn:src/index.ts:main
  ontoly graph --format mermaid
  ontoly graph --format html > graph.html
  ontoly architecture
  ontoly architecture --format html > architecture.html
  ontoly coverage
  ontoly report api
  ontoly report routes
  ontoly report dependencies
  ontoly report configuration
  ontoly query callers UserService.load
  ontoly skills list
  ontoly skills validate
  ontoly skills doctor
  ontoly validate all
  ontoly validate ovok-core
  ontoly validate nextjs
  ontoly validate react
  ontoly evaluate
  ontoly evaluate ovok-core
  ontoly leaderboard
  ontoly diff old.graph new.graph
  ontoly benchmark semantic
  ontoly benchmark performance

Logging:
  --verbose      Enable debug logs.
  --debug        Enable debug logs.
  --trace        Enable trace logs.
  --log-json     Emit structured JSON logs for log messages.
  --no-color     Disable ANSI colors.

Help:
  ontoly <command> --help
`);
}

export {
  OntolyCliError,
  commandHelp,
  formatCliError,
  formatLogPrefix,
  parseCli,
  renderCommandHelp,
};
