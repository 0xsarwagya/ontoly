import { access, readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { normalizePath, stableHash } from "@0xsarwagya/ontoly-core";
import type { RepositoryDiscovery, SourceArtifact, SourceInventory } from "../types";

const IGNORED_PARTS = new Set([
  ".artifacts",
  ".cache",
  ".expo",
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".ontoly",
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
]);

export async function discoverRepository(rootInput = process.cwd()): Promise<RepositoryDiscovery> {
  const root = resolve(rootInput);
  const packageJsonPath = await findUp("package.json", root);
  const packageJson = packageJsonPath ? await readPackageJson(packageJsonPath) : undefined;
  const files = await discoverFiles(root);
  const packageName = typeof packageJson?.name === "string" ? packageJson.name : undefined;
  const packageManager = typeof packageJson?.packageManager === "string" ? packageJson.packageManager : undefined;
  const name = packageName ?? basename(root);

  return withOptionalProperties(
    {
      root,
      name,
      files,
    },
    {
      packageName,
      packageManager,
      packageJsonPath,
    },
  );
}

export async function createSourceInventory(root: string): Promise<SourceInventory> {
  const files = await discoverFiles(root);
  const sources = await Promise.all(
    files.map(async (file): Promise<SourceArtifact> => {
      const contents = await readFile(join(root, file), "utf8");

      return {
        path: file,
        kind: classifySource(file),
        digest: `sha256:${stableHash(contents)}`,
      };
    }),
  );

  return {
    sources: sources.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function findUp(fileName: string, start: string): Promise<string | undefined> {
  let current = resolve(start);

  while (true) {
    const candidate = join(current, fileName);

    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

async function discoverFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(directory, entry.name);
      const relativePath = normalizePath(relative(root, absolute));

      if (shouldIgnorePath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  };

  await walk(root);
  return files.sort();
}

function shouldIgnorePath(path: string): boolean {
  return normalizePath(path)
    .split("/")
    .some((part) => IGNORED_PARTS.has(part));
}

function classifySource(path: string): SourceArtifact["kind"] {
  if (path === "package.json" || path.endsWith("/package.json")) {
    return "package";
  }

  if (path.endsWith(".json") || path.endsWith(".yaml") || path.endsWith(".yml") || path.endsWith(".toml")) {
    return "config";
  }

  if (path.endsWith(".graphql") || path.endsWith(".gql") || path.endsWith(".prisma") || path.endsWith(".sql")) {
    return "schema";
  }

  return "file";
}

async function readPackageJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as T & O;
}
