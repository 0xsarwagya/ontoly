import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  createEdgeId,
  createNodeId,
  normalizePath,
  type EdgeEvidence,
  type JsonObject,
  type SoftwareGraphDiagnostic,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";
import { compilerDiagnostic } from "../diagnostics";
import type { CompilerPass, CompilerRelationship, CompilerSymbol, SourceProvider } from "../types";

export const REPOSITORY_INTELLIGENCE_PASS_ID = "@0xsarwagya/ontoly-compiler:repository-intelligence";
export const REPOSITORY_INTELLIGENCE_VERSION = "1.0.0";

type JsonRecord = Record<string, unknown>;

interface RepositoryFactContext {
  readonly root: string;
  readonly passId: string;
  readonly workspaceId: string;
  readonly symbols: Map<string, CompilerSymbol>;
  readonly relationships: Map<string, CompilerRelationship>;
  readonly diagnostics: SoftwareGraphDiagnostic[];
  readonly provider?: SourceProvider | undefined;
}

interface FrameworkSignature {
  readonly packageName: string;
  readonly frameworkName: string;
  readonly category: string;
}

const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const FRAMEWORK_SIGNATURES: readonly FrameworkSignature[] = [
  { packageName: "express", frameworkName: "Express", category: "http" },
  { packageName: "fastify", frameworkName: "Fastify", category: "http" },
  { packageName: "@nestjs/core", frameworkName: "NestJS", category: "http" },
  { packageName: "@nestjs/common", frameworkName: "NestJS", category: "http" },
  { packageName: "hono", frameworkName: "Hono", category: "http" },
  { packageName: "next", frameworkName: "Next.js", category: "frontend" },
  { packageName: "react", frameworkName: "React", category: "frontend" },
  { packageName: "react-router", frameworkName: "React Router", category: "frontend-router" },
  { packageName: "react-router-dom", frameworkName: "React Router", category: "frontend-router" },
  { packageName: "@tanstack/react-router", frameworkName: "TanStack Router", category: "frontend-router" },
  { packageName: "@trpc/server", frameworkName: "tRPC", category: "rpc" },
  { packageName: "@trpc/client", frameworkName: "tRPC", category: "rpc" },
  { packageName: "@prisma/client", frameworkName: "Prisma", category: "database" },
  { packageName: "prisma", frameworkName: "Prisma", category: "database" },
  { packageName: "drizzle-orm", frameworkName: "Drizzle", category: "database" },
  { packageName: "typeorm", frameworkName: "TypeORM", category: "database" },
  { packageName: "mongoose", frameworkName: "Mongoose", category: "database" },
];

export function createRepositoryIntelligencePass(options: {
  readonly id?: string | undefined;
} = {}): CompilerPass {
  const passId = options.id ?? REPOSITORY_INTELLIGENCE_PASS_ID;

  return {
    id: passId,
    kind: "semantic",
    stage: "fact-normalization",
    semantic: true,
    reads: ["repository-discovery", "source-inventory"],
    writes: ["repository-symbols", "repository-relationships"],
    run: async (context, state) => {
      const repositoryContext: RepositoryFactContext = {
        root: context.invocation.root,
        passId,
        workspaceId: createNodeId({ type: "Workspace", name: context.repository.name }),
        symbols: new Map(),
        relationships: new Map(),
        diagnostics: [],
        provider: context.invocation.sourceProvider,
      };
      const files = state.sources?.sources.map((source) => source.path).sort() ?? [];

      addSymbol(repositoryContext, {
        id: repositoryContext.workspaceId,
        kind: "Workspace",
        name: context.repository.name,
        metadata: {
          root: context.repository.root,
          packageName: context.repository.packageName,
          packageManager: context.repository.packageManager,
        },
      });

      for (const file of files.filter(isPackageManifest)) {
        await collectRepositoryFileFacts(repositoryContext, file);
      }

      for (const file of files.filter((file) => !isPackageManifest(file))) {
        await collectRepositoryFileFacts(repositoryContext, file);
      }

      return {
        symbols: [...repositoryContext.symbols.values()].sort(compareSymbols),
        relationships: [...repositoryContext.relationships.values()].sort(compareRelationships),
        diagnostics: repositoryContext.diagnostics.sort(compareDiagnostics),
        parserVersions: {
          repository: REPOSITORY_INTELLIGENCE_VERSION,
        },
        output: {
          symbols: repositoryContext.symbols.size,
          relationships: repositoryContext.relationships.size,
          diagnostics: repositoryContext.diagnostics.length,
        },
      };
    },
  };
}

