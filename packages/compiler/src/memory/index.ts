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

/**
 * Normalize an in-memory source map into a {@link SourceProvider}.
 *
 * Keys are normalized to POSIX-style repository-relative paths (forward
 * slashes, no leading `./`). Later keys win on collision after normalization.
 */
export function createInMemorySourceProvider(files: InMemorySources): SourceProvider {
  const normalized = new Map<string, string>();

  for (const [rawPath, contents] of Object.entries(files)) {
    normalized.set(normalizeSourcePath(rawPath), contents);
  }

  const sortedPaths = [...normalized.keys()].sort();

  return {
    listFiles: () => sortedPaths,
    readFile: (relativePath) => normalized.get(normalizeSourcePath(relativePath)),
    hasFile: (relativePath) => normalized.has(normalizeSourcePath(relativePath)),
  };
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

  try {
    await materializeSources(scratchRoot, files);

    return await buildSoftwareGraphWithArtifacts({
      ...options,
      root: scratchRoot,
      write: false,
    });
  } finally {
    await rm(scratchRoot, { recursive: true, force: true });
  }
}

async function materializeSources(root: string, files: InMemorySources): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([rawPath, contents]) => {
      const relativePath = normalizeSourcePath(rawPath);
      const absolutePath = join(root, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents, "utf8");
    }),
  );
}

function normalizeSourcePath(rawPath: string): string {
  return normalizePath(rawPath).replace(/^\.\//, "").replace(/^\/+/, "");
}
