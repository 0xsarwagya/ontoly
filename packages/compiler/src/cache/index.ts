import {
  loadCompilerCache,
  loadCompilerProducts,
  loadGraph,
  type PersistGraphOptions,
} from "@0xsarwagya/ontoly-cache";
import { stableHash, stableStringify, type SoftwareGraph } from "@0xsarwagya/ontoly-core";
import {
  COMPILER_PIPELINE_VERSION,
  COMPILER_STAGE_IDS,
  type CompilerCacheView,
  type CompilerContext,
  type CompilerInvalidation,
  type CompilerPipelineState,
  type SourceArtifact,
} from "../types";

export const COMPILER_CACHE_VERSION = "1.0.0";

export interface CompilerCacheManifest {
  readonly version: typeof COMPILER_CACHE_VERSION;
  readonly pipelineVersion: string;
  readonly graphHash: string;
  readonly sourceFingerprint: string;
  readonly configurationFingerprint: string;
  readonly passFingerprint: string;
  readonly productsFingerprint: string;
  readonly sources: readonly SourceArtifact[];
}

export interface LoadedCompilerCache {
  readonly view: CompilerCacheView;
  readonly graph?: SoftwareGraph | undefined;
  readonly products?: ReadonlyMap<string, unknown> | undefined;
}

export async function loadCompilerBuildCache(
  context: CompilerContext,
  state: CompilerPipelineState,
): Promise<LoadedCompilerCache> {
  const sourceFingerprint = createSourceFingerprint(state.sources?.sources ?? []);
  const emptyInvalidation = createInvalidation([], []);

  if (!context.invocation.cacheEnabled || context.invocation.mode === "clean") {
    return {
      view: createCacheView({
        compatible: false,
        hit: false,
        reason: "disabled",
        sourceFingerprint,
        invalidation: emptyInvalidation,
      }),
    };
  }

  const options = cacheOptions(context);

  try {
    const manifest = await loadCompilerCache<CompilerCacheManifest | null>(options, null);

    if (!manifest || !isCompilerCacheManifest(manifest)) {
      return {
        view: createCacheView({
          compatible: false,
          hit: false,
          reason: "missing",
          sourceFingerprint,
          invalidation: emptyInvalidation,
        }),
      };
    }

    const invalidation = createInvalidation(manifest.sources, state.sources?.sources ?? []);
    const compatible = manifest.version === COMPILER_CACHE_VERSION
      && manifest.pipelineVersion === COMPILER_PIPELINE_VERSION
      && manifest.configurationFingerprint === createConfigurationFingerprint(context)
      && manifest.passFingerprint === createPassFingerprint(context);

    if (!compatible) {
      return {
        view: createCacheView({
          compatible: false,
          hit: false,
          reason: "incompatible",
          sourceFingerprint,
          previousGraphHash: manifest.graphHash,
          invalidation,
          manifest,
        }),
      };
    }

    if (manifest.sourceFingerprint !== sourceFingerprint || hasInvalidation(invalidation)) {
      return {
        view: createCacheView({
          compatible: true,
          hit: false,
          reason: "sources-changed",
          sourceFingerprint,
          previousGraphHash: manifest.graphHash,
          invalidation,
          manifest,
        }),
      };
    }

    let graph: SoftwareGraph;
    let products: Record<string, unknown> | null;
    try {
      [graph, products] = await Promise.all([
        loadGraph(options),
        loadCompilerProducts<Record<string, unknown> | null>(options, null),
      ]);
    } catch (error) {
      return {
        view: createCacheView({
          compatible: true,
          hit: false,
          reason: isMissingFileError(error) ? "graph-missing" : "read-failed",
          sourceFingerprint,
          previousGraphHash: manifest.graphHash,
          invalidation,
          manifest,
        }),
      };
    }

    if (products === null) {
      return {
        view: createCacheView({
          compatible: true,
          hit: false,
          reason: "products-missing",
          sourceFingerprint,
          previousGraphHash: manifest.graphHash,
          invalidation,
          manifest,
        }),
      };
    }

    if (graph.metadata.deterministicHash !== manifest.graphHash) {
      return {
        view: createCacheView({
          compatible: true,
          hit: false,
          reason: "graph-mismatch",
          sourceFingerprint,
          previousGraphHash: manifest.graphHash,
          invalidation,
          manifest,
        }),
      };
    }

    if (stableHash(stableStringify(products)) !== manifest.productsFingerprint) {
      return {
        view: createCacheView({
          compatible: true,
          hit: false,
          reason: "products-mismatch",
          sourceFingerprint,
          previousGraphHash: manifest.graphHash,
          invalidation,
          manifest,
        }),
      };
    }

    return {
      graph,
      products: new Map(Object.entries(products).sort(([left], [right]) => left.localeCompare(right))),
      view: createCacheView({
        compatible: true,
        hit: true,
        reason: "hit",
        sourceFingerprint,
        previousGraphHash: manifest.graphHash,
        invalidation,
        manifest,
      }),
    };
  } catch {
    return {
      view: createCacheView({
        compatible: false,
        hit: false,
        reason: "read-failed",
        sourceFingerprint,
        invalidation: emptyInvalidation,
      }),
    };
  }
}

