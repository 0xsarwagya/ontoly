import { copyFile, link, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID, type Hash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import type { SoftwareGraph } from "@0xsarwagya/ontoly-core";
import {
  createSemanticIndex,
  decodeSemanticIndex,
  encodeSemanticIndex,
  rememberSemanticIndex,
  validateSemanticIndex,
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
  readonly products: string;
}

export interface PersistGraphOptions {
  readonly root: string;
  readonly directory?: string | undefined;
}

/** Where `ontoly build` writes its output bundle unless `--output` says otherwise. */
export const DEFAULT_BUILD_OUTPUT_DIRECTORY = "ontoly-output";

/**
 * The directory holding the repository's newest Software Graph: the build bundle (`ontoly-output`) or the
 * compiler's `.ontoly` (older builds, `ontoly analyze`). Readers default here, not to `.ontoly` alone, which
 * a default build never writes the graph to. Undefined when neither holds a graph.
 */
export async function findGraphArtifactDirectory(root: string): Promise<string | undefined> {
  let newest: { readonly directory: string; readonly modifiedMs: number } | undefined;
  for (const directory of [DEFAULT_BUILD_OUTPUT_DIRECTORY, ".ontoly"]) {
    const paths = getGraphArtifactPaths({ root, directory });
    const modifiedMs = (await modifiedTime(paths.graph)) ?? (await modifiedTime(paths.legacyGraph));
    if (modifiedMs !== undefined && (newest === undefined || modifiedMs > newest.modifiedMs)) {
      newest = { directory, modifiedMs };
    }
  }
  return newest?.directory;
}

async function modifiedTime(path: string): Promise<number | undefined> {
  return stat(path).then((stats) => stats.mtimeMs, () => undefined);
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
    products: join(directory, "products.json"),
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
    writeJsonFile(paths.graph, graph).then(() => writeGraphAlias(paths.graph, paths.legacyGraph)),
    writeJsonFile(paths.diagnostics, graph.diagnostics),
    writeJson(paths.metadata, graph.metadata),
    writeJsonFile(paths.indexes, graph.indexes),
    writeJsonFile(paths.semanticIndex, encodeSemanticIndex(semanticIndex)),
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
  return decodeSemanticIndex(JSON.parse(contents));
}

/**
 * The persisted semantic index, if it was built from the graph beside it, read without parsing that graph: the
 * graph's hash comes from metadata.json, written with it. Undefined when a file is missing or unreadable, the hashes
 * differ or the index is invalid, so the caller falls back to loading the graph.
 */
export async function loadCurrentSemanticIndex(options: PersistGraphOptions): Promise<SemanticIndex | undefined> {
  const paths = getGraphArtifactPaths(options);
  try {
    const [metadata, index] = await Promise.all([
      readFile(paths.metadata, "utf8").then((contents) => JSON.parse(contents) as Partial<SoftwareGraph["metadata"]>),
      loadSemanticIndex(options),
    ]);
    return index.graphHash === metadata.deterministicHash && validateSemanticIndex(index).length === 0 ? index : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The persisted semantic index when it matches the graph, else a rebuilt one, which is persisted. Pass the graph
 * when the caller already holds it: reading it again doubled the memory and time of every search.
 */
export async function loadOrCreateSemanticIndex(
  options: PersistGraphOptions,
  knownGraph?: SoftwareGraph,
): Promise<SemanticIndex> {
  const paths = getGraphArtifactPaths(options);
  const graphFor = (): Promise<SoftwareGraph> => (knownGraph ? Promise.resolve(knownGraph) : loadGraph(options));

  try {
    const [semanticIndex, graph] = await Promise.all([
      loadSemanticIndex(options),
      graphFor(),
    ]);
    if (validateSemanticIndex(semanticIndex, graph).length === 0) {
      rememberSemanticIndex(graph, semanticIndex);
      return semanticIndex;
    }
    const rebuilt = createSemanticIndex(graph);
    await mkdir(paths.directory, { recursive: true });
    await writeJsonFile(paths.semanticIndex, encodeSemanticIndex(rebuilt));
    return rebuilt;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
    const graph = await graphFor();
    const semanticIndex = createSemanticIndex(graph);
    await mkdir(paths.directory, { recursive: true });
    await writeJsonFile(paths.semanticIndex, encodeSemanticIndex(semanticIndex));
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

/** Atomically commits the graph and manifest used by incremental compiler builds. */
/**
 * Commits the graph and products, then the manifest that `manifest` builds from the products file's sha256. The
 * manifest is the commit marker, so it becomes visible last.
 */
export async function persistCompilerSnapshot(
  graph: SoftwareGraph,
  options: PersistGraphOptions,
  manifest: (productsDigest: string) => unknown,
  products: unknown = {},
): Promise<GraphArtifactPaths> {
  const paths = getGraphArtifactPaths(options);
  await mkdir(paths.directory, { recursive: true });
  const productsDigest = createHash("sha256");
  await Promise.all([
    writeJsonAtomic(paths.graph, graph),
    writeJsonAtomic(paths.products, products, productsDigest),
  ]);
  await writeJsonAtomic(paths.cache, manifest(productsDigest.digest("hex")));
  return paths;
}

/**
 * The products and the sha256 of the file they were read from, which persistCompilerSnapshot recorded in the
 * manifest: checking it costs one pass over bytes already read, not a second serialization. No digest when the
 * file is missing and `fallback` is returned.
 */
export async function loadCompilerProductsWithDigest<T>(
  options: PersistGraphOptions,
  fallback: T,
): Promise<{ readonly products: T; readonly digest: string | undefined }> {
  const paths = getGraphArtifactPaths(options);
  let contents: string;
  try {
    contents = await readFile(paths.products, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return { products: fallback, digest: undefined };
    }
    throw error;
  }
  return { products: JSON.parse(contents) as T, digest: createHash("sha256").update(contents).digest("hex") };
}

export async function loadCompilerProducts<T>(
  options: PersistGraphOptions,
  fallback: T,
): Promise<T> {
  const paths = getGraphArtifactPaths(options);
  try {
    return JSON.parse(await readFile(paths.products, "utf8")) as T;
  } catch (error) {
    if (isMissingFileError(error)) {
      return fallback;
    }
    throw error;
  }
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
  await writeFile(path, serializeJson(value), "utf8");
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Characters gathered before each write; large enough that writes are few, small next to any artifact. */
const WRITE_BUFFER_CHARS = 1 << 20;
/** Plain objects and arrays this shallow are written member by member; deeper values are small. */
const STREAM_DEPTH = 2;

/**
 * Writes `value` as compact JSON plus a newline, byte for byte what `JSON.stringify(value)` gives, but without
 * holding the whole document as one string. A graph larger than the longest string V8 allows (about 512 MB) then
 * still writes, where `JSON.stringify` threw "Invalid string length"; compact output is also 20-30% smaller.
 */
/** Streams `value` to `path` as compact JSON. A `digest`, if given, is fed exactly the bytes written. */
export async function writeJsonFile(path: string, value: unknown, digest?: Hash): Promise<void> {
  const handle = await open(path, "w");
  try {
    let buffer = "";
    for (const chunk of jsonChunks(value, 0)) {
      buffer += chunk;
      if (buffer.length >= WRITE_BUFFER_CHARS) {
        await handle.write(buffer);
        digest?.update(buffer);
        buffer = "";
      }
    }
    buffer += "\n";
    await handle.write(buffer);
    digest?.update(buffer);
  } finally {
    await handle.close();
  }
}

function* jsonChunks(value: unknown, depth: number): Generator<string> {
  if (Array.isArray(value) && depth < STREAM_DEPTH) {
    yield "[";
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) yield ",";
      const item: unknown = value[index];
      // JSON.stringify writes null for these inside arrays.
      if (item === undefined || typeof item === "function" || typeof item === "symbol") yield "null";
      else yield* jsonChunks(item, depth + 1);
    }
    yield "]";
    return;
  }
  if (isPlainObject(value) && depth < STREAM_DEPTH) {
    yield "{";
    let first = true;
    for (const [key, member] of Object.entries(value)) {
      // ...and omits these from objects.
      if (member === undefined || typeof member === "function" || typeof member === "symbol") continue;
      yield `${first ? "" : ","}${JSON.stringify(key)}:`;
      first = false;
      yield* jsonChunks(member, depth + 1);
    }
    yield "}";
    return;
  }
  yield JSON.stringify(value) ?? "null";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (typeof (value as { readonly toJSON?: unknown }).toJSON === "function") return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * `graph.json` is the compatibility name for `SoftwareGraph.json`. A hard link keeps the two identical at no disk
 * cost; where links are unsupported it is a copy, as before. Removed first, so a graph renamed into place by an
 * atomic write never leaves the alias pointing at the old file.
 */
export async function writeGraphAlias(graphPath: string, aliasPath: string): Promise<void> {
  await rm(aliasPath, { force: true });
  await link(graphPath, aliasPath).catch(() => copyFile(graphPath, aliasPath));
}

async function writeJsonAtomic(path: string, value: unknown, digest?: Hash): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeJsonFile(temporaryPath, value, digest);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
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
