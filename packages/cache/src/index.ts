import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { SoftwareGraph } from "@0xsarwagya/ontoly-core";
import {
  createSemanticIndex,
  type SemanticIndex,
} from "@0xsarwagya/ontoly-core";

export interface GraphArtifactPaths {
  readonly root: string;
  readonly directory: string;
  readonly graph: string;
  readonly legacyGraph: string;
  readonly diagnostics: string;
  readonly metadata: string;
  readonly indexes: string;
  readonly semanticIndex: string;
  readonly statistics: string;
  readonly cache: string;
}

export interface PersistGraphOptions {
  readonly root: string;
  readonly directory?: string | undefined;
}

export function getGraphArtifactPaths(options: PersistGraphOptions): GraphArtifactPaths {
  const outputDirectory = options.directory ?? ".ontoly";
  const directory = isAbsolute(outputDirectory) ? outputDirectory : join(options.root, outputDirectory);

  return {
    root: options.root,
    directory,
    graph: join(directory, "SoftwareGraph.json"),
    legacyGraph: join(directory, "graph.json"),
    diagnostics: join(directory, "diagnostics.json"),
    metadata: join(directory, "metadata.json"),
    indexes: join(directory, "indexes.json"),
    semanticIndex: join(directory, "index.json"),
    statistics: join(directory, "statistics.json"),
    cache: join(directory, "cache.json"),
  };
}

export async function persistGraph(
  graph: SoftwareGraph,
  options: PersistGraphOptions,
): Promise<GraphArtifactPaths> {
  const paths = getGraphArtifactPaths(options);
  const semanticIndex = createSemanticIndex(graph);
  await mkdir(paths.directory, { recursive: true });

  await Promise.all([
    writeJson(paths.graph, graph),
    writeJson(paths.legacyGraph, graph),
    writeJson(paths.diagnostics, graph.diagnostics),
    writeJson(paths.metadata, graph.metadata),
    writeJson(paths.indexes, graph.indexes),
    writeJson(paths.semanticIndex, semanticIndex),
    writeJson(paths.statistics, createGraphStatistics(graph)),
  ]);

  return paths;
}

export async function loadGraph(options: PersistGraphOptions): Promise<SoftwareGraph> {
  const paths = getGraphArtifactPaths(options);
  const contents = await readFirstExisting([paths.graph, paths.legacyGraph]);
  return JSON.parse(contents) as SoftwareGraph;
}

export async function loadSemanticIndex(options: PersistGraphOptions): Promise<SemanticIndex> {
  const paths = getGraphArtifactPaths(options);
  const contents = await readFile(paths.semanticIndex, "utf8");
  return JSON.parse(contents) as SemanticIndex;
}

export async function loadOrCreateSemanticIndex(options: PersistGraphOptions): Promise<SemanticIndex> {
  try {
    return await loadSemanticIndex(options);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
    const graph = await loadGraph(options);
    const semanticIndex = createSemanticIndex(graph);
    await mkdir(getGraphArtifactPaths(options).directory, { recursive: true });
    await writeJson(getGraphArtifactPaths(options).semanticIndex, semanticIndex);
    return semanticIndex;
  }
}

export async function persistCompilerCache(
  options: PersistGraphOptions,
  cache: unknown,
): Promise<GraphArtifactPaths> {
  const paths = getGraphArtifactPaths(options);
  await mkdir(paths.directory, { recursive: true });
  await writeJson(paths.cache, cache);
  return paths;
}

export async function loadCompilerCache<T>(
  options: PersistGraphOptions,
  fallback: T,
): Promise<T> {
  const paths = getGraphArtifactPaths(options);

  try {
    const contents = await readFile(paths.cache, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if (isMissingFileError(error)) {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readFirstExisting(paths: readonly string[]): Promise<string> {
  let lastError: unknown;

  for (const path of paths) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function createGraphStatistics(graph: SoftwareGraph): Record<string, unknown> {
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

function countBy(values: readonly string[]): Record<string, number> {
  return Object.fromEntries(
    [...values.reduce((counts, value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}