async function collectRepositoryFileFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const normalizedFile = normalizePath(file);

  if (isPackageManifest(normalizedFile)) {
    await collectPackageJsonFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "pnpm-workspace.yaml" || normalizedFile === "pnpm-workspace.yml") {
    await collectPnpmWorkspaceFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "turbo.json") {
    await collectTurboFacts(context, normalizedFile);
    return;
  }

  if (basename(normalizedFile) === "Dockerfile" || normalizedFile.endsWith(".Dockerfile")) {
    await collectDockerFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "docker-compose.yml" || normalizedFile === "docker-compose.yaml") {
    await collectDockerComposeFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === ".env.example" || normalizedFile.endsWith("/.env.example")) {
    await collectEnvExampleFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile.startsWith(".github/workflows/") && (normalizedFile.endsWith(".yml") || normalizedFile.endsWith(".yaml"))) {
    await collectGitHubWorkflowFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "tsconfig.json" || normalizedFile.endsWith("/tsconfig.json")) {
    await collectTsconfigFacts(context, normalizedFile);
    return;
  }

  if (isConfigurationFile(normalizedFile)) {
    const configId = addConfigurationNode(context, normalizedFile, configurationName(normalizedFile), configurationKind(normalizedFile));
    const packageId = findOwningPackageId(context, normalizedFile);

    if (packageId) {
      addRelationship(context, "CONFIGURES", configId, packageId, normalizedFile, "configuration file configures package", {
        configurationKind: configurationKind(normalizedFile),
      });
    }
  }
}

async function collectPackageJsonFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  const json = contents ? parseJson(context, file, contents) : undefined;

  if (!json) {
    return;
  }

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const packageName = readString(json, "name") ?? (packageDirectory ? basename(packageDirectory) : "package");
  const packageId = createNodeId({ type: "Package", name: packageName });
  const configId = addConfigurationNode(context, file, "package.json", "package-manifest");

  addSymbol(context, {
    id: packageId,
    kind: "Package",
    name: packageName,
    file,
    metadata: {
      local: true,
      path: packageDirectory || ".",
      private: readBoolean(json, "private"),
      version: readString(json, "version"),
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains package");
  addRelationship(context, "CONFIGURES", configId, packageId, file, "package manifest configures package");

  const scripts = readRecord(json, "scripts");

  for (const [scriptName, command] of Object.entries(scripts).sort(([left], [right]) => left.localeCompare(right))) {
    if (typeof command !== "string") {
      continue;
    }

    const scriptId = createNodeId({ type: "Script", file, name: scriptName });
    const taskId = createNodeId({ type: "Task", file, name: `${packageName}:${scriptName}` });

    addSymbol(context, {
      id: scriptId,
      kind: "Script",
      name: scriptName,
      file,
      metadata: { command, packageId },
    });
    addSymbol(context, {
      id: taskId,
      kind: "Task",
      name: `${packageName}:${scriptName}`,
      file,
      metadata: { command, source: "package.json" },
    });
    addRelationship(context, "CONTAINS", packageId, scriptId, file, "package contains script");
    addRelationship(context, "EXECUTES", scriptId, taskId, file, "script executes task");
  }

  for (const group of DEPENDENCY_GROUPS) {
    const dependencies = readRecord(json, group);

    for (const [dependencyName, versionRange] of Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right))) {
      if (typeof versionRange !== "string") {
        continue;
      }

      const dependencyId = createNodeId({ type: "Dependency", name: dependencyName });

      addSymbol(context, {
        id: dependencyId,
        kind: "Dependency",
        name: dependencyName,
        metadata: {
          range: versionRange,
        },
      });
      addRelationship(context, "DEPENDS_ON", packageId, dependencyId, file, `package ${group} includes ${dependencyName}`, {
        dependencyType: group,
        range: versionRange,
      });
      collectFrameworkDependency(context, packageId, dependencyId, dependencyName, file);
    }
  }
}

async function collectPnpmWorkspaceFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  const configId = addConfigurationNode(context, file, "pnpm-workspace", "workspace");
  const patterns = contents ? parseYamlListAfterKey(contents, "packages") : [];

  addRelationship(context, "CONFIGURES", configId, context.workspaceId, file, "pnpm workspace configures workspace", {
    packagePatterns: [...patterns],
  });
}

async function collectTurboFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  const json = contents ? parseJson(context, file, contents) : undefined;
  const configId = addConfigurationNode(context, file, "turbo", "pipeline-config");
  const pipelineId = createNodeId({ type: "Pipeline", file, name: "turbo" });

  addSymbol(context, {
    id: pipelineId,
    kind: "Pipeline",
    name: "turbo",
    file,
    metadata: { tool: "turbo" },
  });
  addRelationship(context, "CONFIGURES", configId, pipelineId, file, "turbo configuration configures pipeline");

  const tasks = readRecord(json ?? {}, "tasks");
  const legacyPipeline = readRecord(json ?? {}, "pipeline");
  const taskEntries = Object.keys(tasks).length > 0 ? tasks : legacyPipeline;

  for (const [taskName, taskConfig] of Object.entries(taskEntries).sort(([left], [right]) => left.localeCompare(right))) {
    const taskId = createNodeId({ type: "Task", file, name: `turbo:${taskName}` });
    const taskRecord = isRecord(taskConfig) ? taskConfig : {};

    addSymbol(context, {
      id: taskId,
      kind: "Task",
      name: taskName,
      file,
      metadata: {
        source: "turbo.json",
        outputs: [...readStringArray(taskRecord, "outputs")],
        dependsOn: [...readStringArray(taskRecord, "dependsOn")],
      },
    });
    addRelationship(context, "CONTAINS", pipelineId, taskId, file, "pipeline contains task");

    for (const dependencyName of readStringArray(taskRecord, "dependsOn")) {
      const classification = classifyTurboDependency(dependencyName);
      const dependencyTaskId = createNodeId({
        type: "Task",
        file,
        name: classification.external ? `turbo-external:${dependencyName}` : `turbo:${dependencyName}`,
      });

      if (classification.external) {
        // Emit an external Task stub so the DEPENDS_ON edge below points at a
        // declared node (no MISSING_EDGE_TARGET). Multiple deps to the same
        // external reference collide on the same id, so addSymbol is
        // idempotent per (file, dep-syntax) pair.
        addSymbol(context, {
          id: dependencyTaskId,
          kind: "Task",
          name: dependencyName,
          file,
          metadata: {
            source: "turbo.json",
            external: true,
            kind: classification.kind,
            task: classification.task,
            ...(classification.kind === "cross-package" ? { package: classification.package } : {}),
          },
        });
      }

      addRelationship(context, "DEPENDS_ON", taskId, dependencyTaskId, file, "turbo task depends on task", {
        dependency: dependencyName,
        ...(classification.external ? { external: true, kind: classification.kind } : {}),
      });
    }
  }
}

// Turbo's `dependsOn` accepts references that resolve outside the current
// turbo.json:
//   `^task`   → the `task` task in each of this package's dependencies (upstream)
//   `pkg#task`→ the `task` task in a specific workspace package (cross-package)
//   `//#task` → a task in the root workspace (root)
//   `task`    → a task in the same turbo.json (local)
//
// The first three cannot be resolved to a real Task node during single-file
// fact collection because that node lives in another turbo.json (or spans all
// upstream packages). collectTurboFacts emits an external Task stub for each,
// marked with `metadata.external = true` plus a `kind` discriminant, so the
// DEPENDS_ON edge is well-formed and downstream analytics can distinguish
// resolved vs external references. A future workspace-level second pass can
// rewire these edges to the real target Task node.
type TurboDependencyClassification =
  | { readonly external: false }
  | { readonly external: true; readonly kind: "upstream"; readonly task: string }
  | { readonly external: true; readonly kind: "cross-package"; readonly package: string; readonly task: string }
  | { readonly external: true; readonly kind: "root"; readonly task: string };

function classifyTurboDependency(dependencyName: string): TurboDependencyClassification {
  if (dependencyName.startsWith("^")) {
    return { external: true, kind: "upstream", task: dependencyName.slice(1) };
  }
  if (dependencyName.startsWith("//#")) {
    return { external: true, kind: "root", task: dependencyName.slice(3) };
  }
  const hashIndex = dependencyName.indexOf("#");
  if (hashIndex > 0) {
    return {
      external: true,
      kind: "cross-package",
      package: dependencyName.slice(0, hashIndex),
      task: dependencyName.slice(hashIndex + 1),
    };
  }
  return { external: false };
}

