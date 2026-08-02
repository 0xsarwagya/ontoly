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
  { packageName: "koa", frameworkName: "Koa", category: "http" },
  { packageName: "@koa/router", frameworkName: "Koa", category: "http" },
  { packageName: "koa-router", frameworkName: "Koa", category: "http" },
  { packageName: "elysia", frameworkName: "Elysia", category: "http" },
  { packageName: "next", frameworkName: "Next.js", category: "frontend" },
  { packageName: "react", frameworkName: "React", category: "frontend" },
  { packageName: "react-router", frameworkName: "React Router", category: "frontend-router" },
  { packageName: "react-router-dom", frameworkName: "React Router", category: "frontend-router" },
  { packageName: "@tanstack/react-router", frameworkName: "TanStack Router", category: "frontend-router" },
  { packageName: "@angular/core", frameworkName: "Angular", category: "frontend" },
  { packageName: "@angular/common", frameworkName: "Angular", category: "frontend" },
  { packageName: "@angular/router", frameworkName: "Angular", category: "frontend" },
  { packageName: "vue", frameworkName: "Vue", category: "frontend" },
  { packageName: "vue-router", frameworkName: "Vue Router", category: "frontend-router" },
  { packageName: "nuxt", frameworkName: "Nuxt", category: "frontend" },
  { packageName: "svelte", frameworkName: "Svelte", category: "frontend" },
  { packageName: "@sveltejs/kit", frameworkName: "SvelteKit", category: "frontend" },
  { packageName: "@remix-run/node", frameworkName: "Remix", category: "frontend" },
  { packageName: "@remix-run/react", frameworkName: "Remix", category: "frontend" },
  { packageName: "@remix-run/serve", frameworkName: "Remix", category: "frontend" },
  { packageName: "astro", frameworkName: "Astro", category: "frontend" },
  { packageName: "solid-js", frameworkName: "Solid", category: "frontend" },
  { packageName: "@solidjs/start", frameworkName: "SolidStart", category: "frontend" },
  { packageName: "gatsby", frameworkName: "Gatsby", category: "frontend" },
  { packageName: "@trpc/server", frameworkName: "tRPC", category: "rpc" },
  { packageName: "@trpc/client", frameworkName: "tRPC", category: "rpc" },
  { packageName: "@trpc/react-query", frameworkName: "tRPC", category: "rpc" },
  { packageName: "@prisma/client", frameworkName: "Prisma", category: "database" },
  { packageName: "prisma", frameworkName: "Prisma", category: "database" },
  { packageName: "drizzle-orm", frameworkName: "Drizzle", category: "database" },
  { packageName: "typeorm", frameworkName: "TypeORM", category: "database" },
  { packageName: "mongoose", frameworkName: "Mongoose", category: "database" },
  { packageName: "sequelize", frameworkName: "Sequelize", category: "database" },
  { packageName: "knex", frameworkName: "Knex", category: "database" },
  { packageName: "pinia", frameworkName: "Pinia", category: "state" },
  { packageName: "vuex", frameworkName: "Vuex", category: "state" },
  { packageName: "@reduxjs/toolkit", frameworkName: "Redux Toolkit", category: "state" },
  { packageName: "redux", frameworkName: "Redux", category: "state" },
  { packageName: "zustand", frameworkName: "Zustand", category: "state" },
  { packageName: "jotai", frameworkName: "Jotai", category: "state" },
  { packageName: "recoil", frameworkName: "Recoil", category: "state" },
  { packageName: "mobx", frameworkName: "MobX", category: "state" },
  { packageName: "django", frameworkName: "Django", category: "http" },
  { packageName: "djangorestframework", frameworkName: "Django REST Framework", category: "http" },
  { packageName: "fastapi", frameworkName: "FastAPI", category: "http" },
  { packageName: "flask", frameworkName: "Flask", category: "http" },
  { packageName: "starlette", frameworkName: "Starlette", category: "http" },
  { packageName: "tornado", frameworkName: "Tornado", category: "http" },
  { packageName: "aiohttp", frameworkName: "aiohttp", category: "http" },
  { packageName: "sanic", frameworkName: "Sanic", category: "http" },
  { packageName: "sqlalchemy", frameworkName: "SQLAlchemy", category: "database" },
  { packageName: "alembic", frameworkName: "Alembic", category: "database" },
  { packageName: "tortoise-orm", frameworkName: "Tortoise ORM", category: "database" },
  { packageName: "pydantic", frameworkName: "Pydantic", category: "validation" },
  { packageName: "celery", frameworkName: "Celery", category: "task-queue" },
  { packageName: "pytest", frameworkName: "pytest", category: "testing" },
  { packageName: "torch", frameworkName: "PyTorch", category: "ml" },
  { packageName: "torchvision", frameworkName: "PyTorch", category: "ml" },
  { packageName: "torchaudio", frameworkName: "PyTorch", category: "ml" },
  { packageName: "pytorch-lightning", frameworkName: "PyTorch Lightning", category: "ml" },
  { packageName: "lightning", frameworkName: "PyTorch Lightning", category: "ml" },
  { packageName: "tensorflow", frameworkName: "TensorFlow", category: "ml" },
  { packageName: "keras", frameworkName: "Keras", category: "ml" },
  { packageName: "tf-keras", frameworkName: "Keras", category: "ml" },
  { packageName: "transformers", frameworkName: "HuggingFace Transformers", category: "ml" },
  { packageName: "datasets", frameworkName: "HuggingFace Datasets", category: "ml" },
  { packageName: "diffusers", frameworkName: "HuggingFace Diffusers", category: "ml" },
  { packageName: "accelerate", frameworkName: "HuggingFace Accelerate", category: "ml" },
  { packageName: "peft", frameworkName: "HuggingFace PEFT", category: "ml" },
  { packageName: "trl", frameworkName: "HuggingFace TRL", category: "ml" },
  { packageName: "scikit-learn", frameworkName: "scikit-learn", category: "ml" },
  { packageName: "sklearn", frameworkName: "scikit-learn", category: "ml" },
  { packageName: "jax", frameworkName: "JAX", category: "ml" },
  { packageName: "flax", frameworkName: "Flax", category: "ml" },
  { packageName: "optax", frameworkName: "Optax", category: "ml" },
  { packageName: "xgboost", frameworkName: "XGBoost", category: "ml" },
  { packageName: "lightgbm", frameworkName: "LightGBM", category: "ml" },
  { packageName: "onnx", frameworkName: "ONNX", category: "ml" },
  { packageName: "onnxruntime", frameworkName: "ONNX Runtime", category: "ml" },
  // Go
  { packageName: "github.com/gin-gonic/gin", frameworkName: "Gin", category: "http" },
  { packageName: "github.com/labstack/echo", frameworkName: "Echo", category: "http" },
  { packageName: "github.com/gofiber/fiber", frameworkName: "Fiber", category: "http" },
  { packageName: "github.com/gorilla/mux", frameworkName: "Gorilla Mux", category: "http" },
  { packageName: "github.com/go-chi/chi", frameworkName: "Chi", category: "http" },
  { packageName: "google.golang.org/grpc", frameworkName: "gRPC", category: "rpc" },
  { packageName: "github.com/graphql-go/graphql", frameworkName: "GraphQL-Go", category: "rpc" },
  { packageName: "gorm.io/gorm", frameworkName: "GORM", category: "database" },
  { packageName: "github.com/jmoiron/sqlx", frameworkName: "sqlx", category: "database" },
  { packageName: "go.uber.org/zap", frameworkName: "Zap", category: "logging" },
  { packageName: "github.com/sirupsen/logrus", frameworkName: "Logrus", category: "logging" },
  { packageName: "github.com/stretchr/testify", frameworkName: "Testify", category: "testing" },
  // Rust
  { packageName: "actix-web", frameworkName: "Actix-web", category: "http" },
  { packageName: "axum", frameworkName: "Axum", category: "http" },
  { packageName: "rocket", frameworkName: "Rocket", category: "http" },
  { packageName: "warp", frameworkName: "Warp", category: "http" },
  { packageName: "tonic", frameworkName: "Tonic gRPC", category: "rpc" },
  { packageName: "diesel", frameworkName: "Diesel", category: "database" },
  { packageName: "sqlx", frameworkName: "SQLx", category: "database" },
  { packageName: "sea-orm", frameworkName: "SeaORM", category: "database" },
  { packageName: "tokio", frameworkName: "Tokio", category: "runtime" },
  { packageName: "serde", frameworkName: "Serde", category: "serialization" },
  { packageName: "clap", frameworkName: "Clap", category: "cli" },
  // Java / Kotlin
  { packageName: "org.springframework.boot", frameworkName: "Spring Boot", category: "http" },
  { packageName: "org.springframework", frameworkName: "Spring", category: "http" },
  { packageName: "io.quarkus", frameworkName: "Quarkus", category: "http" },
  { packageName: "io.micronaut", frameworkName: "Micronaut", category: "http" },
  { packageName: "io.vertx", frameworkName: "Vert.x", category: "http" },
  { packageName: "org.hibernate", frameworkName: "Hibernate", category: "database" },
  { packageName: "org.mybatis", frameworkName: "MyBatis", category: "database" },
  { packageName: "io.ktor", frameworkName: "Ktor", category: "http" },
  { packageName: "org.jetbrains.exposed", frameworkName: "Exposed", category: "database" },
  // Ruby
  { packageName: "rails", frameworkName: "Rails", category: "http" },
  { packageName: "sinatra", frameworkName: "Sinatra", category: "http" },
  { packageName: "hanami", frameworkName: "Hanami", category: "http" },
  { packageName: "grape", frameworkName: "Grape", category: "http" },
  { packageName: "activerecord", frameworkName: "ActiveRecord", category: "database" },
  { packageName: "sequel", frameworkName: "Sequel", category: "database" },
  { packageName: "rspec", frameworkName: "RSpec", category: "testing" },
  { packageName: "sidekiq", frameworkName: "Sidekiq", category: "task-queue" },
];

