# Changelog

All notable Ontoly changes are tracked here.

## Unreleased

### Fixed

- **Queries read the graph `ontoly build` wrote.** `ontoly build` writes its artifacts to `ontoly-output` by default, but `search`, `query`, `impact`, `trace`, `explain`, `mcp`, `semantic` and `frameworks` looked in `.ontoly`. So every command silently rebuilt the whole graph and its semantic index in memory. They now read the directory holding the newest Software Graph, and `--output` still wins. On a 3,148-file NestJS repository, `ontoly search` went from 49.3 s and 2.5 GB to 3.3 s, and `stats` takes 1.0 s. When no graph is found, the command says so before building one in memory.
- **`ontoly doctor` finds the graph in `ontoly-output`** and no longer recommends a build that already happened.
- **`ontoly skills validate --global` validates the skills your agent loads.** Before, the command only looked in the project's `skills/` or `.agents/skills/` folder, so skills installed with `npx skills add -g` could not be validated. `--global` checks `~/.claude/skills`, `~/.agents/skills` and `~/.codex/skills`, follows linked skill folders, and prints one result per folder.
  - Only skills with `ontoly.*` metadata are validated. Other skills in an installed folder, including a project's `.agents/skills/`, are ignored instead of failing validation.
  - A skill whose `ontoly.min.version` is newer than the running CLI fails validation.
- **`ontoly skills validate` and `ontoly skills doctor` no longer create `validation/skills/` in the current directory.** Reports are written only with `--output <dir>`. `pnpm skills:validate` passes `--output validation/skills`, so the repository's tracked reports are still refreshed.
- **Artifacts no longer have to fit in one string.** Large JSON artifacts are now streamed to disk as compact JSON, member by member: the graph, semantic index, indexes, node, relationship and community files, reports, and the compiler cache. Before, each was built as one indented string first, which threw `Invalid string length` once it passed V8's maximum string length, about 512 MB. Output is byte-identical to `JSON.stringify`, and `manifest.json`, `metadata.json` and `statistics.json` stay indented.
  - `graph.json` is now a hard link to `SoftwareGraph.json` (a copy where links are unsupported), not a second copy.
  - Loading the semantic index reuses the graph the command already holds instead of parsing it again.

  On the same 3,148-file repository:
  - full build: peak memory 4.24 GB → 2.98 GB, bundle 720 MB → 494 MB, 54.9 s → 50.5 s;
  - `ontoly search`: 1.59 GB → 0.85 GB.
- **Query targets match exact names before free text.** `ontoly query`, `trace`, `inspect`, `impact` and `request-trace` now resolve a target in tiers: the exact node id, then an exact name, then free text (`impact` and the other capabilities use semantic ranking at that last step). An exact name is qualified (`Class.method`, a file path, `POST /path`) or bare (a function, the method in `Class.method`, a route path). Before, a bare method name such as `backfillLastNight` never matched its `Class.method` node, so the first free-text match won, even a function in another file that never mentions the method.
  - When several nodes match at the best tier, the CLI fails with `ONTOLY1003` and capabilities report `CAPABILITY_AMBIGUOUS_TARGET`, both listing the candidate ids. Before, the CLI used the first match, and `impact` could pick an unrelated node by semantic rank.
  - An Import or Export statement no longer wins over the declaration it names, so `ontoly query callers` on an exported function reports the function's callers instead of nothing. The Class, Service and Provider nodes of one declaration still resolve to one node.
- **`ontoly request-trace` accepts `POST /path`, `POST:/path` and `/path`.** The method is case-insensitive, and `/path` resolves when one route has that path. A path shared by several routes lists them, and `GET /path` no longer falls back to free text, which could match a route with another method.

- **The semantic index is built once per graph, and 3.6 times faster.** `ontoly mcp` rebuilt it from scratch on every search and capability request, and so did every capability engine: about 22 s per request on a 3,148-file repository. Each graph now builds or loads its index once and reuses it, and `ontoly mcp` loads the persisted index when it starts. Tokenizing is cached while an index is built or a query is ranked, so on the same repository:
  - building the index: 26.2 s → 7.2 s, with byte-identical output;
  - `ontoly search`: 1.7 s → 0.4 s of ranking, 3.4 s → 1.8 s end to end;
  - MCP searches and capabilities: 0.3 to 0.5 s each.

