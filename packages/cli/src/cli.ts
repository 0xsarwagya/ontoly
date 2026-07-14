import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  analyzeSemanticCoverage,
  createSemanticEntityReport,
  formatCoverageHuman,
  formatCoverageMarkdown,
  type SemanticCoverageReport,
  type SemanticEntityReport,
} from "@0xsarwagya/ontoly-analyzers";
import { getGraphArtifactPaths, loadGraph, loadOrCreateSemanticIndex } from "@0xsarwagya/ontoly-cache";
import {
  capabilityResultToJson,
  createCapabilityEngine,
  type CapabilityName,
  type CapabilityResult,
  type SerializedNode,
} from "@0xsarwagya/ontoly-capabilities";
import {
  buildSoftwareGraph,
  buildSoftwareGraphWithArtifacts,
  createRepositoryIntelligencePass,
  doctorRepository,
  initializeOntolyProject,
  watchSoftwareGraph,
  writeGraphArtifacts,
} from "@0xsarwagya/ontoly-compiler";
import {
  createSoftwareGraph,
  stableHash,
  stableStringify,
  summarizeGraph,
  type JsonObject,
  type JsonValue,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphDiagnostic,
  type SoftwareGraphNode,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";
import {
  ARTIFACT_DESCRIPTORS,
  artifactRequirement,
  createArtifact,
  createDefaultEnhancerContext,
  createMemoryEnhancerCache,
  defineEnhancer,
  discoverEnhancerManifests,
  runEnhancerPipeline,
  validateEnhancers,
  visualizeEnhancerPipeline,
  type Enhancer,
  type EnhancerCache,
  type EnhancerManifest,
  type EnhancerPipelineResult,
  type EnhancerRunResult,
  type EnhancerValidationIssue,
  type OntolyArtifact,
} from "@0xsarwagya/ontoly-enhancer";
import {
  createSemanticIndex,
  findConcept,
  findConfiguration as searchConfiguration,
  findEntryPoint,
  findEnvironment,
  findFeature,
  findRepositoryConcept,
  findRoute as searchRoute,
  findSymbol,
  resolveIntent,
  validateSemanticIndex,
  type SearchCategory,
  type SemanticCandidate,
  type SemanticIndex,
  type SemanticSearchResult,
} from "@0xsarwagya/ontoly-index";
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

interface PreparedRepository {
  readonly root: string;
  readonly outputRoot: string;
  readonly source: RepositorySource;
  readonly cleanup: () => Promise<void>;
}

interface PromptEnvironment {
  readonly stdinIsTTY?: boolean | undefined;
  readonly stdoutIsTTY?: boolean | undefined;
}

type RepositorySource =
  | {
    readonly kind: "local";
  }
  | {
    readonly kind: "remote";
    readonly remote: string;
    readonly checkoutRoot: string;
  };

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

    case "explain":
      await capabilityCommand(cli, capabilityFromExplainCli(cli), { targetKey: "query" });
      return;

    case "impact":
      await capabilityCommand(cli, "ImpactAnalysis", { targetKey: "id" });
      return;

    case "implementation-plan":
      await capabilityCommand(cli, "ImplementationPlan", { targetKey: "task", joinPositionals: true });
      return;

    case "ownership":
      await capabilityCommand(cli, "OwnershipAnalysis", { targetKey: "query" });
      return;

    case "health":
      await capabilityCommand(cli, "RepositoryHealth", { positionalRoot: true });
      return;

    case "repository-summary":
      await capabilityCommand(cli, "RepositorySummary", { positionalRoot: true });
      return;

    case "risk":
      await capabilityCommand(cli, "RiskAnalysis", { targetKey: "query" });
      return;

    case "request-trace":
      await capabilityCommand(cli, "RequestTrace", { targetKey: "query" });
      return;

    case "coverage":
      await coverageCommand(cli);
      return;

    case "report":
      await reportCommand(cli);
      return;

    case "search":
    case "find":
    case "locate":
      await searchCommand(cli);
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

    case "enhancer":
      await enhancerCommand(cli);
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
  const repository = await prepareRepository(cli);
  const outputDir = outputDirectoryForRepository(repository, flagString(cli, "output", "ontoly-output"));
  const writeCompilerArtifacts = !isOntolyOutputDirectory(outputDir);
  let bundle: OntolyOutputBundle | undefined;

  try {
    const result = await buildSoftwareGraphWithArtifacts({
      root: repository.root,
      outputDir,
      write: repository.source.kind === "local" ? writeCompilerArtifacts : false,
      passes: defaultCompilerPasses(),
    });
    const graph = result.graph ? graphForRepositorySource(result.graph, repository.source) : undefined;
    let artifacts = result.artifacts;

    if (graph && result.status !== "failed" && writeCompilerArtifacts && repository.source.kind === "remote") {
      artifacts = await writeGraphArtifacts(graph, {
        root: repository.outputRoot,
        directory: outputDir,
      });
    }

    if (!graph || result.status === "failed") {
      if (flagBoolean(cli, "json")) {
        logger.write(JSON.stringify({
          status: result.status,
          source: sourceSummary(repository.source),
          files: result.discovery.files.length,
          nodes: 0,
          edges: 0,
          diagnostics: result.diagnostics.length,
          artifacts,
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
      bundle = await writeOutputBundle({
        sourceRoot: repository.root,
        outputRoot: repository.outputRoot,
        outputDir: outputDirectoryForRepository(
          repository,
          flagString(cli, "bundle-output", isOntolyOutputDirectory(outputDir) ? outputDir : "ontoly-output"),
        ),
        graph,
        cli,
        source: repository.source,
      });
    }

    if (flagBoolean(cli, "json")) {
      logger.write(JSON.stringify({
        status: result.status,
        source: sourceSummary(repository.source),
        files: result.discovery.files.length,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        diagnostics: graph.diagnostics.length,
        hash: graph.metadata.deterministicHash,
        artifacts,
        outputBundle: bundle ? {
          directory: bundle.directory,
          files: bundle.files.length,
          communities: bundle.communities.length,
        } : undefined,
      }, null, 2));
      process.exitCode = result.status === "success" ? 0 : 1;
      return;
    }

    if (repository.source.kind === "remote") {
      logger.info(`Remote: ${repository.source.remote}`);
    }
    logger.info(`Indexed ${result.discovery.files.length} files`);
    logger.info(`Built ${graph.nodes.length} nodes${formatCounts(graph.nodes.map((node) => node.type))}`);
    logger.info(`Generated ${graph.edges.length} relationships${formatCounts(graph.edges.map((edge) => edge.type))}`);

    const duration = graph.metadata.durationMs ?? 0;
    logger.success("Built Software Graph");
    logger.info(`Diagnostics: ${graph.diagnostics.length}`);
    logger.info(`Hash: ${graph.metadata.deterministicHash}`);
    logger.success(`Build completed in ${(duration / 1000).toFixed(2)}s`);

    if (artifacts) {
      logger.info(`Graph: ${artifacts.graph}`);
      logger.info(`Diagnostics: ${artifacts.diagnostics}`);
      logger.info(`Semantic Index: ${artifacts.semanticIndex}`);
      logger.info(`Statistics: ${artifacts.statistics}`);
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
  } finally {
    await repository.cleanup();
  }
}

async function outputCommand(cli: ParsedCli): Promise<void> {
  const repository = await prepareRepository(cli);
  const outputDir = outputDirectoryForRepository(repository, flagString(cli, "output", "ontoly-output"));

  try {
    const result = await buildSoftwareGraphWithArtifacts({
      root: repository.root,
      outputDir,
      write: false,
      passes: defaultCompilerPasses(),
    });
    const graph = result.graph ? graphForRepositorySource(result.graph, repository.source) : undefined;

    if (!graph || result.status === "failed") {
      throw new OntolyCliError({
        code: "ONTOLY4001",
        message: "Could not create ontoly-output because graph compilation failed.",
        suggestion: "Run ontoly build . --debug and resolve compiler diagnostics first.",
        docs: "docs/cli.md#output",
      });
    }

    const bundle = await writeOutputBundle({
      sourceRoot: repository.root,
      outputRoot: repository.outputRoot,
      outputDir,
      graph,
      cli,
      source: repository.source,
    });

    if (flagBoolean(cli, "json")) {
      logger.write(JSON.stringify({
        source: sourceSummary(repository.source),
        directory: bundle.directory,
        files: bundle.files,
        communities: bundle.communities.length,
        graphHash: graph.metadata.deterministicHash,
      }, null, 2));
      return;
    }

    if (repository.source.kind === "remote") {
      logger.info(`Remote: ${repository.source.remote}`);
    }
    logger.success(`Compiled Ontoly output bundle: ${bundle.directory}`);
    logger.info(`Files: ${bundle.files.length}`);
    logger.info(`Communities: ${bundle.communities.length}`);
    logger.info(`Graph: ${bundle.directory}/SoftwareGraph.json`);
    logger.info(`HTML: ${bundle.directory}/html/graph.html`);
    logger.info(`HTML architecture: ${bundle.directory}/html/architecture.html`);
  } finally {
    await repository.cleanup();
  }
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

async function capabilityCommand(
  cli: ParsedCli,
  capability: CapabilityName,
  options: {
    readonly targetKey?: "id" | "query" | "task" | undefined;
    readonly joinPositionals?: boolean | undefined;
    readonly positionalRoot?: boolean | undefined;
  } = {},
): Promise<void> {
  const graph = await loadOrBuildGraph(cli, { positionalRoot: options.positionalRoot ?? false });
  const engine = createCapabilityEngine(graph);
  const input = capabilityInputFromCli(cli, options);
  const result = engine.execute(capability, input);

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(capabilityResultToJson(result), null, 2));
    return;
  }

  logger.write(formatCapabilityResult(capability, result));
}

function capabilityFromExplainCli(cli: ParsedCli): CapabilityName {
  return cli.positional.length > 0 || cli.flags.has("query") || cli.flags.has("id")
    ? "FeatureTouchpoints"
    : "ArchitectureSummary";
}

function capabilityInputFromCli(
  cli: ParsedCli,
  options: {
    readonly targetKey?: "id" | "query" | "task" | undefined;
    readonly joinPositionals?: boolean | undefined;
  },
): JsonObject {
  const input: Record<string, string | number> = {};
  const depth = flagNumber(cli, "depth", -1);

  if (depth >= 0) {
    input.depth = depth;
  }

  if (!options.targetKey) {
    return input;
  }

  const flagValue = flagString(cli, options.targetKey, "");
  const explicit = flagValue || flagString(cli, "id", "") || flagString(cli, "query", "") || flagString(cli, "task", "");
  const positional = options.joinPositionals ? cli.positional.join(" ") : cli.positional[0] ?? "";
  const value = explicit || positional;

  if (value) {
    input[options.targetKey] = value;
  }

  return input;
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

async function searchCommand(cli: ParsedCli): Promise<void> {
  const queryText = cli.positional.join(" ").trim() || flagString(cli, "query", "");
  if (!queryText) {
    throw new OntolyCliError({
      code: "ONTOLY1010",
      message: `${cli.command} requires a concept or symbol query.`,
      suggestion: `Run ontoly ${cli.command} "authentication" or ontoly ${cli.command} "Plan Definition Resource".`,
      docs: "docs/cli.md#search",
    });
  }

  const graph = await loadOrBuildGraph(cli, { positionalRoot: false });
  const semanticIndex = await loadSemanticIndexForCli(cli, graph);
  const issues = validateSemanticIndex(semanticIndex, graph);
  const index = issues.length === 0 ? semanticIndex : createSemanticIndex(graph);
  const category = searchCategoryFromCli(cli);
  const limit = flagNumber(cli, "limit", 10);
  const result = executeSearch(index, queryText, category, limit, cli.command);

  if (flagBoolean(cli, "json")) {
    logger.write(JSON.stringify(searchResultToJson(result), null, 2));
    return;
  }

  logger.write(formatSearchResult(result));
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

async function enhancerCommand(cli: ParsedCli): Promise<void> {
  const action = cli.positional[0] ?? "list";
  const enhancers = defaultCliEnhancers();
  const manifests = await discoverEnhancerManifests({ root: process.cwd() });

  switch (action) {
    case "list": {
      const result = {
        builtIn: enhancers.map((enhancer) => enhancer.manifest()),
        discovered: manifests.map((manifest) => ({
          path: manifest.path,
          manifest: manifest.manifest,
          issues: manifest.issues,
        })),
      };

      if (flagBoolean(cli, "json")) {
        logger.write(JSON.stringify(result, null, 2));
        return;
      }

      logger.write("Ontoly Enhancers");
      logger.write("");
      for (const enhancer of enhancers) {
        logger.write(`${enhancer.id.padEnd(26)} ${enhancer.version.padEnd(8)} ${enhancer.produces.map((artifact) => artifact.id).join(", ")}`);
      }
      if (manifests.length > 0) {
        logger.write("");
        logger.write("Discovered manifests");
        for (const manifest of manifests) {
          logger.write(`${manifest.manifest.id.padEnd(26)} ${manifest.manifest.version.padEnd(8)} ${manifest.path}`);
        }
      }
      logger.write("");
      logger.write(`${enhancers.length} built-in enhancer(s), ${manifests.length} discovered manifest(s)`);
      return;
    }

    case "inspect": {
      const id = cli.positional[1];
      if (!id) {
        throw new OntolyCliError({
          code: "ONTOLY5001",
          message: "enhancer inspect requires an enhancer id.",
          suggestion: "Run ontoly enhancer list, then inspect one of the listed ids.",
          docs: "docs/enhancers.md",
        });
      }
      const manifest = enhancerManifestById(enhancers, manifests.map((entry) => entry.manifest), id);
      if (!manifest) {
        throw new OntolyCliError({
          code: "ONTOLY5002",
          message: `Enhancer not found: ${id}`,
          suggestion: "Run ontoly enhancer list to see built-in and discovered enhancers.",
          docs: "docs/enhancers.md",
        });
      }
      logger.write(JSON.stringify(manifest, null, 2));
      return;
    }

    case "graph": {
      const format = flagString(cli, "format", flagBoolean(cli, "json") ? "json" : "mermaid");
      if (!["json", "mermaid", "dot"].includes(format)) {
        throw new OntolyCliError({
          code: "ONTOLY5003",
          message: `Unsupported enhancer graph format: ${format}`,
          suggestion: "Use --format mermaid, --format dot, or --format json.",
          docs: "docs/enhancers.md#pipeline-visualization",
        });
      }
      logger.write(visualizeEnhancerPipeline(enhancers, format as "json" | "mermaid" | "dot").trimEnd());
      return;
    }

    case "doctor":
    case "validate": {
      const graph = await maybeLoadGraphForEnhancerValidation(cli);
      const context = graph
        ? createDefaultEnhancerContext({
          graph,
          semanticIndex: await loadSemanticIndexForGraph(cli, graph),
          logger: enhancerLoggerFromCli(),
        })
        : undefined;
      const issues = [
        ...validateEnhancers(enhancers, context),
        ...manifests.flatMap((manifest) => manifest.issues),
      ].sort(compareEnhancerIssuesForCli);
      const status = issues.some((issue) => issue.severity === "error") ? "FAIL" : "PASS";
      const result = {
        status,
        builtIn: enhancers.length,
        discovered: manifests.length,
        issues,
      };

      if (flagBoolean(cli, "json")) {
        logger.write(JSON.stringify(result, null, 2));
      } else {
        logger.write(`Enhancer ${action}: ${status}`);
        logger.write("");
        if (issues.length === 0) {
          logger.success("No enhancer issues found.");
        } else {
          for (const issue of issues) {
            logger.write(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
          }
        }
      }

      if ((flagBoolean(cli, "ci") || flagBoolean(cli, "strict")) && status === "FAIL") {
        process.exitCode = 1;
      }
      return;
    }

    case "run": {
      const target = cli.positional[1] ?? "all";
      const root = enhancerRootFromCli(cli, 2);
      const graph = await loadOrBuildGraph({ ...cli, positional: [root] });
      const selected = selectEnhancersForRun(enhancers, target);
      const outputDir = flagString(cli, "output", ".ontoly");
      const cache = await createFileEnhancerCache(resolve(root), outputDir);
      const context = createDefaultEnhancerContext({
        graph,
        semanticIndex: await loadSemanticIndexForGraph({ ...cli, positional: [root] }, graph),
        logger: enhancerLoggerFromCli(),
        cache,
      });
      const result = await runEnhancerPipeline({
        enhancers: selected,
        context,
        parallel: !flagBoolean(cli, "no-parallel"),
        incremental: !flagBoolean(cli, "no-cache"),
      });
      const summaryPath = await writeEnhancerArtifacts(resolve(root), outputDir, result);

      if (flagBoolean(cli, "json")) {
        logger.write(JSON.stringify({
          ...enhancerPipelineResultToJson(result),
          output: summaryPath,
        }, null, 2));
        return;
      }

      logger.success(`Ran ${result.executions.length} enhancer(s)`);
      logger.info(`Artifacts: ${result.artifacts.length}`);
      logger.info(`Hash: ${result.deterministicHash}`);
      logger.info(`Summary: ${summaryPath}`);
      for (const execution of result.executions) {
        logger.write(`${execution.status.padEnd(8)} ${execution.enhancerId} (${execution.artifacts.map((artifact) => artifact.descriptor.id).join(", ") || "no artifacts"})`);
      }
      return;
    }

    default:
      throw new OntolyCliError({
        code: "ONTOLY5000",
        message: `Unknown enhancer command: ${action}`,
        suggestion: "Use one of: list, inspect, run, graph, doctor, validate.",
        docs: "docs/enhancers.md",
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

async function prepareRepository(cli: ParsedCli): Promise<PreparedRepository> {
  const remote = remoteFromCli(cli);

  if (!remote) {
    const root = await rootFromCliOrPrompt(cli);
    return {
      root,
      outputRoot: root,
      source: { kind: "local" },
      cleanup: async () => {},
    };
  }

  if (cli.flags.has("root") || cli.positional.length > 0) {
    throw new OntolyCliError({
      code: "ONTOLY5002",
      message: "--remote cannot be combined with a local repository root.",
      suggestion: "Use `ontoly build --remote <git_repo>` or remove --remote and pass a local path.",
      docs: "docs/cli.md#remote-repositories",
    });
  }

  const checkout = await cloneRemoteRepository(remote, cli);

  return {
    root: checkout.checkoutRoot,
    outputRoot: process.cwd(),
    source: {
      kind: "remote",
      remote,
      checkoutRoot: checkout.checkoutRoot,
    },
    cleanup: async () => {
      await rm(checkout.tempRoot, { recursive: true, force: true });
    },
  };
}

function remoteFromCli(cli: ParsedCli): string | undefined {
  const value = cli.flags.get("remote");

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new OntolyCliError({
      code: "ONTOLY5001",
      message: "--remote requires a git repository URL or path.",
      suggestion: "Run `ontoly build --remote https://github.com/owner/repo.git`.",
      docs: "docs/cli.md#remote-repositories",
    });
  }

  return value.trim();
}

async function cloneRemoteRepository(
  remote: string,
  cli: ParsedCli,
): Promise<{ readonly tempRoot: string; readonly checkoutRoot: string }> {
  const tempRoot = await mkdtemp(join(tmpdir(), "ontoly-remote-"));
  const checkoutRoot = join(tempRoot, "repo");

  if (!flagBoolean(cli, "json")) {
    logger.info(`Cloning remote repository: ${remote}`);
  }

  const result = spawnSync("git", ["clone", "--depth", "1", "--", remote, checkoutRoot], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    await rm(tempRoot, { recursive: true, force: true });
    throw new OntolyCliError({
      code: "ONTOLY5003",
      message: `Could not clone remote repository: ${remote}`,
      suggestion: "Check that the git URL is reachable and that your local git credentials can access it.",
      docs: "docs/cli.md#remote-repositories",
      cause: result.error ?? result.stderr,
    });
  }

  return { tempRoot, checkoutRoot };
}

function outputDirectoryForRepository(repository: PreparedRepository, outputDir: string): string {
  if (repository.source.kind === "local" || isAbsolute(outputDir)) {
    return outputDir;
  }

  return resolve(repository.outputRoot, outputDir);
}

function graphForRepositorySource(graph: SoftwareGraph, source: RepositorySource): SoftwareGraph {
  if (source.kind === "local") {
    return graph;
  }

  return createSoftwareGraph({
    repository: {
      ...graph.repository,
      root: source.remote,
    },
    nodes: graph.nodes.map((node) => normalizeRemoteCheckoutValue(node, source) as SoftwareGraphNode),
    edges: graph.edges.map((edge) => normalizeRemoteCheckoutValue(edge, source) as SoftwareGraphEdge),
    diagnostics: graph.diagnostics.map((diagnostic) =>
      normalizeRemoteCheckoutValue(diagnostic, source) as SoftwareGraphDiagnostic
    ),
    fileCount: graph.metadata.fileCount,
    parserVersions: graph.metadata.parserVersions,
    durationMs: graph.metadata.durationMs,
  });
}

function semanticModelForRepositorySource(
  project: TypeScriptProject,
  source: RepositorySource,
): TypeScriptProject {
  if (source.kind === "local") {
    return project;
  }

  const checkoutNormalized = normalizeRemoteCheckoutValue(project, source) as TypeScriptProject;
  const normalized: TypeScriptProject = {
    ...checkoutNormalized,
    root: source.remote,
    files: checkoutNormalized.files.map((file) => ({
      ...file,
      absoluteFile: remoteFileUrl(source.remote, file.file),
    })),
    sourceFiles: checkoutNormalized.sourceFiles.map((file) => ({
      ...file,
      absoluteFile: remoteFileUrl(source.remote, file.file),
    })),
    metadata: {
      ...checkoutNormalized.metadata,
      deterministicHash: "",
    },
  };

  return {
    ...normalized,
    metadata: {
      ...normalized.metadata,
      deterministicHash: stableHash(stableStringify({ ...normalized, metadata: undefined })),
    },
  };
}

function remoteFileUrl(remote: string, file: string): string {
  return `${remote.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;
}

function normalizeRemoteCheckoutValue(value: unknown, source: Extract<RepositorySource, { readonly kind: "remote" }>): unknown {
  if (typeof value === "string") {
    return replaceCheckoutRoot(value, source);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeRemoteCheckoutValue(item, source));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeRemoteCheckoutValue(entry, source)]),
    );
  }

  return value;
}

async function rootFromCliOrPrompt(cli: ParsedCli): Promise<string> {
  if (!shouldPromptForRepositoryRoot(cli)) {
    return rootFromCli(cli);
  }

  const answer = await promptText("Folder to index", ".");
  const root = resolveUserPath(answer);
  await assertIndexableDirectory(root);
  return root;
}

function shouldPromptForRepositoryRoot(
  cli: ParsedCli,
  env: PromptEnvironment = {
    stdinIsTTY: process.stdin.isTTY,
    stdoutIsTTY: process.stdout.isTTY,
  },
): boolean {
  return (
    (cli.command === "build" || cli.command === "output" || cli.command === "compile") &&
    !cli.flags.has("remote") &&
    !cli.flags.has("root") &&
    cli.positional.length === 0 &&
    !flagBoolean(cli, "json") &&
    !flagBoolean(cli, "log-json") &&
    !flagBoolean(cli, "ci") &&
    !flagBoolean(cli, "yes") &&
    !flagBoolean(cli, "no-prompt") &&
    env.stdinIsTTY === true &&
    env.stdoutIsTTY === true
  );
}

async function promptText(label: string, fallback: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question(`${label} [${fallback}]: `);
    return answer.trim() || fallback;
  } finally {
    readline.close();
  }
}

function resolveUserPath(input: string): string {
  if (input === "~") {
    return homedir();
  }

  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return resolve(homedir(), input.slice(2));
  }

  return resolve(input);
}

async function assertIndexableDirectory(root: string): Promise<void> {
  try {
    const result = await stat(root);

    if (result.isDirectory()) {
      return;
    }

    throw new OntolyCliError({
      code: "ONTOLY5003",
      message: `Folder to index is not a directory: ${root}`,
      suggestion:
        "Choose a repository directory, pass it as `ontoly build <path>`, or run with `--no-prompt` to use the current directory.",
      docs: "docs/cli.md#interactive-folder-selection",
    });
  } catch (error) {
    if (error instanceof OntolyCliError) {
      throw error;
    }

    throw new OntolyCliError({
      code: "ONTOLY5003",
      message: `Folder to index does not exist: ${root}`,
      suggestion: "Choose an existing repository directory or pass it explicitly as `ontoly build <path>`.",
      docs: "docs/cli.md#interactive-folder-selection",
      cause: error,
    });
  }
}

function replaceCheckoutRoot(value: string, source: Extract<RepositorySource, { readonly kind: "remote" }>): string {
  const checkoutRoot = source.checkoutRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedValue = value.replace(/\\/g, "/");

  if (!normalizedValue.includes(checkoutRoot)) {
    return value;
  }

  return normalizedValue.split(checkoutRoot).join(source.remote.replace(/\/+$/, ""));
}

function sourceSummary(source: RepositorySource): JsonObject {
  if (source.kind === "local") {
    return { kind: "local" };
  }

  return {
    kind: "remote",
    remote: source.remote,
  };
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

async function loadSemanticIndexForCli(cli: ParsedCli, graph: SoftwareGraph): Promise<SemanticIndex> {
  const root = rootFromCli(cli, { positional: false });
  const outputDir = flagString(cli, "output", ".ontoly");
  try {
    const index = await loadOrCreateSemanticIndex({ root: resolve(root), directory: outputDir });
    return index.graphHash === graph.metadata.deterministicHash ? index : createSemanticIndex(graph);
  } catch {
    return createSemanticIndex(graph);
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

async function writeOutputBundle(input: {
  readonly sourceRoot: string;
  readonly outputRoot: string;
  readonly outputDir: string;
  readonly graph: SoftwareGraph;
  readonly cli: ParsedCli;
  readonly source: RepositorySource;
}): Promise<OntolyOutputBundle> {
  const semanticModel = flagBoolean(input.cli, "no-semantic")
    ? undefined
    : semanticModelForRepositorySource(analyzeTypeScriptProject({ root: input.sourceRoot }), input.source);
  return createOntolyOutputBundle({
    root: input.outputRoot,
    directory: input.outputDir,
    graph: input.graph,
    semanticModel,
    source: sourceSummary(input.source) as { readonly kind: "local" | "remote"; readonly remote?: string | undefined },
    includeHtml: !flagBoolean(input.cli, "no-html"),
    maxHtmlNodes: flagNumber(input.cli, "max-nodes", 2500),
    maxHtmlEdges: flagNumber(input.cli, "max-edges", 5000),
  });
}

function defaultCompilerPasses() {
  return [createRepositoryIntelligencePass(), createTypeScriptFrontendPass(), createOpenApiFrontendPass()];
}

function defaultCliEnhancers(): readonly Enhancer[] {
  return [
    defineEnhancer({
      id: "semantic-index",
      name: "Semantic Index",
      description: "Generate the deterministic Semantic Index artifact from the Software Graph.",
      version: "1.0.0",
      produces: [ARTIFACT_DESCRIPTORS.SemanticIndex],
      supportsIncremental: true,
      run: (context) => {
        const graphArtifact = context.artifacts.require("SoftwareGraph");
        const semanticIndex = createSemanticIndex(context.graph);
        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.SemanticIndex,
              data: semanticIndex as unknown as JsonValue,
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "semantic-index",
              enhancerVersion: "1.0.0",
              dependencies: [graphArtifact],
            }),
          ],
          statistics: {
            entries: semanticIndex.entries.length,
            aliases: semanticIndex.metadata.statistics.aliases,
            vocabulary: semanticIndex.vocabulary.length,
          },
        };
      },
    }),
    defineEnhancer({
      id: "capability-catalog",
      name: "Capability Catalog",
      description: "Expose the current deterministic capability catalog as an artifact.",
      version: "1.0.0",
      requires: [artifactRequirement("SoftwareGraph"), artifactRequirement("SemanticIndex", { optional: true })],
      produces: [ARTIFACT_DESCRIPTORS.CapabilityCatalog],
      supportsIncremental: true,
      run: (context) => {
        const graphArtifact = context.artifacts.require("SoftwareGraph");
        const engine = createCapabilityEngine(context.graph);
        const capabilities = engine.registry.capabilities().map((capability) => ({
          name: capability.name,
          version: capability.version,
          description: capability.description,
          inputSchema: capability.inputSchema,
        }));
        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.CapabilityCatalog,
              data: {
                repository: context.graph.repository.name,
                graphHash: context.graph.metadata.deterministicHash,
                capabilities,
              },
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "capability-catalog",
              enhancerVersion: "1.0.0",
              dependencies: [
                graphArtifact,
                ...optionalArtifact(context.artifacts.get("SemanticIndex")),
              ],
            }),
          ],
          statistics: { capabilities: capabilities.length },
        };
      },
    }),
    defineEnhancer({
      id: "validation-report",
      name: "Validation Report",
      description: "Generate graph-native validation and semantic coverage artifacts.",
      version: "1.0.0",
      produces: [ARTIFACT_DESCRIPTORS.ValidationReport, ARTIFACT_DESCRIPTORS.Coverage],
      supportsIncremental: true,
      run: (context) => {
        const graphArtifact = context.artifacts.require("SoftwareGraph");
        const coverage = analyzeSemanticCoverage(context.graph);
        const errors = context.graph.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
        const warnings = context.graph.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
        const validation = {
          repository: context.graph.repository.name,
          graphHash: context.graph.metadata.deterministicHash,
          status: errors > 0 ? "FAIL" : "PASS",
          diagnostics: context.graph.diagnostics,
          diagnosticCounts: {
            errors,
            warnings,
            info: context.graph.diagnostics.filter((diagnostic) => diagnostic.severity === "info").length,
          },
          coverage: coverage.summary,
          relationshipDistribution: coverage.relationshipDistribution,
        };

        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.ValidationReport,
              data: validation as unknown as JsonValue,
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "validation-report",
              enhancerVersion: "1.0.0",
              dependencies: [graphArtifact],
            }),
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.Coverage,
              data: coverage as unknown as JsonValue,
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "validation-report",
              enhancerVersion: "1.0.0",
              dependencies: [graphArtifact],
            }),
          ],
          statistics: {
            diagnostics: context.graph.diagnostics.length,
            errors,
            warnings,
            trust: coverage.summary.trustworthiness,
          },
        };
      },
    }),
    capabilityArtifactEnhancer({
      id: "repository-summary",
      name: "Repository Summary",
      description: "Generate a repository-wide deterministic summary artifact.",
      capability: "RepositorySummary",
      descriptor: ARTIFACT_DESCRIPTORS.RepositorySummary,
    }),
    capabilityArtifactEnhancer({
      id: "health-report",
      name: "Health Report",
      description: "Generate a repository health artifact from graph diagnostics and topology.",
      capability: "RepositoryHealth",
      descriptor: ARTIFACT_DESCRIPTORS.HealthReport,
    }),
    capabilityArtifactEnhancer({
      id: "risk-report",
      name: "Risk Report",
      description: "Generate a repository risk artifact from graph evidence.",
      capability: "RiskAnalysis",
      descriptor: ARTIFACT_DESCRIPTORS.RiskReport,
    }),
    capabilityArtifactEnhancer({
      id: "dead-code-report",
      name: "Dead Code Report",
      description: "Generate a potential dead-code artifact from graph usage evidence.",
      capability: "DeadCode",
      descriptor: ARTIFACT_DESCRIPTORS.DeadCodeReport,
    }),
    defineEnhancer({
      id: "architecture-report",
      name: "Architecture Report",
      description: "Generate the existing architecture report as a versioned enhancer artifact.",
      version: "1.0.0",
      produces: [ARTIFACT_DESCRIPTORS.ArchitectureReport],
      supportsIncremental: true,
      run: (context) => {
        const query = createQueryEngine(context.graph);
        const report = createReport(query, "architecture");
        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.ArchitectureReport,
              data: report as JsonValue,
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "architecture-report",
              enhancerVersion: "1.0.0",
              dependencies: [context.artifacts.require("SoftwareGraph")],
            }),
          ],
          statistics: {
            packages: Array.isArray(report.packages) ? report.packages.length : 0,
            services: Array.isArray(report.services) ? report.services.length : 0,
            routes: Array.isArray(report.routes) ? report.routes.length : 0,
          },
        };
      },
    }),
    defineEnhancer({
      id: "markdown-docs",
      name: "Markdown Docs",
      description: "Render the architecture report as deterministic Markdown documentation.",
      version: "1.0.0",
      requires: [artifactRequirement("SoftwareGraph"), artifactRequirement("ArchitectureReport")],
      produces: [ARTIFACT_DESCRIPTORS.MarkdownDocs],
      supportsIncremental: true,
      run: (context) => {
        const architecture = context.artifacts.require("ArchitectureReport");
        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.MarkdownDocs,
              data: formatReport(architecture.data as JsonObject),
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "markdown-docs",
              enhancerVersion: "1.0.0",
              dependencies: [context.artifacts.require("SoftwareGraph"), architecture],
            }),
          ],
          statistics: { bytes: formatReport(architecture.data as JsonObject).length },
        };
      },
    }),
    defineEnhancer({
      id: "mermaid-diagram",
      name: "Mermaid Diagram",
      description: "Render the architecture graph as Mermaid.",
      version: "1.0.0",
      requires: [artifactRequirement("SoftwareGraph"), artifactRequirement("ArchitectureReport", { optional: true })],
      produces: [ARTIFACT_DESCRIPTORS.MermaidDiagram],
      supportsIncremental: true,
      run: (context) => {
        const mermaid = architectureMermaid(createQueryEngine(context.graph));
        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.MermaidDiagram,
              data: mermaid,
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "mermaid-diagram",
              enhancerVersion: "1.0.0",
              dependencies: [
                context.artifacts.require("SoftwareGraph"),
                ...optionalArtifact(context.artifacts.get("ArchitectureReport")),
              ],
            }),
          ],
          statistics: { bytes: mermaid.length },
        };
      },
    }),
    defineEnhancer({
      id: "html-graph",
      name: "HTML Graph",
      description: "Render the interactive Software Graph Explorer HTML artifact.",
      version: "1.0.0",
      produces: [ARTIFACT_DESCRIPTORS.HtmlGraph],
      supportsIncremental: true,
      run: (context) => {
        const html = createInteractiveHtmlGraph(context.graph, {
          title: `${context.graph.repository.name} Software Graph Explorer`,
        });
        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.HtmlGraph,
              data: html,
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "html-graph",
              enhancerVersion: "1.0.0",
              dependencies: [context.artifacts.require("SoftwareGraph")],
            }),
          ],
          statistics: { bytes: html.length },
        };
      },
    }),
    defineEnhancer({
      id: "evaluation-summary",
      name: "Evaluation Summary",
      description: "Summarize validation and coverage artifacts for release evaluation gates.",
      version: "1.0.0",
      requires: [
        artifactRequirement("SoftwareGraph"),
        artifactRequirement("ValidationReport"),
        artifactRequirement("Coverage"),
      ],
      produces: [ARTIFACT_DESCRIPTORS.Evaluation],
      supportsIncremental: true,
      run: (context) => {
        const validation = context.artifacts.require("ValidationReport");
        const coverage = context.artifacts.require("Coverage");
        const validationData = validation.data as JsonObject;
        const coverageData = coverage.data as JsonObject;
        const summary = {
          repository: context.graph.repository.name,
          graphHash: context.graph.metadata.deterministicHash,
          validationStatus: validationData.status ?? "UNKNOWN",
          coverageSummary: coverageData.summary ?? {},
          deterministic: true,
        };
        return {
          artifacts: [
            createArtifact({
              descriptor: ARTIFACT_DESCRIPTORS.Evaluation,
              data: summary,
              graphHash: context.graph.metadata.deterministicHash,
              graphGeneratedAt: context.graph.metadata.generatedAt,
              producedBy: "evaluation-summary",
              enhancerVersion: "1.0.0",
              dependencies: [context.artifacts.require("SoftwareGraph"), validation, coverage],
            }),
          ],
          statistics: { status: String(summary.validationStatus) },
        };
      },
    }),
  ];
}

function capabilityArtifactEnhancer(input: {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly capability: CapabilityName;
  readonly descriptor: (typeof ARTIFACT_DESCRIPTORS)[keyof typeof ARTIFACT_DESCRIPTORS];
}): Enhancer {
  return defineEnhancer({
    id: input.id,
    name: input.name,
    description: input.description,
    version: "1.0.0",
    requires: [artifactRequirement("SoftwareGraph"), artifactRequirement("SemanticIndex", { optional: true })],
    produces: [input.descriptor],
    supportsIncremental: true,
    run: (context) => {
      const result = capabilityResultToJson(createCapabilityEngine(context.graph).execute(input.capability, {}));
      return {
        artifacts: [
          createArtifact({
            descriptor: input.descriptor,
            data: result,
            graphHash: context.graph.metadata.deterministicHash,
            graphGeneratedAt: context.graph.metadata.generatedAt,
            producedBy: input.id,
            enhancerVersion: "1.0.0",
            dependencies: [
              context.artifacts.require("SoftwareGraph"),
              ...optionalArtifact(context.artifacts.get("SemanticIndex")),
            ],
          }),
        ],
        statistics: capabilityArtifactStatistics(result),
      };
    },
  });
}

async function maybeLoadGraphForEnhancerValidation(cli: ParsedCli): Promise<SoftwareGraph | undefined> {
  if (!cli.flags.has("root") && cli.positional.length <= 1 && !flagBoolean(cli, "with-graph")) {
    return undefined;
  }
  const root = enhancerRootFromCli(cli, 1);
  return loadOrBuildGraph({ ...cli, positional: [root] });
}

async function loadSemanticIndexForGraph(cli: ParsedCli, graph: SoftwareGraph): Promise<SemanticIndex> {
  try {
    return await loadSemanticIndexForCli(cli, graph);
  } catch {
    return createSemanticIndex(graph);
  }
}

function enhancerRootFromCli(cli: ParsedCli, positionalIndex: number): string {
  const explicit = flagString(cli, "root", "");
  if (explicit) {
    return explicit;
  }
  return cli.positional[positionalIndex] ?? ".";
}

function enhancerManifestById(
  enhancers: readonly Enhancer[],
  manifests: readonly EnhancerManifest[],
  id: string,
): EnhancerManifest | undefined {
  return enhancers.find((enhancer) => enhancer.id === id)?.manifest()
    ?? manifests.find((manifest) => manifest.id === id);
}

function selectEnhancersForRun(enhancers: readonly Enhancer[], target: string): readonly Enhancer[] {
  const sorted = [...enhancers].sort((left, right) => left.id.localeCompare(right.id));
  if (target === "all") {
    return sorted;
  }

  const byId = new Map(sorted.map((enhancer) => [enhancer.id, enhancer] as const));
  const byArtifact = new Map<string, Enhancer>();
  for (const enhancer of sorted) {
    for (const artifact of enhancer.produces) {
      byArtifact.set(artifact.id, enhancer);
    }
  }

  const root = byId.get(target) ?? byArtifact.get(target);
  if (!root) {
    throw new OntolyCliError({
      code: "ONTOLY5004",
      message: `Enhancer not found: ${target}`,
      suggestion: "Run ontoly enhancer list and use an enhancer id or produced artifact id.",
      docs: "docs/enhancers.md#cli",
    });
  }

  const selected = new Map<string, Enhancer>();
  const visit = (enhancer: Enhancer): void => {
    if (selected.has(enhancer.id)) {
      return;
    }
    for (const dependency of enhancer.dependencies()) {
      const dependencyEnhancer = byId.get(dependency) ?? byArtifact.get(dependency);
      if (dependencyEnhancer) {
        visit(dependencyEnhancer);
      }
    }
    for (const requirement of enhancer.requires) {
      const producer = byArtifact.get(requirement.artifact);
      if (producer) {
        visit(producer);
      }
    }
    selected.set(enhancer.id, enhancer);
  };

  visit(root);
  return [...selected.values()].sort((left, right) => left.id.localeCompare(right.id));
}

async function createFileEnhancerCache(root: string, outputDir: string): Promise<EnhancerCache> {
  const cachePath = join(root, outputDir, "enhancers", "cache.json");
  let entries: Record<string, EnhancerRunResult> = {};
  try {
    entries = JSON.parse(await readFile(cachePath, "utf8")) as Record<string, EnhancerRunResult>;
  } catch {
    entries = {};
  }
  const memory = createMemoryEnhancerCache(entries);

  return {
    get: (key) => memory.get(key),
    has: (key) => memory.has(key),
    set: async (key, value) => {
      await memory.set(key, value);
      entries[key] = value;
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    },
  };
}

async function writeEnhancerArtifacts(
  root: string,
  outputDir: string,
  result: EnhancerPipelineResult,
): Promise<string> {
  const directory = join(root, outputDir, "enhancers");
  const artifactDirectory = join(directory, "artifacts");
  await mkdir(artifactDirectory, { recursive: true });

  for (const artifact of result.artifacts) {
    const path = join(artifactDirectory, artifactFileName(artifact));
    await writeFile(path, artifactContents(artifact), "utf8");
  }

  const summary = enhancerPipelineResultToJson(result);
  const summaryPath = join(directory, "summary.json");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summaryPath;
}

function enhancerPipelineResultToJson(result: EnhancerPipelineResult): JsonObject {
  return {
    graphHash: result.graphHash,
    deterministicHash: result.deterministicHash,
    statistics: result.statistics,
    executions: result.executions.map((execution) => ({
      enhancerId: execution.enhancerId,
      status: execution.status,
      cacheKey: execution.cacheKey,
      artifacts: execution.artifacts.map((artifact) => artifact.descriptor.id),
      durationMs: execution.durationMs,
      statistics: execution.statistics,
    })) as unknown as JsonValue,
    artifacts: result.artifacts.map((artifact) => ({
      id: artifact.descriptor.id,
      kind: artifact.descriptor.kind,
      version: artifact.descriptor.version,
      hash: artifact.hash,
      graphHash: artifact.graphHash,
      dependencies: artifact.dependencies,
      mediaType: artifact.descriptor.schema.mediaType,
      producedBy: artifact.provenance.producedBy,
    })) as unknown as JsonValue,
    diagnostics: result.diagnostics as unknown as JsonValue,
  };
}

function capabilityArtifactStatistics(value: JsonValue): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const object = value as JsonObject;
  const evidence = Array.isArray(object.evidence) ? object.evidence.length : 0;
  const recommendations = Array.isArray(object.recommendations) ? object.recommendations.length : 0;
  const diagnostics = Array.isArray(object.diagnostics) ? object.diagnostics.length : 0;
  return {
    evidence,
    recommendations,
    diagnostics,
  };
}

function enhancerLoggerFromCli() {
  return {
    info: (message: string) => logger.debug(message),
    warning: (message: string) => logger.warning(message),
    error: (message: string) => logger.error(message),
    debug: (message: string) => logger.debug(message),
  };
}

function artifactFileName(artifact: OntolyArtifact): string {
  const base = kebabCaseCli(artifact.descriptor.id);
  switch (artifact.descriptor.schema.mediaType) {
    case "text/markdown":
      return `${base}.md`;
    case "text/vnd.mermaid":
      return `${base}.mmd`;
    case "text/html":
      return `${base}.html`;
    default:
      return `${base}.json`;
  }
}

function artifactContents(artifact: OntolyArtifact): string {
  if (typeof artifact.data === "string") {
    return artifact.data.endsWith("\n") ? artifact.data : `${artifact.data}\n`;
  }
  return `${JSON.stringify(artifact.data, null, 2)}\n`;
}

function optionalArtifact<T extends JsonValue>(artifact: OntolyArtifact<T> | undefined): readonly OntolyArtifact<T>[] {
  return artifact ? [artifact] : [];
}

function compareEnhancerIssuesForCli(left: EnhancerValidationIssue, right: EnhancerValidationIssue): number {
  return `${left.severity}:${left.code}:${left.enhancerId ?? ""}:${left.artifactId ?? ""}:${left.message}`
    .localeCompare(`${right.severity}:${right.code}:${right.enhancerId ?? ""}:${right.artifactId ?? ""}:${right.message}`);
}

function kebabCaseCli(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
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
      return createImpactReport(query, node, depth);
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

function createImpactReport(
  query: ReturnType<typeof createQueryEngine>,
  node: SoftwareGraphNode,
  depth: number,
): JsonObject {
  const dependents = query.dependents(node.id, depth);
  const dependencies = query.dependencies(node.id, Math.max(1, Math.min(depth, 2)));
  const impactedNodes = uniqueNodes([...dependents.nodes, ...dependencies.nodes]);
  const evidenceEdges = uniqueEdges([...dependents.edges, ...dependencies.edges]);

  return {
    node: serializeNodeWithMetadata(node),
    traversal: serializeTraversal(dependents),
    dependents: serializeTraversal(dependents),
    dependencies: serializeTraversal(dependencies),
    affected: {
      routes: serializeNodesByType(impactedNodes, ["Route"]),
      controllers: serializeNodesByType(impactedNodes, ["Controller"]),
      services: serializeNodesByType(impactedNodes, ["Service"]),
      modules: serializeNodesByType(impactedNodes, ["Module"]),
      repositories: serializeNodesByType(impactedNodes, ["Repository"]),
      configuration: serializeNodesByType(impactedNodes, ["Configuration", "EnvironmentVariable"]),
      permissions: serializeNodesByType(impactedNodes, ["Permission"]),
      resources: serializeNodesByType(impactedNodes, ["Resource", "Model", "DatabaseTable"]),
      externalBoundaries: impactedNodes
        .filter(isExternalBoundaryNode)
        .sort(compareNodesById)
        .map(serializeNodeWithMetadata),
    },
    evidence: evidenceEdges.map(serializeEdge),
  };
}

function serializeNodesByType(
  nodes: readonly SoftwareGraphNode[],
  types: readonly SoftwareGraphNode["type"][],
): JsonObject[] {
  const typeSet = new Set(types);
  return nodes.filter((node) => typeSet.has(node.type)).sort(compareNodesById).map(serializeNodeWithMetadata);
}

function isExternalBoundaryNode(node: SoftwareGraphNode): boolean {
  return (
    node.metadata?.external === true ||
    node.type === "Package" ||
    node.type === "Dependency" ||
    node.type === "Framework" ||
    node.type === "Resource" ||
    node.type === "DatabaseTable" ||
    node.type === "EnvironmentVariable" ||
    node.type === "Configuration"
  );
}

function uniqueNodes(nodes: readonly SoftwareGraphNode[]): readonly SoftwareGraphNode[] {
  return [...new Map(nodes.map((node) => [node.id, node] as const)).values()].sort(compareNodesById);
}

function uniqueEdges(edges: readonly SoftwareGraphEdge[]): readonly SoftwareGraphEdge[] {
  return [...new Map(edges.map((edge) => [edge.id, edge] as const)).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
}

function compareNodesById(left: SoftwareGraphNode, right: SoftwareGraphNode): number {
  return left.id.localeCompare(right.id);
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

function serializeNodeWithMetadata(node: SoftwareGraphNode): JsonObject {
  return {
    ...serializeNode(node),
    metadata: node.metadata,
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

function executeSearch(
  index: SemanticIndex,
  query: string,
  category: SearchCategory,
  limit: number,
  command: string,
): SemanticSearchResult {
  const options = { limit, category };

  switch (category) {
    case "symbol":
      return findSymbol(index, query, options);
    case "feature":
      return findFeature(index, query, options);
    case "configuration":
      return searchConfiguration(index, query, options);
    case "environment":
      return findEnvironment(index, query, options);
    case "route":
      return searchRoute(index, query, options);
    case "entrypoint":
      return findEntryPoint(index, query, options);
    case "repository":
      return findRepositoryConcept(index, query, options);
    case "concept":
      return command === "locate" ? findFeature(index, query, { ...options, category: "feature" }) : findConcept(index, query, options);
  }
}

function searchCategoryFromCli(cli: ParsedCli): SearchCategory {
  const value = flagString(cli, "category", "");
  if (!value) {
    if (cli.command === "locate") {
      return "feature";
    }
    return "concept";
  }

  if (isSearchCategory(value)) {
    return value;
  }

  throw new OntolyCliError({
    code: "ONTOLY1011",
    message: `Unknown search category: ${value}`,
    suggestion: "Use one of: concept, symbol, feature, configuration, environment, route, entrypoint, repository.",
    docs: "docs/cli.md#search",
  });
}

function isSearchCategory(value: string): value is SearchCategory {
  return ["concept", "symbol", "feature", "configuration", "environment", "route", "entrypoint", "repository"].includes(value);
}

function searchResultToJson(result: SemanticSearchResult): JsonObject {
  return {
    query: result.query,
    category: result.category,
    confidence: result.confidence,
    recommendedCapability: result.recommendedCapability,
    latencyMs: result.latencyMs,
    matchedConcepts: [...result.matchedConcepts],
    intent: {
      normalized: result.intent.normalized,
      tokens: [...result.intent.tokens],
      expandedTerms: [...result.intent.expandedTerms],
    },
    candidates: result.candidates.map(candidateToJson),
    evidence: [...result.evidence],
  };
}

function candidateToJson(candidate: SemanticCandidate): JsonObject {
  return {
    id: candidate.nodeId,
    type: candidate.kind,
    name: candidate.displayName,
    score: candidate.score,
    confidence: candidate.confidence,
    matchedTerms: [...candidate.matchedTerms],
    file: candidate.entry.filePath,
    package: candidate.entry.package,
    aliases: candidate.entry.aliases.slice(0, 12),
    reasons: candidate.reasons.map((reason) => ({
      factor: reason.factor,
      score: reason.score,
      evidence: reason.evidence,
    })),
  };
}

function formatSearchResult(result: SemanticSearchResult): string {
  const top = result.candidates[0];
  const lines = [
    "# Semantic Search",
    "",
    `Query: ${result.query}`,
    `Category: ${result.category}`,
    `Summary: ${top ? `${top.displayName} (${top.kind}) is the top ranked candidate.` : "No graph candidates matched."}`,
    `Confidence: ${result.confidence.toFixed(2)}`,
    `Recommended Capability: ${result.recommendedCapability}`,
    `Latency: ${result.latencyMs.toFixed(3)}ms`,
    "",
    "## Matched Concepts",
    result.matchedConcepts.length > 0 ? result.matchedConcepts.slice(0, 20).join(", ") : "none",
    "",
    "## Candidate Symbols",
  ];

  if (result.candidates.length === 0) {
    lines.push("none");
  } else {
    for (const candidate of result.candidates.slice(0, 10)) {
      const file = candidate.entry.filePath ? ` ${candidate.entry.filePath}` : "";
      lines.push(`- ${candidate.displayName} (${candidate.kind})`);
      lines.push(`  id: ${candidate.nodeId}`);
      lines.push(`  score: ${candidate.score.toFixed(2)} confidence: ${candidate.confidence.toFixed(2)}${file}`);
      const reasons = candidate.reasons.slice(0, 3).map((reason) => `${reason.factor} +${reason.score}`).join(", ");
      lines.push(`  evidence: ${reasons || "graph index match"}`);
    }
  }

  lines.push("", "## Evidence");
  lines.push(...(result.evidence.length > 0 ? result.evidence.map((item) => `- ${item}`) : ["none"]));
  return lines.join("\n");
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

function formatCapabilityResult(capability: CapabilityName, result: CapabilityResult): string {
  const graph = result.graph as JsonObject;
  const lines = [
    `# ${titleCase(capability)}`,
    "",
    result.summary,
    "",
    `Confidence: ${result.confidence.level} (${result.confidence.score.toFixed(2)})`,
    `Evidence: ${result.evidence.length}`,
    `Diagnostics: ${result.diagnostics.length}`,
    `Graph hash: ${String(graph.graphHash ?? "unknown")}`,
  ];

  const groups = Object.entries(result.affectedNodes)
    .filter(([, nodes]) => nodes.length > 0)
    .sort(([left], [right]) => left.localeCompare(right));

  if (groups.length > 0) {
    lines.push("", "## Affected Graph");
    for (const [group, nodes] of groups) {
      lines.push(`- ${group}: ${formatSerializedNodeList(nodes)}`);
    }
  }

  if (result.diagnostics.length > 0) {
    lines.push("", "## Diagnostics");
    for (const diagnostic of result.diagnostics) {
      lines.push(`- ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
    }
  }

  if (result.recommendations.length > 0) {
    lines.push("", "## Recommendations");
    for (const recommendation of result.recommendations) {
      lines.push(`- ${recommendation}`);
    }
  }

  return lines.join("\n");
}

function formatSerializedNodeList(nodes: readonly SerializedNode[]): string {
  if (nodes.length === 0) {
    return "none";
  }

  const shown = nodes.slice(0, 8).map((node) => node.name || node.id);
  const remaining = nodes.length - shown.length;
  return `${shown.join(", ")}${remaining > 0 ? `, +${remaining} more` : ""}`;
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
    usage: ["ontoly build [root] [--root path] [--remote git_repo] [--output ontoly-output] [--bundle] [--json]"],
    options: [
      "--remote git_repo   Clone and build a remote git repository.",
      "--output path        Artifact directory. Default: ontoly-output.",
      "--bundle             Also write a rich ontoly-output bundle when using another --output path.",
      "--bundle-output path Rich output directory. Default: ontoly-output.",
      "--no-html            Skip HTML files in the rich output bundle.",
      "--no-prompt          Use the current directory when no root is provided.",
      "--yes                Accept prompt defaults for automation.",
      "--json               Print a machine-readable summary.",
      "--debug              Print debug logs.",
    ],
    examples: [
      "ontoly build .",
      "ontoly build --remote https://github.com/0xsarwagya/ontoly.git",
      "ontoly build examples/basic --output .ontoly",
      "ontoly build . --output .ontoly --bundle",
      "ontoly build . --json",
    ],
  },
  output: {
    title: "ontoly output",
    description: "Compile a repository into a rich ontoly-output folder with JSON reports, communities, and HTML explorers.",
    usage: ["ontoly output [root] [--remote git_repo] [--output ontoly-output] [--json]"],
    options: [
      "--remote git_repo Clone and compile a remote git repository.",
      "--output path   Output bundle directory. Default: ontoly-output.",
      "--no-html       Skip html/graph.html and html/architecture.html.",
      "--no-semantic   Skip semantic-model.json.",
      "--max-nodes n   Maximum nodes for HTML graph output. Default: 2500.",
      "--max-edges n   Maximum edges for HTML graph output. Default: 5000.",
      "--no-prompt     Use the current directory when no root is provided.",
      "--yes           Accept prompt defaults for automation.",
      "--json          Print JSON summary.",
    ],
    examples: [
      "ontoly output .",
      "ontoly output --remote https://github.com/0xsarwagya/ontoly.git",
      "ontoly output examples/basic",
      "ontoly output . --output ontoly-output --json",
    ],
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
	  explain: {
	    title: "ontoly explain",
	    description: "Explain repository architecture or feature touchpoints using the Semantic Capability Engine.",
	    usage: ["ontoly explain [query] [--root path] [--depth 3] [--json]"],
	    options: ["--root path    Repository root.", "--depth n      Expansion depth.", "--json         Print JSON."],
	    examples: ["ontoly explain", "ontoly explain AuthService", "ontoly explain \"login threshold\" --json"],
	  },
	  impact: {
	    title: "ontoly impact",
	    description: "Analyze deterministic blast radius for a node id or search query.",
	    usage: ["ontoly impact <node-id-or-query> [--root path] [--depth 4] [--json]"],
	    options: ["--root path    Repository root.", "--depth n      Expansion depth.", "--json         Print JSON."],
	    examples: ["ontoly impact AuthService", "ontoly impact fn:src/auth.ts:login --depth 5", "ontoly impact UserRepository --json"],
	  },
	  "implementation-plan": {
	    title: "ontoly implementation-plan",
	    description: "Generate a graph-backed implementation plan for a task without AI reasoning.",
	    usage: ["ontoly implementation-plan <task> [--root path] [--depth 3] [--json]"],
	    options: ["--root path    Repository root.", "--depth n      Expansion depth.", "--json         Print JSON."],
	    examples: ["ontoly implementation-plan \"add login threshold\"", "ontoly implementation-plan \"remove PlanDefinition\" --json"],
	  },
	  ownership: {
	    title: "ontoly ownership",
	    description: "Find likely owners for a feature or graph node.",
	    usage: ["ontoly ownership <query> [--root path] [--depth 3] [--json]"],
	    options: ["--root path    Repository root.", "--depth n      Expansion depth.", "--json         Print JSON."],
	    examples: ["ontoly ownership auth", "ontoly ownership PlanDefinition --json"],
	  },
	  health: {
	    title: "ontoly health",
	    description: "Summarize repository health from diagnostics, cycles, and orphan graph regions.",
	    usage: ["ontoly health [root] [--json]"],
	    options: ["--json         Print JSON."],
	    examples: ["ontoly health", "ontoly health examples/basic --json"],
	  },
	  "repository-summary": {
	    title: "ontoly repository-summary",
	    description: "Print a deterministic repository summary from Software Graph statistics.",
	    usage: ["ontoly repository-summary [root] [--json]"],
	    options: ["--json         Print JSON."],
	    examples: ["ontoly repository-summary", "ontoly repository-summary examples/basic --json"],
	  },
	  risk: {
	    title: "ontoly risk",
	    description: "Identify structural risk around a repository or target node.",
	    usage: ["ontoly risk [query] [--root path] [--depth 4] [--json]"],
	    options: ["--root path    Repository root.", "--depth n      Expansion depth.", "--json         Print JSON."],
	    examples: ["ontoly risk", "ontoly risk AuthService", "ontoly risk PlanDefinition --json"],
	  },
	  "request-trace": {
	    title: "ontoly request-trace",
	    description: "Trace a route through handler and call relationships.",
	    usage: ["ontoly request-trace <route> [--root path] [--depth 5] [--json]"],
	    options: ["--root path    Repository root.", "--depth n      Expansion depth.", "--json         Print JSON."],
	    examples: ["ontoly request-trace \"POST /login\"", "ontoly request-trace route:POST:/login --json"],
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
  search: {
    title: "ontoly search",
    description: "Resolve natural software concepts to ranked Software Graph candidates through the Semantic Index.",
    usage: ["ontoly search <concept> [--category concept|symbol|feature|configuration|environment|route|entrypoint|repository] [--limit 10] [--json]"],
    options: [
      "--category kind Search category. Default: concept.",
      "--limit n       Candidate limit. Default: 10.",
      "--root path     Repository root.",
      "--output path   Artifact directory. Default: .ontoly.",
      "--json          Print JSON.",
    ],
    examples: [
      "ontoly search authentication",
      "ontoly search \"sleep thresholds\"",
      "ontoly search \"JWT secret\" --category configuration --json",
    ],
  },
  find: {
    title: "ontoly find",
    description: "Find a symbol, acronym, feature term, configuration name, or repository concept using intent resolution.",
    usage: ["ontoly find <concept> [--category kind] [--limit 10] [--json]"],
    options: ["--category kind Search category.", "--limit n       Candidate limit.", "--json          Print JSON."],
    examples: ["ontoly find JWT", "ontoly find PlanDefinition", "ontoly find AuthService --category symbol"],
  },
  locate: {
    title: "ontoly locate",
    description: "Locate feature-level graph touchpoints such as routes, controllers, services, modules, and operations.",
    usage: ["ontoly locate <feature> [--category kind] [--limit 10] [--json]"],
    options: ["--category kind Search category. Default: feature.", "--limit n       Candidate limit.", "--json          Print JSON."],
    examples: ["ontoly locate notifications", "ontoly locate \"patient averages\" --json"],
  },
  query: {
    title: "ontoly query",
    description: "Run deterministic query-engine operations against the graph.",
    usage: ["ontoly query <find|callers|callees|dependencies|dependents|related|impact|routes|frameworks|configuration|cycles> [target] [--json]"],
    options: ["--depth n      Traversal depth for dependency operations.", "--json         Print JSON."],
    examples: [
      "ontoly query find AuthService",
      "ontoly query impact \"Plan Definition Resource\" --json",
      "ontoly query callers UserService.load",
      "ontoly query routes --json",
    ],
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
  enhancer: {
    title: "ontoly enhancer",
    description: "List, inspect, run, validate, and visualize deterministic graph artifact enhancers.",
    usage: [
      "ontoly enhancer list [--json]",
      "ontoly enhancer inspect <id>",
      "ontoly enhancer run <id|artifact|all> [root] [--json] [--no-cache] [--no-parallel]",
      "ontoly enhancer graph [--format mermaid|dot|json]",
      "ontoly enhancer doctor [root] [--json] [--ci]",
      "ontoly enhancer validate [root] [--json] [--ci]",
    ],
    options: [
      "--format kind   mermaid, dot, or json for enhancer graph.",
      "--output path   Artifact directory. Default: .ontoly.",
      "--no-cache      Disable incremental cache reads for run.",
      "--no-parallel   Execute compatible enhancers serially.",
      "--json          Print JSON.",
      "--ci            Fail validation on errors.",
    ],
    examples: [
      "ontoly enhancer list",
      "ontoly enhancer inspect semantic-index",
      "ontoly enhancer run semantic-index .",
      "ontoly enhancer run MarkdownDocs .",
      "ontoly enhancer graph --format mermaid",
      "ontoly enhancer validate --ci",
    ],
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
  ontoly build [root] [--root path] [--remote git_repo] [--output ontoly-output] [--bundle]
  ontoly output [root] [--root path] [--remote git_repo] [--output ontoly-output]
  ontoly analyze [root] [--root path] [--output .ontoly] [--json]
  ontoly semantic [root] [--root path] [--format summary|json]
  ontoly frameworks [root] [--root path] [--json]
  ontoly watch [root] [--root path]
  ontoly inspect [file-or-node] [--root path] [--json]
  ontoly trace <node-id-or-name> [--depth 3] [--format mermaid] [--json]
	  ontoly stats [root] [--root path] [--json]
	  ontoly architecture [root] [--root path] [--format mermaid|html] [--json]
	  ontoly explain [query] [--root path] [--depth 3] [--json]
	  ontoly impact <node-id-or-query> [--root path] [--depth 4] [--json]
	  ontoly implementation-plan <task> [--root path] [--depth 3] [--json]
	  ontoly ownership <query> [--root path] [--depth 3] [--json]
	  ontoly health [root] [--json]
	  ontoly repository-summary [root] [--json]
	  ontoly risk [query] [--root path] [--depth 4] [--json]
	  ontoly request-trace <route> [--root path] [--depth 5] [--json]
  ontoly coverage [root] [--root path] [--format human|markdown|json] [--json]
  ontoly report [summary|api|dependencies|configuration|framework|frameworks|controllers|routes|modules|providers|workspace] [--root path] [--format markdown|json|mermaid]
  ontoly search <concept> [--category kind] [--limit 10] [--json]
  ontoly find <concept> [--category kind] [--limit 10] [--json]
  ontoly locate <feature> [--category kind] [--limit 10] [--json]
  ontoly graph [root] [--root path] [--format summary|json|mermaid|dot|graphml|html]
  ontoly query <find|callers|callees|dependencies|dependents|related|impact|routes|frameworks|configuration|cycles> [target] [--json]
  ontoly doctor [root] [--root path] [--json]
  ontoly export [path]
  ontoly mcp [--list]
  ontoly skills <list|validate|doctor> [--json] [--ci]
  ontoly enhancer <list|inspect|run|graph|doctor|validate> [--json]
  ontoly validate [all|repository|framework] [--json] [--ci] [--clone] [--install]
  ontoly evaluate [repository] [--json] [--ci] [--refresh]
  ontoly leaderboard [--json]
  ontoly diff <old.graph> <new.graph> [--json] [--output path]
  ontoly benchmark [root] [--runs 3]
  ontoly benchmark semantic [--json] [--refresh]
  ontoly benchmark performance [--json]

Examples:
  ontoly build .
  ontoly build --remote https://github.com/0xsarwagya/ontoly.git
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
	  ontoly explain AuthService
	  ontoly impact UserRepository --json
	  ontoly implementation-plan "remove PlanDefinition support"
	  ontoly request-trace "POST /login"
	  ontoly coverage
  ontoly report api
  ontoly report routes
  ontoly report dependencies
  ontoly report configuration
  ontoly search authentication
  ontoly find JWT
  ontoly locate notifications
  ontoly query callers UserService.load
  ontoly skills list
  ontoly skills validate
  ontoly skills doctor
  ontoly enhancer list
  ontoly enhancer graph --format mermaid
  ontoly enhancer run semantic-index .
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
  shouldPromptForRepositoryRoot,
};