export function createRepositoryIntelligencePass(options: {
  readonly id?: string | undefined;
} = {}): CompilerPass {
  const passId = options.id ?? REPOSITORY_INTELLIGENCE_PASS_ID;

  return {
    id: passId,
    version: REPOSITORY_INTELLIGENCE_VERSION,
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

      const manifests = files.filter((f) => isPackageManifest(f) || isMultiLanguageManifest(f));
      for (const file of manifests) {
        await collectRepositoryFileFacts(repositoryContext, file);
      }

      for (const file of files.filter((f) => !isPackageManifest(f) && !isMultiLanguageManifest(f))) {
        await collectRepositoryFileFacts(repositoryContext, file);
      }

      // After per-file fact collection, rewire cross-file turbo `dependsOn`
      // edges that were emitted as stubs (see collectTurboFacts) to point at
      // the real Task node when we now have both sides indexed.
      resolveExternalTurboReferences(repositoryContext);

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

  if (normalizedFile === "turbo.json" || normalizedFile.endsWith("/turbo.json")) {
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

  if (normalizedFile === "go.mod" || normalizedFile.endsWith("/go.mod")) {
    await collectGoModFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "Cargo.toml" || normalizedFile.endsWith("/Cargo.toml")) {
    await collectCargoFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "pyproject.toml" || normalizedFile.endsWith("/pyproject.toml")) {
    await collectPyprojectFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "requirements.txt" || normalizedFile.endsWith("/requirements.txt")) {
    await collectRequirementsTxtFacts(context, normalizedFile);
    return;
  }

  if (basename(normalizedFile) === "pom.xml") {
    await collectMavenFacts(context, normalizedFile);
    return;
  }

  if (/\bbuild\.gradle(\.kts)?$/.test(basename(normalizedFile))) {
    await collectGradleFacts(context, normalizedFile);
    return;
  }

  if (normalizedFile === "Gemfile" || normalizedFile.endsWith("/Gemfile")) {
    await collectGemfileFacts(context, normalizedFile);
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

// Second-pass resolution for the external Task stubs emitted by
// collectTurboFacts. After every turbo.json and package.json has been
// collected, we have enough context to rewire cross-file DEPENDS_ON edges
// to point at the actual Task node when the target lives inside this
// workspace. Two of the three cross-file kinds are resolved here:
//
//   - `pkg#task`   — look up `pkg`'s package directory, then its turbo.json,
//                    then the task named `task` there.
//   - `//#task`    — look up the root workspace's turbo.json and its `task`.
//
// The third kind, `^task`, means "the `task` task in each of the current
// package's dependencies" — one stub fans out to N real edges. Resolving
// that requires enumerating the source package's dependency list (across
// dependencies/devDependencies/peerDependencies) and cross-checking each
// against the workspace Package index. Not implemented here; the stub +
// stub-targeted edge remain in place, which is a correct fallback (option
// B behavior from #16).
//
// When resolution succeeds, the DEPENDS_ON edge is rewritten to point at
// the real Task node and its metadata carries:
//   - `resolved: true`            — this edge was originally external
//   - `kind: <upstream|cross-package|root>` — preserved for filtering
//   - `stubId: <original stub id>` — so downstream can inspect the stub
// The stub Task node itself is left in the graph as historical inventory
// of what external references were seen.
function resolveExternalTurboReferences(context: RepositoryFactContext): void {
  const symbols = context.symbols;
  const relationships = context.relationships;

  // Index all real (non-external) Task nodes by their turbo.json file and
  // task name, so a `pkg#task` / `//#task` lookup is O(1).
  const tasksByFile = new Map<string, Map<string, string>>();
  for (const symbol of symbols.values()) {
    if (symbol.kind !== "Task") continue;
    if (symbol.metadata?.external === true) continue;
    if (!symbol.file) continue;
    // Task nodes also come from package.json scripts (kind: 'Task', name:
    // '<pkg>:<script>'). Turbo's `pkg#task` refers only to tasks in a
    // turbo.json, not package.json scripts — narrow accordingly.
    if (!symbol.file.endsWith("turbo.json")) continue;
    let taskMap = tasksByFile.get(symbol.file);
    if (!taskMap) {
      taskMap = new Map();
      tasksByFile.set(symbol.file, taskMap);
    }
    taskMap.set(symbol.name, symbol.id);
  }

  // Map each local Package to its turbo.json path (if the package has one).
  const turboFileByPackageName = new Map<string, string>();
  for (const symbol of symbols.values()) {
    if (symbol.kind !== "Package") continue;
    if (symbol.metadata?.local !== true) continue;
    const rawPath = symbol.metadata?.path;
    const packageDir = typeof rawPath === "string" && rawPath !== "." ? rawPath : "";
    const turboPath = packageDir ? `${packageDir}/turbo.json` : "turbo.json";
    if (tasksByFile.has(turboPath)) {
      turboFileByPackageName.set(symbol.name, turboPath);
    }
  }

  const rootTurboFile = tasksByFile.has("turbo.json") ? "turbo.json" : undefined;

  // Walk existing DEPENDS_ON edges that point at external stubs and rewrite
  // them where possible. Collect first, then mutate, so we don't invalidate
  // the iterator.
  const rewrites: Array<{ readonly oldId: string; readonly newEdgeId: string; readonly newEdge: CompilerRelationship }> = [];
  for (const [edgeId, edge] of relationships) {
    if (edge.type !== "DEPENDS_ON") continue;
    if (edge.metadata?.external !== true) continue;
    const stub = symbols.get(edge.to);
    if (!stub || stub.metadata?.external !== true) continue;

    const stubKind = stub.metadata.kind;
    const stubTaskName = typeof stub.metadata.task === "string" ? stub.metadata.task : undefined;
    if (!stubTaskName) continue;

    let targetFile: string | undefined;
    if (stubKind === "cross-package") {
      const pkg = typeof stub.metadata.package === "string" ? stub.metadata.package : undefined;
      if (pkg) {
        targetFile = turboFileByPackageName.get(pkg);
      }
    } else if (stubKind === "root") {
      targetFile = rootTurboFile;
    }
    // Upstream (`^task`) resolution is deliberately not attempted here;
    // the stub-pointing edge stays as the option-B fallback.
    if (!targetFile) continue;

    const realTaskId = tasksByFile.get(targetFile)?.get(stubTaskName);
    if (!realTaskId) continue;

    const newEdgeId = createEdgeId("DEPENDS_ON", edge.from, realTaskId);
    const oldMetadata = edge.metadata ?? {};
    rewrites.push({
      oldId: edgeId,
      newEdgeId,
      newEdge: {
        ...edge,
        id: newEdgeId,
        to: realTaskId,
        metadata: {
          dependency: typeof oldMetadata.dependency === "string" ? oldMetadata.dependency : undefined,
          kind: typeof oldMetadata.kind === "string" ? oldMetadata.kind : undefined,
          resolved: true,
          stubId: edge.to,
        },
      },
    });
  }

  for (const { oldId, newEdgeId, newEdge } of rewrites) {
    // If an identically-shaped resolved edge already exists (shouldn't in
    // practice, but be defensive), let the existing one win.
    if (!relationships.has(newEdgeId)) {
      relationships.set(newEdgeId, newEdge);
    }
    relationships.delete(oldId);
  }
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

// ═══════════════════════════════════════════════════════════════════
//  Multi-language manifest collectors
// ═══════════════════════════════════════════════════════════════════

async function collectGoModFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  if (!contents) return;

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const moduleMatch = contents.match(/^module\s+(\S+)/m);
  const moduleName = moduleMatch?.[1] ?? (packageDirectory ? basename(packageDirectory) : "go-module");
  const goVersionMatch = contents.match(/^go\s+(\S+)/m);
  const packageId = createNodeId({ type: "Package", name: moduleName });
  const configId = addConfigurationNode(context, file, "go.mod", "package-manifest");

  addSymbol(context, {
    id: packageId,
    kind: "Package",
    name: moduleName,
    file,
    metadata: {
      local: true,
      path: packageDirectory || ".",
      language: "go",
      goVersion: goVersionMatch?.[1],
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains Go module");
  addRelationship(context, "CONFIGURES", configId, packageId, file, "go.mod configures Go module");

  const requireBlock = contents.match(/require\s*\(([\s\S]*?)\)/g);
  const singleRequires = contents.match(/^require\s+(\S+)\s+\S+/gm);
  const deps: string[] = [];

  if (requireBlock) {
    for (const block of requireBlock) {
      const inner = block.replace(/^require\s*\(/, "").replace(/\)$/, "");
      for (const line of inner.split("\n")) {
        const m = line.trim().match(/^(\S+)\s+\S+/);
        if (m?.[1] && !m[1].startsWith("//")) deps.push(m[1]);
      }
    }
  }
  if (singleRequires) {
    for (const line of singleRequires) {
      const m = line.match(/^require\s+(\S+)/);
      if (m?.[1]) deps.push(m[1]);
    }
  }

  for (const depName of [...new Set(deps)].sort()) {
    const depId = createNodeId({ type: "Dependency", name: depName });
    addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "go" } });
    addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Go module requires ${depName}`, { dependencyType: "dependencies" });
    collectFrameworkDependency(context, packageId, depId, depName, file);
  }
}

async function collectCargoFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  if (!contents) return;

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const crateName = parseTomlValue(contents, "package", "name") ?? (packageDirectory ? basename(packageDirectory) : "crate");
  const crateVersion = parseTomlValue(contents, "package", "version");
  const edition = parseTomlValue(contents, "package", "edition");
  const packageId = createNodeId({ type: "Package", name: crateName });
  const configId = addConfigurationNode(context, file, "Cargo.toml", "package-manifest");

  addSymbol(context, {
    id: packageId,
    kind: "Package",
    name: crateName,
    file,
    metadata: {
      local: true,
      path: packageDirectory || ".",
      language: "rust",
      version: crateVersion,
      edition,
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains Rust crate");
  addRelationship(context, "CONFIGURES", configId, packageId, file, "Cargo.toml configures Rust crate");

  const workspaceMembers = parseTomlArray(contents, "workspace", "members");
  if (workspaceMembers.length > 0) {
    addRelationship(context, "CONFIGURES", configId, context.workspaceId, file, "Cargo workspace configures workspace", {
      packagePatterns: [...workspaceMembers],
    });
  }

  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"] as const) {
    const deps = parseTomlSection(contents, section);
    for (const depName of [...new Set(deps)].sort()) {
      const depId = createNodeId({ type: "Dependency", name: depName });
      addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "rust" } });
      addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Rust crate ${section} includes ${depName}`, {
        dependencyType: section,
      });
      collectFrameworkDependency(context, packageId, depId, depName, file);
    }
  }
}

async function collectPyprojectFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  if (!contents) return;

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const projectName = parseTomlValue(contents, "project", "name") ?? (packageDirectory ? basename(packageDirectory) : "python-project");
  const projectVersion = parseTomlValue(contents, "project", "version");
  const pythonRequires = parseTomlValue(contents, "project", "requires-python");
  const packageId = createNodeId({ type: "Package", name: projectName });
  const configId = addConfigurationNode(context, file, "pyproject.toml", "package-manifest");

  addSymbol(context, {
    id: packageId,
    kind: "Package",
    name: projectName,
    file,
    metadata: {
      local: true,
      path: packageDirectory || ".",
      language: "python",
      version: projectVersion,
      pythonRequires,
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains Python project");
  addRelationship(context, "CONFIGURES", configId, packageId, file, "pyproject.toml configures Python project");

  const deps = parseTomlArray(contents, "project", "dependencies");
  for (const raw of deps) {
    const depName = raw.replace(/[<>=!~\[;].*/u, "").trim().toLowerCase();
    if (!depName) continue;
    const depId = createNodeId({ type: "Dependency", name: depName });
    addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "python" } });
    addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Python project depends on ${depName}`, {
      dependencyType: "dependencies",
    });
    collectFrameworkDependency(context, packageId, depId, depName, file);
  }

  const devDeps = parseTomlArray(contents, "project.optional-dependencies", "dev");
  for (const raw of devDeps) {
    const depName = raw.replace(/[<>=!~\[;].*/u, "").trim().toLowerCase();
    if (!depName) continue;
    const depId = createNodeId({ type: "Dependency", name: depName });
    addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "python" } });
    addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Python project dev-dep ${depName}`, {
      dependencyType: "devDependencies",
    });
    collectFrameworkDependency(context, packageId, depId, depName, file);
  }
}

async function collectRequirementsTxtFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  if (!contents) return;

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const packageName = packageDirectory ? basename(packageDirectory) : "python-project";
  const packageId = createNodeId({ type: "Package", name: packageName });
  const configId = addConfigurationNode(context, file, "requirements.txt", "package-manifest");

  if (!context.symbols.has(packageId)) {
    addSymbol(context, {
      id: packageId,
      kind: "Package",
      name: packageName,
      file,
      metadata: {
        local: true,
        path: packageDirectory || ".",
        language: "python",
      },
    });
    addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains Python project");
  }
  addRelationship(context, "CONFIGURES", configId, packageId, file, "requirements.txt configures Python project");

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const depName = trimmed.replace(/[<>=!~\[;].*/u, "").trim().toLowerCase();
    if (!depName) continue;
    const depId = createNodeId({ type: "Dependency", name: depName });
    addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "python" } });
    addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Python project depends on ${depName}`, {
      dependencyType: "dependencies",
    });
    collectFrameworkDependency(context, packageId, depId, depName, file);
  }
}

async function collectMavenFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  if (!contents) return;

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const groupId = contents.match(/<groupId>([^<]+)<\/groupId>/)?.[1];
  const artifactId = contents.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1];
  const mavenName = groupId && artifactId ? `${groupId}:${artifactId}` : (artifactId ?? (packageDirectory ? basename(packageDirectory) : "maven-project"));
  const version = contents.match(/<version>([^<]+)<\/version>/)?.[1];
  const packageId = createNodeId({ type: "Package", name: mavenName });
  const configId = addConfigurationNode(context, file, "pom.xml", "package-manifest");

  const isKotlin = /<kotlin\.version>/.test(contents) || /kotlin-maven-plugin/.test(contents);

  addSymbol(context, {
    id: packageId,
    kind: "Package",
    name: mavenName,
    file,
    metadata: {
      local: true,
      path: packageDirectory || ".",
      language: isKotlin ? "kotlin" : "java",
      version,
      groupId,
      artifactId,
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains Maven project");
  addRelationship(context, "CONFIGURES", configId, packageId, file, "pom.xml configures Maven project");

  const modules = [...contents.matchAll(/<module>([^<]+)<\/module>/g)].map((m) => m[1]).filter((v): v is string => v !== undefined);
  if (modules.length > 0) {
    addRelationship(context, "CONFIGURES", configId, context.workspaceId, file, "Maven parent configures workspace", {
      packagePatterns: modules,
    });
  }

  const depBlock = contents.match(/<dependencies>([\s\S]*?)<\/dependencies>/);
  if (depBlock?.[1]) {
    const depEntries = [...depBlock[1].matchAll(/<dependency>[\s\S]*?<groupId>([^<]+)<\/groupId>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?<\/dependency>/g)];
    for (const m of depEntries) {
      const gId = m[1] ?? "";
      const aId = m[2] ?? "";
      if (!gId || !aId) continue;
      const depName = `${gId}:${aId}`;
      const depId = createNodeId({ type: "Dependency", name: depName });
      addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "java" } });
      addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Maven project depends on ${depName}`, {
        dependencyType: "dependencies",
      });
      collectFrameworkDependency(context, packageId, depId, gId, file);
    }
  }
}