- **Warm builds are 27% faster, with byte-identical output.** On a 3,148-file repository, an unchanged `ontoly build .` went from 17.2 s to 12.5 s:
  - a cache hit no longer rewrites and rehashes the compiler snapshot it has just verified, about 130 MB;
  - splitting nodes and relationships by type copied each group once per element, a quadratic pass that took 0.9 s on 72,000 relationships;
  - `stableStringify`, behind every graph and index hash, sorts each object shape's keys once;
  - building the semantic index checks alias noise only until it has the 20 aliases it keeps, and stops sorting terms whose order can't matter: 7.2 s → 6.0 s.

### Changed

- **Releases publish with npm trusted publishing.** The publish workflow authenticates to npm with the GitHub Actions OIDC token instead of a stored `NPM_TOKEN`, so there is no publish token to rotate or to expire mid-release. Packages are packed with pnpm, which resolves `workspace:` dependencies, and published with npm 11, which supports trusted publishing. `NPM_TOKEN` remains a fallback until every package trusts the workflow, and the redundant `npm access` step, which needs a token, is gone.
- **`index.json` refers to entries by offset.** In the semantic index file, postings, vocabulary node ids and neighbor ids now hold positions in `entryIds` instead of repeating each stable id, which averaged 70 characters. On a 3,148-file repository the file shrinks from 138.6 MB to 70.7 MB and reads in half the time, and `ontoly search` peaks at 0.73 GB instead of 1.21 GB. Ontoly reads both forms, so existing bundles keep working. Tools that read `index.json` directly should map numbers through `entryIds`.
- **The output bundle stores each node and relationship once.** On a 3,148-file repository it shrinks from 447 MB to 336 MB, and the bundle manifest's `version` is now `2.0.0`:
  - `nodes/all.json` and `relationships/all.json` are gone. They repeated `SoftwareGraph.json`, whose `nodes` and `edges` are the same lists; `nodes/by-type/` and `relationships/by-type/` remain.
  - Community files list their members as `nodeIds` and `edgeIds` instead of embedding every node and edge; look the records up in `SoftwareGraph.json`. The largest one went from 47.8 MB to 3.7 MB. Counts, types and representative nodes are unchanged.
  - Splitting the graph into communities filtered the whole graph once per community. It now buckets nodes and relationships in one pass, so graphs with many disconnected parts no longer take quadratic time.

### Security

- Updated Next.js from 16.2.12 to 16.3.8 and `@next/mdx` from 16.2.10 to 16.3.8 (site), fixing the critical Next.js advisories GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4 and GHSA-vcvr-r3jv-pc5j.
- Refreshed the site's transitive `sharp` (0.35.5), `nanoid` (3.3.20), `source-map-js` (1.2.2) and `baseline-browser-mapping` (2.11.27) to patched versions within their existing ranges.

## 1.3.4

### Fixed

- **File discovery honours `.gitignore`.** Inside a Git work tree, the compiler lists files the way Git does (`git ls-files --cached --others --exclude-standard`). Gitignored build output and generated code are no longer indexed, and nested repositories, such as submodules or worktrees checked out inside the tree, are skipped. The fixed skip list and `exclude` still apply on top. Outside Git, the directory walk is unchanged.
- **`ontoly.config.*` is loaded.** With no config path given, the compiler now looks for `ontoly.config.ts`, `.mts`, `.mjs` or `.js` in the repository root, so `exclude`, `parsers` and the other fields take effect in `ontoly build`. Before, no config was read unless a path was passed, and a `.ts` config never was. A TypeScript config needs Node.js 22.18 or later.
  - A config found in the root that cannot be loaded warns (`ONTOLY_CONFIG_NOT_LOADED`) and the build uses the defaults.
  - A config given by path that cannot be loaded throws.
- **`ontoly init` writes a config that loads without a local install.** The generated `ontoly.config.ts` imports `OntolyConfig` as a type only, so a globally installed CLI can load it.

## 1.3.3

### Fixed

- **False-positive `TYPESCRIPT_BROKEN_IMPORT` on non-source files** — `resolveImport()` now accepts imports that TypeScript resolves to real files on disk (`.json`, `.css`, `.scss`, `.svg`, `.wasm`, etc.) even when they are not in the analyzed source set. Previously, any import target not in `relativeFiles` was flagged as broken.
- **Diagnostic tripling in capabilities** — `repositoryHealth` and `riskAnalysis` capabilities no longer re-emit all compiler diagnostics as their own findings. Diagnostics are now counted in statistics instead of duplicated.

## 1.3.2

### Fixed

- **Per-file tsconfig resolution for multi-project repos** — import resolution now finds the nearest `tsconfig.build.json` or `tsconfig.json` per source file directory instead of using only the root config. Monorepos with separate tsconfigs per app/lib (e.g. `apps/api/tsconfig.build.json` with different path mappings) no longer produce false-positive `TYPESCRIPT_BROKEN_IMPORT` findings.

