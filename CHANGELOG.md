# Changelog

All notable Ontoly changes are tracked here.

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

Initial public alpha release candidate.

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