async function collectGradleFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  if (!contents) return;

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const isKts = file.endsWith(".kts");
  const projectName = packageDirectory ? basename(packageDirectory) : "gradle-project";
  const packageId = createNodeId({ type: "Package", name: projectName });
  const configId = addConfigurationNode(context, file, basename(file), "package-manifest");

  const isKotlin = isKts || /\bkotlin\b/.test(contents) || /org\.jetbrains\.kotlin/.test(contents);

  addSymbol(context, {
    id: packageId,
    kind: "Package",
    name: projectName,
    file,
    metadata: {
      local: true,
      path: packageDirectory || ".",
      language: isKotlin ? "kotlin" : "java",
      buildTool: "gradle",
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains Gradle project");
  addRelationship(context, "CONFIGURES", configId, packageId, file, "build.gradle configures Gradle project");

  const depPatterns = isKts
    ? /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*\(\s*"([^"]+)"\s*\)/g
    : /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s+['"]([^'"]+)['"]/g;
  for (const m of contents.matchAll(depPatterns)) {
    const raw = m[1];
    if (!raw) continue;
    const parts = raw.split(":");
    if (parts.length < 2) continue;
    const depName = `${parts[0]}:${parts[1]}`;
    const depId = createNodeId({ type: "Dependency", name: depName });
    addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "java" } });
    addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Gradle project depends on ${depName}`, {
      dependencyType: "dependencies",
    });
    collectFrameworkDependency(context, packageId, depId, parts[0] ?? "", file);
  }
}

async function collectGemfileFacts(context: RepositoryFactContext, file: string): Promise<void> {
  const contents = await readUtf8(context, file);
  if (!contents) return;

  const packageDirectory = dirname(file) === "." ? "" : dirname(file);
  const projectName = packageDirectory ? basename(packageDirectory) : "ruby-project";
  const packageId = createNodeId({ type: "Package", name: projectName });
  const configId = addConfigurationNode(context, file, "Gemfile", "package-manifest");

  addSymbol(context, {
    id: packageId,
    kind: "Package",
    name: projectName,
    file,
    metadata: {
      local: true,
      path: packageDirectory || ".",
      language: "ruby",
    },
  });
  addRelationship(context, "CONTAINS", context.workspaceId, packageId, file, "workspace contains Ruby project");
  addRelationship(context, "CONFIGURES", configId, packageId, file, "Gemfile configures Ruby project");

  for (const m of contents.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)) {
    const depName = m[1] ?? "";
    if (!depName) continue;
    const depId = createNodeId({ type: "Dependency", name: depName });
    addSymbol(context, { id: depId, kind: "Dependency", name: depName, metadata: { language: "ruby" } });
    addRelationship(context, "DEPENDS_ON", packageId, depId, file, `Gemfile includes ${depName}`, {
      dependencyType: "dependencies",
    });
    collectFrameworkDependency(context, packageId, depId, depName, file);
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
      detectedBy: "dependency",
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

function parseTomlValue(contents: string, section: string, key: string): string | undefined {
  const sectionHeader = section.includes(".") ? `\\[${section.replace(/\./g, "\\.")}\\]` : `\\[${section}\\]`;
  const sectionMatch = contents.match(new RegExp(`^${sectionHeader}\\s*$`, "m"));
  if (!sectionMatch) return undefined;
  const afterSection = contents.slice(sectionMatch.index! + sectionMatch[0].length);
  const nextSection = afterSection.search(/^\[/m);
  const block = nextSection >= 0 ? afterSection.slice(0, nextSection) : afterSection;
  const keyMatch = block.match(new RegExp(`^${escapeRegExp(key)}\\s*=\\s*"([^"]*)"`, "m"));
  return keyMatch?.[1];
}