## 1.3.1

### Fixed

- **`TYPESCRIPT_BROKEN_IMPORT` false positives on NestJS projects** — `loadProjectCompilerOptions` now checks `tsconfig.build.json` first, then `tsconfig.json`, then `jsconfig.json`. Projects using NestJS conventions with path mappings in `tsconfig.build.json` no longer produce spurious broken-import findings.

## 1.3.0

### Added

- **`GUARDS` relationship type** in `@0xsarwagya/ontoly-core` — represents a guard protecting a route.
- **Guard-to-route edge propagation** in `@0xsarwagya/ontoly-semantic` — `@UseGuards()` decorators now create `GUARDS` edges directly on route nodes, not just on handlers/controllers. Downstream tools can check `incoming(route)` for guard protection without traversing through handlers.

## 1.2.0

Go language support — the third language in Ontoly. Validated across 3 real-world
Go repositories (gin-examples, fzf, gorm): 178 files, 3,789 symbols, 11,009
relationships, 132 semantic facts, zero parse errors.

### Added

- **Go language support** via tree-sitter-go.
  - **`@0xsarwagya/ontoly-go`**: tree-sitter-based Go semantic model analyzer.
    Extracts packages, structs (with embedded types and struct tags), interfaces,
    functions, methods (with value/pointer receivers), imports (aliased, side-effect,
    dot), constants, variables, type aliases, call expressions (including goroutines),
    and Go 1.18+ generics type parameters.
  - **`@0xsarwagya/ontoly-semantic-go`**: Go semantic bridge converting
    `GoProject` into `CompilerSymbol`/`CompilerRelationship` artifacts, plus
    6 Go framework analyzers:
    - **Gin** — route, handler, middleware, route-group detection
    - **Echo** — route, handler, middleware, route-group detection
    - **Fiber** — route, handler, middleware, route-group detection
    - **Chi** — route, middleware, mount/route-group detection
    - **gRPC** — service implementation, interceptor, server detection
    - **GORM** — model (via embedded `gorm.Model` or `gorm:` tags), connection,
      migration detection
  - **`@0xsarwagya/ontoly-parser-go`**: `createGoFrontendPass()` CompilerPass
    wiring `.go` files into the Ontoly compiler pipeline.
- Go pass registered in `defaultCompilerPasses()` — `ontoly build` now
  automatically analyzes `.go` files alongside TypeScript, Python, and OpenAPI.

### Validation Results

| Repository | Files | Structs | Interfaces | Functions | Methods | Calls | Symbols | Relationships | Time |
|---|---|---|---|---|---|---|---|---|---|
| gin-examples | 52 | 14 | 3 | 101 | 28 | 805 | 539 | 1,302 | 64ms |
| fzf | 57 | 78 | 2 | 277 | 501 | 6,190 | 1,948 | 5,407 | 398ms |
| gorm | 69 | 102 | 62 | 108 | 457 | 4,665 | 1,302 | 4,300 | 271ms |
| **Total** | **178** | **194** | **67** | **486** | **986** | **11,660** | **3,789** | **11,009** | **733ms** |

## 1.1.0

Stable release adding Python language support, AI/ML framework analyzers,
full JS/TS framework coverage, and deterministic graph diffing. Validated
at scale across 11 OSS repos (459K nodes, 699K edges).

### Added

- **Python language support** — the first non-JS/TS language in Ontoly.
  - **`@0xsarwagya/ontoly-python`**: tree-sitter-based Python semantic model
    analyzer. Extracts classes (with inheritance), functions (async, params,
    return annotations), methods (static/classmethod/property), imports
    (absolute and relative), decorators, calls, variables, and assignments.
  - **`@0xsarwagya/ontoly-semantic-python`**: Python semantic bridge converting
    `PythonProject` into `CompilerSymbol[]` and `CompilerRelationship[]`.
  - **`@0xsarwagya/ontoly-parser-python`**: CompilerPass wrapper
    (`createPythonFrontendPass()`) that filters `.py` files from source
    inventory and produces `language: "python"` symbols.
  - Python frontend pass registered in `defaultCompilerPasses()` — Python
    files are now analyzed automatically alongside TypeScript.
