import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { SoftwareGraphRepository } from "@0xsarwagya/ontoly-core";
import { createDiagnosticSink } from "../diagnostics";
import { createPassManager } from "../passes";
import { discoverRepository } from "../repository";
import type {
  BuildSoftwareGraphOptions,
  CompilerContext,
  CompilerInvocation,
  CompilerPass,
  CompilerStageId,
  GraphValidationHook,
  OntolyConfig,
} from "../types";

export function defineOntolyConfig<T extends OntolyConfig>(config: T): T {
  return config;
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
}): Promise<CompilerContext> {
  const config = input.config ?? (await loadOntolyConfig(input.invocation.root, input.invocation.configPath));
  const discovery = await discoverRepository(input.invocation.root, input.invocation.sourceProvider);
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
  };
}

export async function loadOntolyConfig(rootInput: string, configPathInput?: string): Promise<OntolyConfig> {
  const root = resolve(rootInput);
  const configPath = configPathInput ? resolve(root, configPathInput) : undefined;

  if (!configPath) {
    return {};
  }

  if (configPath.endsWith(".js") || configPath.endsWith(".mjs")) {
    const imported = (await import(pathToFileURL(configPath).href)) as {
      readonly default?: OntolyConfig;
    };
    return imported.default ?? {};
  }

  return { root };
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