function parseTomlArray(contents: string, section: string, key: string): readonly string[] {
  const sectionHeader = section.includes(".") ? `\\[${section.replace(/\./g, "\\.")}\\]` : `\\[${section}\\]`;
  const sectionMatch = contents.match(new RegExp(`^${sectionHeader}\\s*$`, "m"));
  if (!sectionMatch) return [];
  const afterSection = contents.slice(sectionMatch.index! + sectionMatch[0].length);
  const nextSection = afterSection.search(/^\[/m);
  const block = nextSection >= 0 ? afterSection.slice(0, nextSection) : afterSection;
  const keyMatch = block.match(new RegExp(`^${escapeRegExp(key)}\\s*=\\s*\\[([^\\]]*(?:\\n[^\\]]*)*?)\\]`, "m"));
  if (!keyMatch?.[1]) return [];
  return [...keyMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((v): v is string => v !== undefined);
}

function parseTomlSection(contents: string, section: string): readonly string[] {
  const sectionMatch = contents.match(new RegExp(`^\\[${escapeRegExp(section)}\\]\\s*$`, "m"));
  if (!sectionMatch) return [];
  const afterSection = contents.slice(sectionMatch.index! + sectionMatch[0].length);
  const nextSection = afterSection.search(/^\[/m);
  const block = nextSection >= 0 ? afterSection.slice(0, nextSection) : afterSection;
  return [...block.matchAll(/^([a-zA-Z0-9_-]+)\s*=/gm)].map((m) => m[1]).filter((v): v is string => v !== undefined);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMultiLanguageManifest(file: string): boolean {
  const base = basename(file);
  return (
    base === "go.mod" ||
    base === "Cargo.toml" ||
    base === "pyproject.toml" ||
    base === "requirements.txt" ||
    base === "pom.xml" ||
    base === "build.gradle" ||
    base === "build.gradle.kts" ||
    base === "Gemfile"
  );
}