- **Python framework analyzers** (6 total):
  - **Django**: models (`models.Model`), class-based and function-based views,
    middleware.
  - **FastAPI**: route decorators, Pydantic models (`BaseModel`), dependency
    injection (`Depends()`).
  - **PyTorch**: `nn.Module` models, `Dataset` subclasses, `@torch.no_grad` /
    `@torch.jit.script` decorated functions.
  - **TensorFlow / Keras**: `Model` and `Sequential` subclasses, custom
    `Layer` and `Callback` subclasses, `@tf.function` graph functions.
  - **HuggingFace Transformers**: `PreTrainedModel` subclasses, `Trainer`
    subclasses, `PreTrainedTokenizer` subclasses, `pipeline()` calls.
  - **scikit-learn**: `BaseEstimator`/`ClassifierMixin`/`RegressorMixin`
    subclasses, `TransformerMixin` subclasses, `Pipeline`/`make_pipeline`
    calls.
- **38 Python framework signatures** added to `FRAMEWORK_SIGNATURES` (Django,
  FastAPI, Flask, Starlette, Tornado, aiohttp, Sanic, SQLAlchemy, Alembic,
  Tortoise ORM, Pydantic, Celery, pytest, PyTorch, PyTorch Lightning,
  TensorFlow, Keras, HuggingFace Transformers/Datasets/Diffusers/Accelerate/
  PEFT/TRL, scikit-learn, JAX, Flax, Optax, XGBoost, LightGBM, ONNX,
  ONNX Runtime).
- **Full JS/TS framework coverage** (17 semantic analyzers):
  - Next.js, React, Angular, Vue, Remix, SvelteKit, Astro, Nuxt, tRPC,
    Prisma, Drizzle, Koa, Elysia, NestJS, Express, Hono, Fastify.
  - 31 new `FRAMEWORK_SIGNATURES` for package.json-level detection.
- **`@0xsarwagya/ontoly-diff`**: deterministic graph diffing with
  `diffSoftwareGraphs(base, head)` returning added, removed, and modified
  nodes and edges. `ontoly diff` CLI command. Governed by RFC 0005.
- Python-specific directories (`__pycache__`, `.venv`, `.tox`, `.mypy_cache`,
  `.pytest_cache`, `.eggs`) added to repository discovery ignore list.
- 6 Python OSS repos added to validation system: FastAPI, Flask, Django,
  HuggingFace Transformers, scikit-learn, PyTorch.
- Validation runner auto-clones repos with `gitUrl` when missing locally.

### Removed

- `createPlaceholderAnalyzer` — all formerly-placeholder frameworks now
  have real semantic analyzers.

### Validation results (full scale)

| Repository | Language | Nodes | Edges | Diagnostics |
|---|---|---|---|---|
| ovok-core | TypeScript | 39,476 | 82,359 | 31 |
| innosphere | TypeScript | 17,103 | 32,091 | 130 |
| ghost | TypeScript | 352 | 664 | 0 |
| durable-local | TypeScript | 227 | 385 | 0 |
| Flask | Python | 1,700 | 2,079 | 0 |
| FastAPI | Python | 11,634 | 16,054 | 0 |
| Django | Python | 57,895 | 77,851 | 202 |
| scikit-learn | Python | 26,894 | 38,346 | 0 |
| Transformers | Python | 122,933 | 191,914 | 0 |
| PyTorch | Python | 173,719 | 250,746 | 0 |

241 tests passing across 36 test files.

## 1.1.0-alpha.2

Full framework support across 17 semantic analyzers covering all major
JS/TS frameworks. Upgrades placeholders to real analyzers and expands
package-level detection to 48 framework signatures.

### Added

- **Next.js** analyzer: App Router pages & API routes, Pages Router,
  middleware.ts detection — produces `Route` and `Middleware` graph nodes.
- **React** analyzer: PascalCase function/class component detection,
  custom hook detection as `Provider` nodes.
- **Angular** analyzer: `@Component`, `@NgModule`, `@Injectable`,
  `@Pipe`, `@Directive` decorators, `CanActivate` guard detection.
- **Vue** analyzer: `defineComponent()` components, composable detection.
- **Remix** analyzer: flat file routes (v2), loader/action exports.
- **SvelteKit** analyzer: `+page.ts`, `+page.server.ts`, `+server.ts`
  API endpoints.
- **Astro** analyzer: `src/pages/` file-based routing with API endpoint
  detection.
- **Nuxt** analyzer: `pages/` routes, `server/api/`, `server/routes/`,
  `server/middleware/`.
- **tRPC** analyzer: `router()` / `createTRPCRouter()` controller
  detection.
- **Prisma** analyzer: model detection from PrismaClient usage patterns.
- **Drizzle** analyzer: `pgTable`, `mysqlTable`, `sqliteTable` schema
  detection.