async function collectTsconfigFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  const json = contents ? parseJson(context, file, contents) : undefined;
  const configId = addConfigurationNode(context, file, "tsconfig", "typescript");
  const targetName = dirname(file) === "." ? "typescript" : `${dirname(file)}:typescript`;
  const targetId = createNodeId({ type: "BuildTarget", file, name: targetName });
  const compilerOptions = isRecord(json?.compilerOptions) ? json.compilerOptions : {};

  addSymbol(context, {
    id: targetId,
    kind: "BuildTarget",
    name: targetName,
    file,
    metadata: {
      tool: "typescript",
      extends: json ? readString(json, "extends") : undefined,
      module: readString(compilerOptions, "module"),
      target: readString(compilerOptions, "target"),
    },
  });
  addRelationship(context, "CONFIGURES", configId, targetId, file, "tsconfig configures TypeScript build target");
}

async function collectDockerFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const containerName = dirname(file) === "." ? "Dockerfile" : dirname(file);
  const configId = addConfigurationNode(context, file, basename(file), "container-build");
  const containerId = createNodeId({ type: "Container", file, name: containerName });

  addSymbol(context, {
    id: containerId,
    kind: "Container",
    name: containerName,
    file,
    metadata: { source: "Dockerfile" },
  });
  addRelationship(context, "CONFIGURES", configId, containerId, file, "Dockerfile configures container");
}

async function collectDockerComposeFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  const configId = addConfigurationNode(context, file, "docker-compose", "container-compose");

  for (const serviceName of contents ? parseYamlMapKeysAfterKey(contents, "services") : []) {
    const containerId = createNodeId({ type: "Container", file, name: serviceName });

    addSymbol(context, {
      id: containerId,
      kind: "Container",
      name: serviceName,
      file,
      metadata: { source: "docker-compose" },
    });
    addRelationship(context, "CONFIGURES", configId, containerId, file, "docker compose configures service container");
  }
}

async function collectEnvExampleFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  const configId = addConfigurationNode(context, file, basename(file), "environment");

  for (const variableName of contents ? parseEnvVariables(contents) : []) {
    const envId = createNodeId({ type: "EnvironmentVariable", name: variableName });

    addSymbol(context, {
      id: envId,
      kind: "EnvironmentVariable",
      name: variableName,
      metadata: {
        declaredIn: file,
      },
    });
    addRelationship(context, "CONFIGURES", configId, envId, file, "env example declares environment variable");
  }
}

async function collectGitHubWorkflowFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  const configId = addConfigurationNode(context, file, basename(file), "github-actions");
  const workflowName = workflowNameFromContents(contents ?? "", file);
  const workflowId = createNodeId({ type: "Workflow", file, name: workflowName });

  addSymbol(context, {
    id: workflowId,
    kind: "Workflow",
    name: workflowName,
    file,
    metadata: { provider: "github-actions" },
  });
  addRelationship(context, "CONFIGURES", configId, workflowId, file, "workflow file configures workflow");

  let currentJobId: string | undefined;

  for (const fact of contents ? parseWorkflowFacts(contents) : []) {
    if (fact.kind === "job") {
      currentJobId = createNodeId({ type: "Job", file, name: fact.name });
      addSymbol(context, {
        id: currentJobId,
        kind: "Job",
        name: fact.name,
        file,
        metadata: { workflowId },
      });
      addRelationship(context, "CONTAINS", workflowId, currentJobId, file, "workflow contains job");
      continue;
    }

    if (fact.kind === "step" && currentJobId) {
      const stepId = createNodeId({ type: "Step", file, name: `${currentJobId}:${fact.name}` });

      addSymbol(context, {
        id: stepId,
        kind: "Step",
        name: fact.name,
        file,
        metadata: { jobId: currentJobId },
      });
      addRelationship(context, "CONTAINS", currentJobId, stepId, file, "job contains step");
    }
  }
}

