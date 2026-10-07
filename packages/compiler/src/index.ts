import { watch, type FSWatcher } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  DEFAULT_BUILD_OUTPUT_DIRECTORY,
  findGraphArtifactDirectory,
  getGraphArtifactPaths,
  type GraphArtifactPaths,
  persistCompilerCache,
  persistGraph,
} from "@0xsarwagya/ontoly-cache";
import type { SoftwareGraph } from "@0xsarwagya/ontoly-core";
import { createCompilerContext, createCompilerInvocation, defineOntolyConfig } from "./context";
import { compilerDiagnostic } from "./diagnostics";
import { executeCompilerPipeline, createDefaultCompilerStages } from "./pipeline";
import { discoverRepository, pathExists } from "./repository";
import type {
  BuildSoftwareGraphOptions,
  BuildSoftwareGraphResult,
  DoctorCheck,
  OntolyConfig,
  WatchHandle,
  WatchSoftwareGraphOptions,
} from "./types";

export * from "./context";
export * from "./cache";
export * from "./diagnostics";
export * from "./execution";
export * from "./graph";
export * from "./memory";
export * from "./passes";
export * from "./pipeline";
export * from "./repository";
export * from "./repository-intelligence";
export * from "./types";
export * from "./validation";

export { defineOntolyConfig };

export async function initializeOntolyProject(rootInput = process.cwd()): Promise<{
  readonly root: string;
  readonly directory: string;
  readonly configPath: string;
}> {
  const root = resolve(rootInput);
  const directory = join(root, ".ontoly");
  const configPath = join(root, "ontoly.config.ts");

  await mkdir(directory, { recursive: true });

  if (!(await pathExists(configPath))) {
    await writeFile(configPath, defaultConfigContents(), "utf8");
  }

  return { root, directory, configPath };
}

export async function buildSoftwareGraph(
  options: BuildSoftwareGraphOptions = {},
): Promise<SoftwareGraph> {
  const result = await buildSoftwareGraphWithArtifacts(options);

  if (!result.graph) {
    throw new Error("Compiler pipeline did not produce a graph.");
  }

  return result.graph;
}

export async function buildSoftwareGraphWithArtifacts(
  options: BuildSoftwareGraphOptions = {},
): Promise<BuildSoftwareGraphResult> {
  const invocation = await createCompilerInvocation(options);
  const context = await createCompilerContext({
    invocation,
    passes: options.passes,
    validationHooks: options.validationHooks,
    onProgress: options.onProgress,
  });
  const stages = createDefaultCompilerStages();
  const { state, profile } = await executeCompilerPipeline(context, stages);
  const diagnostics = context.diagnostics.list();
  const graph = state.graph;
  const status = state.fatal || !graph ? "failed" : "success";

  if (!graph) {
    context.diagnostics.add(
      compilerDiagnostic({
        code: "PIPELINE_MISSING_GRAPH",
        severity: "error",
        message: "Compiler pipeline completed without producing a Software Graph.",
      }),
    );
  }

  return {
    status,
    mode: invocation.mode,
    graph,
    diagnostics: context.diagnostics.list(),
    discovery: state.discovery ?? (await discoverRepository(
      invocation.root,
      invocation.sourceProvider,
      context.config.exclude,
    )),
    artifacts: state.artifacts,
    stages: state.stageTrace,
    cache: state.cache ?? {
      compatible: false,
      hit: false,
      reason: "disabled",
      sourceFingerprint: "",
      invalidation: { added: [], modified: [], removed: [] },
      entries: new Map(),
    },
    profile,
    products: state.products,
  };
}

export async function writeGraphArtifacts(
  graph: SoftwareGraph,
  options: {
    readonly root: string;
    readonly directory?: string | undefined;
  },
): Promise<GraphArtifactPaths> {
  const artifacts = await persistGraph(graph, options);
  await persistCompilerCache(options, {
    pipeline: "skeleton",
    graphHash: graph.metadata.deterministicHash,
  });
  return artifacts;
}

export async function doctorRepository(rootInput = process.cwd()): Promise<readonly DoctorCheck[]> {
  const discovery = await discoverRepository(rootInput);
  const graphDirectory = await findGraphArtifactDirectory(discovery.root);
  const graphPaths = getGraphArtifactPaths({
    root: discovery.root,
    directory: graphDirectory ?? DEFAULT_BUILD_OUTPUT_DIRECTORY,
  });

  return [
    {
      name: "package.json",
      ok: Boolean(discovery.packageJsonPath),
      message: discovery.packageJsonPath ?? "No package.json found.",
    },
    {
      name: "source inventory",
      ok: discovery.files.length > 0,
      message: `${discovery.files.length} files discovered.`,
    },
    {
      name: "graph artifacts",
      ok: graphDirectory !== undefined,
      message: graphPaths.graph,
    },
  ];
}

export function watchSoftwareGraph(options: WatchSoftwareGraphOptions = {}): WatchHandle {
  const root = resolve(options.root ?? process.cwd());
  const debounceMs = options.debounceMs ?? 150;
  let timer: NodeJS.Timeout | undefined;
  let closed = false;
  let watcher: FSWatcher | undefined;

  const runBuild = (): void => {
    if (closed) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      buildSoftwareGraphWithArtifacts({ ...options, root, write: true, mode: options.mode ?? "watch" })
        .then((result) => options.onBuild?.(result))
        .catch((error) => options.onError?.(error));
    }, debounceMs);
  };

  watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (!filename || shouldIgnorePath(filename.toString())) {
      return;
    }

    runBuild();
  });

  runBuild();

  return {
    close: () => {
      closed = true;
      if (timer) {
        clearTimeout(timer);
      }
      watcher?.close();
    },
  };
}

/**
 * Imports types only, so the config loads without the CLI installed in the repository (a global
 * install cannot be resolved from it).
 */
function defaultConfigContents(): string {
  return [
    'import type { OntolyConfig } from "@0xsarwagya/ontoly-cli";',
    "",
    "// Files Git ignores are never indexed. `exclude` skips more: a bare name skips every",
    "// directory of that name, a path skips that subtree.",
    "export default {",
    '  outputDir: ".ontoly",',
    "  exclude: [],",
    "  plugins: [],",
    "} satisfies OntolyConfig;",
    "",
  ].join("\n");
}

function shouldIgnorePath(path: string): boolean {
  return path
    .split(/[\\/]/)
    .some((part) =>
      [
        ".artifacts",
        ".cache",
        ".expo",
        ".git",
        ".next",
        ".nuxt",
        ".ontoly",
        ".svelte-kit",
        ".turbo",
        ".vite",
        "artifacts",
        "build",
        "coverage",
        "dist",
        "downloads",
        "node_modules",
        "ontoly-output",
        "out",
        "outputs",
        "playwright-report",
        "temp",
        "test-results",
        "tmp",
        "work",
      ].includes(part),
    );
}

export type { OntolyConfig };