- **Koa** HTTP-call-style route analyzer via `@koa/router`.
- **Elysia** HTTP-call-style route analyzer.
- 31 new `FRAMEWORK_SIGNATURES` entries for package.json-level detection
  (Angular, Vue, Nuxt, Svelte, SvelteKit, Remix, Astro, Solid, Gatsby,
  Koa, Elysia, Sequelize, Knex, Pinia, Vuex, Redux Toolkit, Zustand,
  Jotai, Recoil, MobX).

### Removed

- `createPlaceholderAnalyzer` — all formerly-placeholder frameworks now
  have real semantic analyzers.

## 1.1.0-alpha.1

First alpha of the 1.1 release train. Adds deterministic graph diffing
as a first-class primitive.

### Added

- `@0xsarwagya/ontoly-diff` package with `diffSoftwareGraphs(base, head)`
  returning added, removed, and modified nodes and added or removed
  edges. Governed by RFC 0005.
- `ontoly diff <base-graph.json> <head-graph.json> [--json]` CLI command.
- RFC 0005 (Graph Diffing) in `rfcs/0005-graph-diffing.md`.
- Documentation page `docs/graph-diffing.md`.

### Changed

- `ontoly diff` now performs deterministic graph-structure diffing per
  RFC 0005 instead of the prior validation-lab regression check that
  merged coverage, trust, and performance deltas from sibling files.
  Users who relied on the metric-delta behavior should read those
  values from validation-lab dashboards and regression reports
  directly.

### Removed

- `validation/tools/graph-diff.mjs`, the validation-lab regression
  script that previously backed `ontoly diff`. Deterministic diffing
  now lives in `@0xsarwagya/ontoly-diff`.

### Non-goals

- Rename detection, move detection, and semantic interpretation are
  intentionally out of scope for this alpha. A future RFC will add
  them as an opt-in layer.

## 1.0.0

First stable release of the Ontoly Software Graph engine.

### Changed

- Removed stale alpha and release candidate readiness reports.
- Removed orphaned `validate-agent-workflows.mjs` validation script.
- Removed duplicate root `test:unit` and `benchmark` script aliases.
- Updated Next.js from 16.2.10 to 16.2.12 (site).
- Added pnpm overrides to resolve transitive sharp (<0.35.0) and postcss
  (<8.5.18) vulnerabilities.
- Cleaned up README references to deleted reports and RC-era language.

## 1.0.0-rc.22

### Security

- In-memory compiler inputs now reject absolute, drive-qualified, UNC, NUL,
  empty, and parent-traversal source paths before zero-disk or materialized
  analysis. Canonical path aliases are deduplicated deterministically before
  scratch files are written.

## 1.0.0-rc.21

### Added

- Added first-class JavaScript analysis for `.js`, `.jsx`, `.mjs`, and `.cjs`
  alongside the existing TypeScript source extensions.
- Added deterministic CommonJS `require()`, `module.exports`, `exports.*`, ESM,
  dynamic `import()`, JSX, and `jsconfig.json` support to the semantic frontend.
- JavaScript graph nodes now carry `language: "javascript"` while preserving the
  same stable IDs, graph schema, framework analyzers, and query behavior as
  TypeScript nodes.

## 1.0.0-rc.20

### Added

- Added deterministic incremental compiler snapshots with exact source,
  configuration, compiler-pass, and validation-hook invalidation.
- Added bounded deterministic worker execution through the compiler API and
  the CLI `--workers` option.
- Added compiler progress events and stage profiles covering elapsed time and
  memory deltas.
- Added `--no-cache` and `--progress` CLI controls for local builds.
- Added TypeScript incremental builder reuse for long-lived filesystem
  processes while preserving isolated in-memory builds.
- Compiler: `resolveOntolyConfig(config)` helper exported from
  `@0xsarwagya/ontoly-compiler` for callers that build compiler input by
  hand and want the same normalization `loadOntolyConfig` applies.

### Changed

- The default local build now reuses validated compiler products and graph
  snapshots when all deterministic fingerprints match.
- TypeScript semantic models are emitted once as compiler products and reused
  by bundle generation instead of reparsing the project.
- Output generation reuses a single query engine and avoids duplicate graph
  serialization.
- Compiler: `CompilerContext.config` narrowed from `OntolyConfig` to the new
  `ResolvedOntolyConfig` — array (`include`, `exclude`, `plugins`) and record
  (`parsers`) fields are no longer possibly `undefined` after
  `loadOntolyConfig` / `createCompilerContext`. `ResolvedOntolyConfig extends
  OntolyConfig`, so any consumer typed against `OntolyConfig` remains
  source-compatible; only readers that explicitly branched on
  `config.exclude === undefined` see a difference (the branch is now
  unreachable). User-facing `OntolyConfig` is unchanged — `ontoly.config.ts`
  keeps its optional fields.