function collectFrameworkDependency(
  context: RepositoryFactContext,
  packageId: string,
  dependencyId: string,
  dependencyName: string,
  file: string,
): void {
  const signature = FRAMEWORK_SIGNATURES.find((candidate) => candidate.packageName === dependencyName);

  if (!signature) {
    return;
  }

  const frameworkId = createNodeId({ type: "Framework", name: signature.frameworkName });

  addSymbol(context, {
    id: frameworkId,
    kind: "Framework",
    name: signature.frameworkName,
    metadata: {
      category: signature.category,
      detectedBy: "package.json dependency",
      packageName: dependencyName,
    },
  });
  addRelationship(context, "PROVIDES", dependencyId, frameworkId, file, "dependency provides framework", {
    packageName: dependencyName,
  });
  addRelationship(context, "USES", packageId, frameworkId, file, "package uses framework through dependency", {
    packageName: dependencyName,
  });
}

function addConfigurationNode(
  context: RepositoryFactContext,
  file: string,
  name: string,
  configurationKind: string,
): string {
  const configId = createNodeId({ type: "Configuration", file, name });

  addSymbol(context, {
    id: configId,
    kind: "Configuration",
    name,
    file,
    metadata: {
      configurationKind,
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, configId, file, "workspace contains configuration");
  return configId;
}

function addSymbol(
  context: RepositoryFactContext,
  input: Omit<CompilerSymbol, "provenance">,
): void {
  if (context.symbols.has(input.id)) {
    return;
  }

  context.symbols.set(input.id, {
    ...input,
    span: input.span ?? (input.file ? fileSpan(input.file) : undefined),
    provenance: {
      passId: context.passId,
      parser: "repository",
      parserVersion: REPOSITORY_INTELLIGENCE_VERSION,
      source: "repository",
    },
  });
}

function addRelationship(
  context: RepositoryFactContext,
  type: CompilerRelationship["type"],
  from: string,
  to: string,
  file: string,
  description: string,
  metadata?: JsonObject | undefined,
): void {
  const id = createEdgeId(type, from, to);

  if (context.relationships.has(id)) {
    return;
  }

  context.relationships.set(id, {
    id,
    type,
    from,
    to,
    evidence: [configEvidence(file, description)],
    metadata,
  });
}

async function readUtf8(context: RepositoryFactContext, file: string): Promise<string | undefined> {
  if (context.provider) {
    return context.provider.readFile(normalizePath(file));
  }

  try {
    return await readFile(join(context.root, file), "utf8");
  } catch (error) {
    context.diagnostics.push(
      compilerDiagnostic({
        code: "REPOSITORY_FILE_READ_FAILED",
        severity: "warning",
        message: `Could not read repository intelligence file ${file}.`,
        span: fileSpan(file),
        metadata: { file, error: error instanceof Error ? error.message : String(error) },
      }),
    );
    return undefined;
  }
}

function parseJson(context: RepositoryFactContext, file: string, contents: string): JsonRecord | undefined {
  try {
    const value = JSON.parse(contents) as unknown;
    return isRecord(value) ? value : {};
  } catch (error) {
    context.diagnostics.push(
      compilerDiagnostic({
        code: "REPOSITORY_JSON_PARSE_FAILED",
        severity: "warning",
        message: `Could not parse ${file} as JSON.`,
        span: fileSpan(file),
        metadata: { file, error: error instanceof Error ? error.message : String(error) },
      }),
    );
    return undefined;
  }
}

function parseEnvVariables(contents: string): readonly string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && /^[A-Z_][A-Z0-9_]*\s*=/.test(line))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .sort();
}

function parseYamlListAfterKey(contents: string, key: string): readonly string[] {
  const lines = contents.split(/\r?\n/);
  const values: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (new RegExp(`^${escapeRegExp(key)}:\\s*$`).test(line)) {
      inSection = true;
      continue;
    }

    if (inSection && /^\S/.test(line)) {
      break;
    }

    const match = inSection ? line.match(/^\s*-\s*["']?([^"']+)["']?\s*$/) : null;

    if (match?.[1]) {
      values.push(match[1].trim());
    }
  }

  return values.sort();
}