export function createCompilerCacheManifest(
  context: CompilerContext,
  state: CompilerPipelineState,
  graph: SoftwareGraph,
): CompilerCacheManifest {
  return {
    version: COMPILER_CACHE_VERSION,
    pipelineVersion: COMPILER_PIPELINE_VERSION,
    graphHash: graph.metadata.deterministicHash,
    sourceFingerprint: createSourceFingerprint(state.sources?.sources ?? []),
    configurationFingerprint: createConfigurationFingerprint(context),
    passFingerprint: createPassFingerprint(context),
    productsFingerprint: stableHash(stableStringify(
      Object.fromEntries([...state.products.entries()].sort(([left], [right]) => left.localeCompare(right))),
    )),
    sources: [...(state.sources?.sources ?? [])]
      .map((source) => ({ ...source }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function compilerCacheOptions(context: CompilerContext): PersistGraphOptions {
  return cacheOptions(context);
}

export function createSourceFingerprint(sources: readonly SourceArtifact[]): string {
  return stableHash(stableStringify(
    [...sources]
      .map(({ path, kind, digest }) => ({ path, kind, digest }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  ));
}

function createConfigurationFingerprint(context: CompilerContext): string {
  return stableHash(stableStringify({
    include: [...context.config.include],
    exclude: [...context.config.exclude],
    parsers: context.config.parsers,
    plugins: [...context.config.plugins],
  }));
}

function createPassFingerprint(context: CompilerContext): string {
  const passes = COMPILER_STAGE_IDS.flatMap((stage) =>
    context.passManager.passesForStage(stage).map((pass) => ({
      id: pass.id,
      cacheKey: pass.cacheKey ?? pass.version ?? "unversioned",
      stage,
    })),
  );
  const validationHooks = context.validationHooks.map((hook) => ({
    id: hook.id,
    version: hook.version ?? "unversioned",
  }));
  return stableHash(stableStringify({ passes, validationHooks }));
}

function createInvalidation(
  previous: readonly SourceArtifact[],
  current: readonly SourceArtifact[],
): CompilerInvalidation {
  const previousByPath = new Map(previous.map((source) => [source.path, source] as const));
  const currentByPath = new Map(current.map((source) => [source.path, source] as const));
  const added = [...currentByPath.keys()].filter((path) => !previousByPath.has(path)).sort();
  const removed = [...previousByPath.keys()].filter((path) => !currentByPath.has(path)).sort();
  const modified = [...currentByPath.entries()]
    .filter(([path, source]) => previousByPath.has(path) && previousByPath.get(path)?.digest !== source.digest)
    .map(([path]) => path)
    .sort();
  return { added, modified, removed };
}

function createCacheView(input: Omit<CompilerCacheView, "entries"> & {
  readonly manifest?: CompilerCacheManifest | undefined;
}): CompilerCacheView {
  const { manifest, ...view } = input;
  return {
    ...view,
    entries: manifest ? new Map([["manifest", manifest]]) : new Map(),
  };
}

function hasInvalidation(invalidation: CompilerInvalidation): boolean {
  return invalidation.added.length > 0
    || invalidation.modified.length > 0
    || invalidation.removed.length > 0;
}

function cacheOptions(context: CompilerContext): PersistGraphOptions {
  return {
    root: context.invocation.root,
    directory: context.invocation.cacheDir,
  };
}

function isCompilerCacheManifest(value: unknown): value is CompilerCacheManifest {
  if (!isRecord(value) || !Array.isArray(value.sources)) {
    return false;
  }
  return typeof value.version === "string"
    && typeof value.pipelineVersion === "string"
    && typeof value.graphHash === "string"
    && typeof value.sourceFingerprint === "string"
    && typeof value.configurationFingerprint === "string"
    && typeof value.passFingerprint === "string"
    && typeof value.productsFingerprint === "string"
    && value.sources.every((source) =>
      isRecord(source)
      && typeof source.path === "string"
      && typeof source.kind === "string"
      && typeof source.digest === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