### Performance

- A repeated unchanged smoke build completed in 14 ms versus 602 ms cold,
  preserved the graph hash, and skipped eight semantic pipeline stages.

## 1.0.0-rc.5

### Added

- Added in-memory source processing. `buildSoftwareGraphFromMemory` (exported
  from `@0xsarwagya/ontoly-compiler`) builds a Software Graph from a
  `{ path: contents }` map with two strategies:
  - `materialize` (default): writes sources to a private scratch directory,
    runs the standard on-disk pipeline, then removes the directory.
  - `zero-disk`: serves sources from memory end to end via a `SourceProvider`
    and an in-memory `ts.CompilerHost`; no provided source touches disk.
- Added the `SourceProvider` contract, `InMemorySources` type, and
  `createInMemorySourceProvider` to `@0xsarwagya/ontoly-compiler`. The compiler
  discovery, source inventory, repository-intelligence, TypeScript frontend, and
  OpenAPI frontend now read through the provider when one is supplied.
- Added `createInMemoryCompilerHost` to `@0xsarwagya/ontoly-typescript` and an
  optional `host` on the TypeScript frontend/analyzer inputs.
- Exposed `defaultCompilerPasses()` as a public convenience from
  `@0xsarwagya/ontoly-cli` so callers can supply the batteries-included pass set
  to `buildSoftwareGraph` and `buildSoftwareGraphFromMemory`.

## 1.0.0-rc.3

### Fixed

- History indexing now fails closed with a structured
  `HISTORY_INDEXING_FAILED` error instead of silently producing empty history
  artifacts when Git history collection fails.
- Git history collection now uses a 128 MiB output buffer and reports buffer
  failures explicitly.
- Successful History artifacts now include `historyIndexed` and
  `historyStatus` provenance so users and agents can distinguish indexed-empty
  history from unavailable history.
- Added CLI version support through `ontoly --version`, `ontoly -v`, and
  `ontoly version --json`.
- Added command-specific help for `ontoly history`, `ontoly hotspots`,
  `ontoly ownership`, `ontoly cochanges`, and `ontoly stability`.

## 1.0.0-rc.2

### Added

- Added `@0xsarwagya/ontoly-enhancer-history`, an official deterministic
  enhancer that derives repository history, ownership, hotspots, co-change
  relationships, churn, stability, and architectural drift from Git history and
  the immutable Software Graph.
- Added temporal intelligence APIs to `@0xsarwagya/ontoly-intelligence`:
  `history`, `ownership`, `hotspots`, `churn`, `cochanges`, and `stability`.
- Added CLI commands `ontoly history`, `ontoly history build`,
  `ontoly history feature`, `ontoly hotspots`, `ontoly ownership`,
  `ontoly churn`, `ontoly cochanges`, and `ontoly stability`.
- Added MCP capabilities `History`, `Ownership`, `Hotspots`, `Cochanges`, and
  `Stability`.
- Added temporal sections to Evidence Packs when a History artifact is
  available: `history`, `ownership`, and `stability`.
- Added repository-history validation questions under `validation/history`.

### Unchanged

- No Software Graph schema changes.
- No compiler behavior changes.
- No retrieval or ranking changes.
- No framework analyzer changes.
- No LLMs, embeddings, vector search, or AI reasoning.

## 1.0.0-rc.1

### Release Engineering

- Bumped the root workspace, publishable packages, plugins, Agent Skills, site
  metadata, and compatibility matrices to `1.0.0-rc.1`.
- Added RC-safe npm publish guards, release-version validation, npm pack
  artifact validation, and clean first-user smoke validation.
- Expanded GitHub Actions coverage for PR CI, release verification, package
  validation, docs validation, security checks, CodeQL, and Dependabot.
- Refreshed public package READMEs so every package documents purpose,
  installation, API entrypoint, example usage, and release status.
- Added `NEW_USER_REPORT.md`, `RC_READINESS.md`, `GOVERNANCE.md`, and
  `THIRD_PARTY_NOTICES.md` release-readiness evidence.

### Unchanged

- No Software Graph schema changes.
- No compiler behavior changes.
- No CALLS generation changes.
- No retrieval, ranking, semantic generation, framework analyzer, MCP, or
  capability behavior changes.

## 0.1.0-alpha.19

### Added