function parseYamlMapKeysAfterKey(contents: string, key: string): readonly string[] {
  const lines = contents.split(/\r?\n/);
  const values: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (new RegExp(`^${escapeRegExp(key)}:\\s*$`).test(line)) {
      inSection = true;
      continue;
    }

    if (inSection && /^\S/.test(line)) {
      break;
    }

    const match = inSection ? line.match(/^  ([A-Za-z0-9_.-]+):\s*(?:#.*)?$/) : null;

    if (match?.[1]) {
      values.push(match[1]);
    }
  }

  return values.sort();
}

function parseWorkflowFacts(contents: string): readonly ({ readonly kind: "job" | "step"; readonly name: string })[] {
  const facts: Array<{ readonly kind: "job" | "step"; readonly name: string }> = [];
  let inJobs = false;

  for (const line of contents.split(/\r?\n/)) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }

    if (inJobs && /^\S/.test(line)) {
      break;
    }

    const jobMatch = inJobs ? line.match(/^  ([A-Za-z0-9_.-]+):\s*$/) : null;
    const stepMatch = inJobs ? line.match(/^\s*-\s*name:\s*["']?(.+?)["']?\s*$/) : null;

    if (jobMatch?.[1]) {
      facts.push({ kind: "job", name: jobMatch[1] });
    } else if (stepMatch?.[1]) {
      facts.push({ kind: "step", name: stepMatch[1] });
    }
  }

  return facts;
}

function workflowNameFromContents(contents: string, file: string): string {
  const match = contents.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  return match?.[1] ?? basename(file).replace(/\.(ya?ml)$/u, "");
}

function isConfigurationFile(file: string): boolean {
  const base = basename(file);
  return (
    file === "tsconfig.json" ||
    file.endsWith("/tsconfig.json") ||
    file === "biome.json" ||
    file.endsWith("/biome.json") ||
    base.startsWith(".eslintrc") ||
    base.startsWith("eslint.config.") ||
    base.startsWith(".prettierrc") ||
    base === "prettier.config.js" ||
    base === "prettier.config.cjs" ||
    base === "prettier.config.mjs"
  );
}

function isPackageManifest(file: string): boolean {
  return file === "package.json" || file.endsWith("/package.json");
}

function findOwningPackageId(context: RepositoryFactContext, file: string): string | undefined {
  const directory = normalizePath(dirname(file));
  const candidates = [...context.symbols.values()]
    .filter((symbol) => symbol.kind === "Package" && symbol.metadata?.local === true)
    .map((symbol) => ({
      id: symbol.id,
      path: normalizePath(typeof symbol.metadata?.path === "string" ? symbol.metadata.path : "."),
    }))
    .filter((symbol) => symbol.path === "." || directory === symbol.path || directory.startsWith(`${symbol.path}/`))
    .sort((left, right) => {
      const depth = right.path.length - left.path.length;
      return depth === 0 ? left.id.localeCompare(right.id) : depth;
    });

  return candidates[0]?.id;
}

function configurationName(file: string): string {
  if (file.endsWith("tsconfig.json")) {
    return "tsconfig";
  }

  return basename(file);
}

function configurationKind(file: string): string {
  const base = basename(file);

  if (file.endsWith("tsconfig.json")) {
    return "typescript";
  }

  if (base.includes("eslint")) {
    return "eslint";
  }

  if (base.includes("prettier")) {
    return "prettier";
  }

  if (base === "biome.json") {
    return "biome";
  }

  return "configuration";
}

function readRecord(record: JsonRecord, key: string): JsonRecord {
  const value = record[key];
  return isRecord(value) ? value : {};
}

function readString(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readBoolean(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(record: JsonRecord, key: string): readonly string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").sort() : [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configEvidence(file: string, description: string): EdgeEvidence {
  return {
    kind: "config",
    confidence: "exact",
    span: fileSpan(file),
    description,
  };
}

function fileSpan(file: string): SourceSpan {
  return {
    file,
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1,
  };
}

function compareSymbols(left: CompilerSymbol, right: CompilerSymbol): number {
  return left.id.localeCompare(right.id);
}

function compareRelationships(left: CompilerRelationship, right: CompilerRelationship): number {
  const leftId = left.id ?? createEdgeId(left.type, left.from, left.to);
  const rightId = right.id ?? createEdgeId(right.type, right.from, right.to);
  return leftId.localeCompare(rightId);
}

function compareDiagnostics(left: SoftwareGraphDiagnostic, right: SoftwareGraphDiagnostic): number {
  return left.id.localeCompare(right.id);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
