# Changelog

All notable Ontoly changes are tracked here.

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

### Public Preview

- Bumped the root workspace and all publishable Ontoly packages/plugins to
  `0.1.0-alpha.15`.
- Froze the public API surface for Public Preview validation; the CLI package remains an
  intentional public aggregate API.
- Updated public documentation, site metadata, skills, compatibility matrices,
  and package READMEs from alpha language to Public Preview language.
- Moved public site metadata to `https://ontoly.sarwagya.wtf` and declared the
  legacy `https://oss.sarwagya.wtf/ontoly` redirect target.
- Normalized CLI help formatting and added coverage for tab-free help output.
- Added release engineering evidence for CODEOWNERS, package metadata, npm pack
  dry-runs, public GitHub clean-room smoke tests, and Public Preview release notes.

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