- Added `@0xsarwagya/ontoly-enhancer-semantics`, an official deterministic
  enhancer that derives feature ownership, domain vocabulary, intent
  vocabulary, semantic neighborhoods, confidence, and a Graphify-style concept
  graph from the immutable Software Graph and Semantic Index.
- Added `@0xsarwagya/ontoly-intelligence`, a deterministic API over
  `SoftwareGraph`, `SemanticIndex`, and `Semantics` for query expansion,
  feature ownership, bounded evidence, and semantic neighborhoods.
- Added `ontoly semantics build`, `ontoly semantics inspect`, and
  `ontoly semantics validate`.
- Added MCP capabilities `SemanticNeighborhood`, `FeatureOwnership`,
  `IntentExpansion`, and `SemanticContext`.

### Unchanged

- No Software Graph schema changes.
- No compiler behavior changes.
- No CALLS generation changes.
- No LLMs, embeddings, vector search, or AI reasoning.

## 0.1.0-alpha.18

### Improved

- Completed deterministic NestJS method-level semantic resolution for
  `this.*`, `super.*`, local method, and injected-service method calls using
  TypeScript symbol resolution.
- Added NestJS runtime topology facts for BullMQ processors, cron handlers,
  event handlers, websocket gateways, repository injection, queue injection, and
  model injection without changing the Software Graph schema.
- Added deterministic NestJS runtime-topology corpus metadata and unit coverage
  for processor-to-service-to-repository traversal.

### Validation

- Verified `pnpm check-types`, `pnpm test`, `pnpm build`, documentation checks,
  package validation, semantic evaluation, validation lab, and Ovok retrieval
  benchmark.
- Fresh Ovok graph build produced 21,686 nodes, 52,548 edges, and 5,823 `CALLS`
  edges.
- Preserved and improved the Ovok retrieval target: 40 PASS, 0 PARTIAL, 0 FAIL,
  39 Top-1, 40 Top-K, and 0 errors.

## 0.1.0-alpha.17

### Maintained

- Completed a behavior-preserving engineering-excellence sweep before the next
  release candidate.
- Removed unused private CLI plumbing without changing compiler, graph,
  retrieval, MCP, capability, or Skills behavior.
- Added `reports/alpha17-engineering-excellence.md` with measured runtime LOC,
  public exports, package dependency graph, largest functions, and validation
  evidence.

### Validation

- Verified `pnpm check-types`, `pnpm test`, `pnpm build`, documentation checks,
  package validation, skills validation, semantic evaluation, validation lab,
  and performance benchmark.
- Preserved the alpha.16 Ovok retrieval target: 40 PASS, 0 PARTIAL, 0 FAIL,
  38 Top-1, 40 Top-K, and 0 errors.

## 0.1.0-alpha.16

### Stabilized

- Restored alpha.14 retrieval quality after the alpha.15 enhancer release by
  fixing action-oriented Semantic Index ranking for queries such as
  `What code calculates sleep duration averages for thresholds?`.
- Added a bounded executable-action ranking signal so method/function candidates
  can outrank owner classes when the user is explicitly asking for code that
  performs an action.
- Preserved the alpha.15 enhancer fixes while improving the Ovok 40-question
  Ontoly benchmark to 40 PASS, 0 PARTIAL, 0 FAIL, and 38 Top-1 results.

### Validation

- Added regression tests for `calculateSleepDurationAverages` ranking,
  file-location utility lookup, and capped-bucket identifier seeding.
- Verified `pnpm check-types`, `pnpm test`, and `pnpm build`.

## 0.1.0-alpha.15

### Release Candidate

- Bumped the root workspace and all publishable Ontoly packages/plugins to
  `0.1.0-alpha.15`.
- Froze the public API surface for Release Candidate validation; the CLI package remains an
  intentional public aggregate API.
- Updated public documentation, site metadata, skills, compatibility matrices,
  and package READMEs from alpha language to Release Candidate language.
- Moved public site metadata to `https://oss.sarwagya.wtf/ontoly` and declared the
  legacy `https://oss.sarwagya.wtf/ontoly` redirect target.
- Normalized CLI help formatting and added coverage for tab-free help output.
- Added release engineering evidence for CODEOWNERS, package metadata, npm pack
  dry-runs, public GitHub clean-room smoke tests, and Release Candidate notes.

### Validation

- Package validation: 16/16 packages pass.
- Skills validation: 14/14 skills pass, including installed-artifact validation.
- Semantic evaluation remains PASS with Ontoly Semantic Understanding Score 100.
- Agent workflow validation remains PASS with 15/15 corpus queries, 2/2 stress
  profiles, and 3/3 skill clients.
