import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { normalizePath } from "@0xsarwagya/ontoly-core";
import { buildSoftwareGraphWithArtifacts } from "../index";
import type {
  BuildSoftwareGraphOptions,
  BuildSoftwareGraphResult,
  InMemorySources,
  SourceProvider,
} from "../types";

/**
 * Default root used to label and root in-memory builds. Node ids are always
 * repository-relative, so this value only appears in `repository.root` and
 * absolute-path metadata, never in graph identity.
 */
export const DEFAULT_MEMORY_ROOT = resolve("/", "ontoly-memory");

/**
 * How {@link buildSoftwareGraphFromMemory} turns in-memory source into a graph.
 *
 * - `materialize` (default): write the sources into a private scratch directory,
 *   run the standard on-disk pipeline, then remove the directory. Highest
 *   fidelity because it reuses the exact filesystem-backed toolchain.
 * - `zero-disk`: serve the sources from memory end to end. Nothing from the
 *   provided source set is written to disk. TypeScript library declarations may
 *   still be read from the installed compiler.
 */
export type InMemoryBuildStrategy = "materialize" | "zero-disk";

export interface BuildSoftwareGraphFromMemoryOptions
  extends Omit<BuildSoftwareGraphOptions, "sourceProvider" | "write"> {
  /** Repository-relative path -> UTF-8 contents. */
  readonly files: InMemorySources;
  /** Build strategy. Defaults to `materialize`. */
  readonly strategy?: InMemoryBuildStrategy | undefined;
}

export class InvalidInMemorySourcePathError extends Error {
  readonly code = "INVALID_IN_MEMORY_SOURCE_PATH";

  constructor(
    readonly sourcePath: string,
    reason: string,
  ) {
    super(`Invalid in-memory source path ${JSON.stringify(sourcePath)}: ${reason}.`);
    this.name = "InvalidInMemorySourcePathError";
  }
}

/**
 * Normalize an in-memory source map into a {@link SourceProvider}.
 *
 * Keys are normalized to POSIX-style repository-relative paths (forward
 * slashes, no leading `./`). Later keys win on collision after normalization.
 */
export function createInMemorySourceProvider(files: InMemorySources): SourceProvider {
  const normalized = new Map<string, string>();

  for (const [rawPath, contents] of Object.entries(files)) {
    normalized.set(normalizeInMemorySourcePath(rawPath), contents);
  }

  const sortedPaths = [...normalized.keys()].sort();

  return {
    listFiles: () => sortedPaths,
    readFile: (relativePath) => {
      const normalizedPath = normalizeSourceLookupPath(relativePath);
      return normalizedPath ? normalized.get(normalizedPath) : undefined;
    },
    hasFile: (relativePath) => {
      const normalizedPath = normalizeSourceLookupPath(relativePath);
      return normalizedPath ? normalized.has(normalizedPath) : false;
    },
  };
}

/** Validate and canonicalize a repository-relative in-memory source path. */
export function normalizeInMemorySourcePath(rawPath: string): string {
  if (rawPath.includes("\0")) {
    throw new InvalidInMemorySourcePathError(rawPath, "NUL bytes are not allowed");
  }

  const normalized = normalizePath(rawPath);
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new InvalidInMemorySourcePathError(rawPath, "the path must be repository-relative");
  }

  const segments = normalized.split("/").filter((segment) => segment !== "" && segment !== ".");
  if (segments.includes("..")) {
    throw new InvalidInMemorySourcePathError(rawPath, "parent-directory traversal is not allowed");
  }
  if (segments.length === 0) {
    throw new InvalidInMemorySourcePathError(rawPath, "the path must identify a file");
  }

  return segments.join("/");
}

function normalizeSourceLookupPath(rawPath: string): string | undefined {
  try {
    return normalizeInMemorySourcePath(rawPath);
  } catch (error) {
    if (error instanceof InvalidInMemorySourcePathError) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Build a Software Graph from source held entirely in memory.
 *
 * @example
 * ```ts
 * const result = await buildSoftwareGraphFromMemory({
 *   files: { "src/index.ts": "export const answer = 42;\n" },
 * });
 * ```
 */
export async function buildSoftwareGraphFromMemory(
  options: BuildSoftwareGraphFromMemoryOptions,
): Promise<BuildSoftwareGraphResult> {
  const { files, strategy = "materialize", root, ...rest } = options;

  if (strategy === "zero-disk") {
    return buildSoftwareGraphWithArtifacts({
      ...rest,
      root: resolve(root ?? DEFAULT_MEMORY_ROOT),
      write: false,
      sourceProvider: createInMemorySourceProvider(files),
    });
  }

  return buildInScratchDirectory(files, { ...rest, root });
}

async function buildInScratchDirectory(
  files: InMemorySources,
  options: Omit<BuildSoftwareGraphOptions, "sourceProvider" | "write">,
): Promise<BuildSoftwareGraphResult> {
  const scratchRoot = await mkdtemp(join(tmpdir(), "ontoly-memory-"));
  const sourceProvider = createInMemorySourceProvider(files);

  try {
    await materializeSources(scratchRoot, sourceProvider);

    return await buildSoftwareGraphWithArtifacts({
      ...options,
      root: scratchRoot,
      write: false,
    });
  } finally {
    await rm(scratchRoot, { recursive: true, force: true });
  }
}

async function materializeSources(root: string, sourceProvider: SourceProvider): Promise<void> {
  await Promise.all(
    sourceProvider.listFiles().map(async (relativePath) => {
      const contents = sourceProvider.readFile(relativePath);
      if (contents === undefined) {
        throw new Error(`In-memory source provider did not return contents for ${relativePath}.`);
      }
      const absolutePath = join(root, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents, "utf8");
    }),
  );
}
