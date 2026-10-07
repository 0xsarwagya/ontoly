import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import type { SoftwareGraphRepository } from "@0xsarwagya/ontoly-core";
import { createDiagnosticSink } from "../diagnostics";
import { createPassManager } from "../passes";
import { discoverRepository } from "../repository";
import { normalizeCompilerWorkerCount } from "../execution";
import type {
  BuildSoftwareGraphOptions,
  CompilerContext,
  CompilerInvocation,
  CompilerPass,
  CompilerStageId,
  GraphValidationHook,
  OntolyConfig,
  ResolvedOntolyConfig,
} from "../types";

/**
 * Type-inference helper for `ontoly.config.ts`. Returns the config
 * verbatim; its only purpose is to give editors the correct completions
 * and hover docs for `OntolyConfig` fields — in particular `exclude`,
 * whose two matching modes are documented on the `OntolyConfig` type.
 *
 * Usage:
 * ```ts
 * import { defineOntolyConfig } from "@0xsarwagya/ontoly-cli";
 *
 * export default defineOntolyConfig({
 *   outputDir: ".ontoly",
 *   exclude: [
 *     "Pods",                       // bare name — matches any `Pods/` segment
 *     "apps/companion-app/ios",     // anchored prefix — that subtree only
 *   ],
 *   plugins: [],
 * });
 * ```
 */
export function defineOntolyConfig<T extends OntolyConfig>(config: T): T {
  return config;
}

/**
 * Fills the array and record fields of an `OntolyConfig` with their
 * default values so downstream callsites don't need per-read `?? []`
 * fallbacks. Applied by `loadOntolyConfig` and `createCompilerContext`.
 */
export function resolveOntolyConfig(config: OntolyConfig): ResolvedOntolyConfig {
  return {
    ...config,
    include: config.include ?? [],
    exclude: config.exclude ?? [],
    plugins: config.plugins ?? [],
    parsers: config.parsers ?? {},
  };
}

export async function createCompilerInvocation(
  options: BuildSoftwareGraphOptions = {},
): Promise<CompilerInvocation> {
  const config = await loadOntolyConfig(options.root ?? process.cwd(), options.configPath);
  const root = resolve(options.root ?? config.root ?? process.cwd());

  return withOptionalProperties(
    {
      root,
      outputDir: options.outputDir ?? config.outputDir ?? ".ontoly",
      write: options.write ?? false,
      mode: options.mode ?? "clean",
      cacheEnabled: options.cache ?? (
        options.mode === "warm" || options.mode === "watch" || options.mode === "incremental"
      ),
      cacheDir: options.cacheDir ?? ".ontoly/cache/compiler",
      workers: normalizeCompilerWorkerCount(options.workers ?? config.workers),
    },
    {
      configPath: options.configPath,
      sourceProvider: options.sourceProvider,
    },
  );
}

export async function createCompilerContext(input: {
  readonly invocation: CompilerInvocation;
  readonly config?: OntolyConfig | undefined;
  readonly passes?: readonly CompilerPass[] | undefined;
  readonly validationHooks?: readonly GraphValidationHook[] | undefined;
  readonly onProgress?: BuildSoftwareGraphOptions["onProgress"];
}): Promise<CompilerContext> {
  const config = input.config
    ? resolveOntolyConfig(input.config)
    : await loadOntolyConfig(input.invocation.root, input.invocation.configPath);
  const discovery = await discoverRepository(
    input.invocation.root,
    input.invocation.sourceProvider,
    config.exclude,
  );
  const repository: SoftwareGraphRepository = withOptionalProperties(
    {
      root: discovery.root,
      name: discovery.name,
    },
    {
      packageName: discovery.packageName,
      packageManager: discovery.packageManager,
    },
  );

  return {
    invocation: input.invocation,
    config,
    repository,
    diagnostics: createDiagnosticSink(),
    extensions: { namespaces: [] },
    passManager: createPassManager(input.passes ?? []),
    validationHooks: input.validationHooks ?? [],
    onProgress: input.onProgress,
  };
}

/** Looked for in the repository root, in this order, when no config path is given. */
export const ONTOLY_CONFIG_FILES = [
  "ontoly.config.ts",
  "ontoly.config.mts",
  "ontoly.config.mjs",
  "ontoly.config.js",
] as const;

/**
 * The config at `configPathInput`, else the first of `ONTOLY_CONFIG_FILES` in the root, else the
 * defaults. A TypeScript config is imported as is, so it needs a Node.js that strips types
 * (22.18 or later). A config given by path that cannot be loaded throws; one found in the root
 * warns and falls back to the defaults, as the build always did before configs were read.
 */
export async function loadOntolyConfig(
  rootInput: string,
  configPathInput?: string,
): Promise<ResolvedOntolyConfig> {
  const root = resolve(rootInput);
  const configPath = configPathInput ? resolve(root, configPathInput) : await findConfigFile(root);

  if (!configPath) {
    return resolveOntolyConfig({});
  }

  try {
    const imported = (await import(pathToFileURL(configPath).href)) as {
      readonly default?: OntolyConfig;
    };
    return resolveOntolyConfig(imported.default ?? {});
  } catch (error) {
    const reason = `Could not load ${configPath}: ${error instanceof Error ? error.message : String(error)}`;
    if (configPathInput) {
      throw new Error(reason, { cause: error });
    }
    process.emitWarning(`${reason}. Building with the default config.`, { code: "ONTOLY_CONFIG_NOT_LOADED" });
    return resolveOntolyConfig({});
  }
}

async function findConfigFile(root: string): Promise<string | undefined> {
  for (const name of ONTOLY_CONFIG_FILES) {
    const path = join(root, name);
    if (await access(path).then(() => true, () => false)) {
      return path;
    }
  }
  return undefined;
}

export function createNoopPass(input: {
  readonly id: string;
  readonly stage: CompilerStageId;
  readonly kind?: CompilerPass["kind"] | undefined;
  readonly semantic?: boolean | undefined;
}): CompilerPass {
  return {
    id: input.id,
    stage: input.stage,
    kind: input.kind ?? "semantic",
    semantic: input.semantic ?? false,
    run: () => ({}),
  };
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as T & O;
}