- The GitHub publish workflow reruns typecheck, tests, build, and package
  validation before publishing npm packages.

## 0.1.0-alpha.14

### Stabilized

- Improved Semantic Index seed ranking so natural-language queries such as
  `sleep duration thresholds` resolve to repository-local feature owners instead
  of adjacent observation helpers or external package symbols.
- Bounded Semantic Index alias, keyword, inverted-index, and vocabulary payloads
  to prevent huge evidence artifacts and oversized index serialization.
- Added Semantic Index cache validation and repair so stale indexes are rebuilt
  and persisted when graph or index versions change.
- Reused the loaded Semantic Index in CLI capability execution, removing the
  accidental full-index rebuild on every `impact`, `evidence`, and
  `implementation-plan` command.
- Preserved Evidence Pack ranking through serialization and scoped graph
  diagnostics to selected evidence files/nodes.

### Validation

- Expanded the deterministic agent workflow regression corpus around sleep
  duration thresholds, batch-data observations, authentication, JWT, signals,
  and FHIR/PlanDefinition queries.
- Refreshed validation dashboards, semantic reports, performance reports,
  badges, and website assets after release-gate validation.

## 0.1.0-alpha.13

### Stabilized

- Added enforced execution budgets, partial results, and profiling metadata for
  long-running semantic capabilities, including `ImplementationPlan`,
  `ImpactAnalysis`, and `EvidencePack`.
- Bounded Evidence Pack generation so agent workflows never serialize the full
  graph and always return compact ranked evidence.
- Hardened Semantic Index hashing and fuzzy retrieval for large repositories.
- Fixed validation-lab determinism checks to distinguish compiler
  nondeterminism from actively changing repository input.
- Restored package configuration ownership edges for workspace config files.

### Validation

- Added the deterministic agent workflow regression corpus for
  Search -> Locate -> Impact -> Evidence Pack -> Implementation Plan.
- Refreshed the alpha validation baseline with per-stage performance metrics.

## 0.1.0-alpha.9

### Changed

- Made LLM Enhancement mandatory for every LLM-facing Ontoly workflow.
- Updated Agent Skill validation to verify installed skill references include
  mandatory LLM Enhancement guidance.
- Added public LLM Enhancement documentation and linked it from README, MCP,
  Capabilities, Agent Skills, FAQ, and Skills docs.

## 0.1.0-alpha.6

### Added

- Added `@0xsarwagya/ontoly-capabilities`, the deterministic Semantic Capability Engine over the Software Graph.
- Added high-level CLI commands for `explain`, `impact`, `implementation-plan`, `ownership`, `health`, `repository-summary`, `risk`, and `request-trace`.
- Exposed semantic capability results through MCP while preserving existing primitive MCP capabilities.
- Added first-class public docs pages for every official Agent Skill.
- Added a deterministic 250-question semantic capability corpus under `validation/questions`.

### Changed

- `ImpactAnalysis` now uses the shared capability result schema across CLI, MCP, and package APIs.
- Documentation now links Skills through `oss.sarwagya.wtf/ontoly/docs/skills` instead of only GitHub source paths.

## 0.1.0-alpha.5

### Added

- Interactive folder selection for bare `ontoly build` and `ontoly output` in TTY sessions.
- Human phrase normalization for Query Engine lookup.
- Grouped affected nodes and external boundaries in CLI `impact` and MCP `ImpactAnalysis`.
- Deterministic external package boundary `CALLS` edges for imported package method calls.

### Changed

- Updated the Impact Analysis skill to avoid spelling-variant command fan-out.
- Bumped changed runtime packages for npm publication.

## 0.1.0-alpha.1

Initial public alpha public preview.

### Added

- Deterministic Software Graph schema and RFC process.
- TypeScript frontend for modules, functions, classes, interfaces, imports, and exports.
- Compiler pipeline, graph validation hooks, diagnostics, and serialization.
- Query Engine, MCP runtime, CLI, and graph artifact generation.
- Semantic Model, framework analysis surface, validation lab, semantic evaluation harness, and performance lab.
- Official Agent Skills collection with installed-artifact validation.

### Hardened

- MCP capability input validation with structured errors.
- Skill installation so each skill is self-contained when installed independently.
- Package metadata and CI release gates for npm and GitHub readiness.

### Known Limitations

- Ontoly Alpha focuses on TypeScript repositories.
- Framework analyzers are intentionally conservative.
- Binary graph serialization is not part of this release.

See [Known Limitations](docs/known-limitations.md) and [Roadmap](ROADMAP.md).
