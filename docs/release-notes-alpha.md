# Alpha Release Notes

## v0.1.0-alpha.12

This release fixes external npm installation by removing the hidden standalone
Semantic Index package dependency from the public CLI graph.

- Semantic Index APIs are now exported by `@0xsarwagya/ontoly-core`.
- Cache, enhancer, capabilities, MCP, and CLI now consume Semantic Index APIs
  from core, so latest installs only depend on packages npm is publicly serving.
- The standalone `@0xsarwagya/ontoly-semantic-index` package was removed from
  the release graph after npm publish logs marked it public but unauthenticated
  installs still received 404 responses.
- Agent Skills now require Ontoly `0.1.0-alpha.12`.

## v0.1.0-alpha.11

This release attempted to fix external npm installation by renaming the
standalone Semantic Index package.

- The Semantic Index package was renamed to
  `@0xsarwagya/ontoly-semantic-index`.
- Packages that consume the Semantic Index were republished against that
  dependency name: cache, enhancer, capabilities, MCP, and CLI.
- Agent Skills now require Ontoly `0.1.0-alpha.11` so installed workflows target
  the fixed published artifact set.
- This package name also returned public npm 404s after successful publish logs,
  so alpha.12 removes the standalone package from latest installs.

## v0.1.0-alpha.10

This release adds compact Evidence Packs for graph-first agent workflows.

- `ontoly evidence <query>` returns a compact graph-backed Evidence Pack with
  top nodes, top edges, relevant files, stable ids, confidence, diagnostics, and
  suggested next commands.
- `EvidencePack` is available through the Semantic Capability Engine and MCP.
- `evidence-pack` is a first-class Enhancer artifact; no separate router package
  is introduced.
- `ontoly search` now includes deterministic `runNext` commands that start with
  `ontoly evidence`.
- `ImpactAnalysis` supports scoped modes: `direct`, `local`, `feature`,
  `semantic`, and `blast-radius`.
- `ImplementationPlan` now returns bounded partial results when a deterministic
  node budget is exceeded.
- The npm publish script includes the Semantic Index package in the package
  publication order.
- Official Agent Skills now require LLM Enhancement plus `EvidencePack` and
  document the evidence-first workflow in every installable skill folder.

## v0.1.0-alpha.9

This CLI release makes LLM Enhancement the mandatory workflow contract whenever
an LLM uses Ontoly.

- Every LLM-facing Ontoly workflow must declare or install LLM Enhancement.
- Agent Skill validation now checks installed skill reference files for
  mandatory LLM Enhancement guidance.
- README, MCP, Capabilities, Agent Skills, FAQ, and Skills docs now link to the
  canonical LLM Enhancement policy.

## v0.1.0-alpha.6

This release adds the Semantic Capability Engine and makes Agent Skills visible
as first-class public docs.

- `@0xsarwagya/ontoly-capabilities` ships deterministic high-level software-engineering capabilities over the Software Graph.
- `ontoly explain`, `ontoly impact`, `ontoly implementation-plan`, `ontoly ownership`, `ontoly health`, `ontoly repository-summary`, `ontoly risk`, and `ontoly request-trace` return the shared capability result schema.
- MCP now exposes high-level semantic capabilities while preserving existing primitive capability names used by current Skills.
- The website generator creates `/ontoly/docs/skills` and per-skill public docs pages from the Skill catalog.
- `validation/questions/questions.json` adds a deterministic 250-question alpha corpus for capability evaluation.

## v0.1.0-alpha.5

This release improves graph-first agent answers for impact analysis and
first-run CLI indexing.

- `ontoly build` and `ontoly output` ask which folder to index in interactive terminals when no root is provided.
- Query Engine free-text lookup now normalizes human concept phrases such as `Plan Definition Resource`.
- `ontoly query impact` and MCP `ImpactAnalysis` now include grouped affected routes, controllers, services, modules, configuration, resources, permissions, and external boundaries.
- TypeScript external package method calls now preserve deterministic package boundary `CALLS` edges instead of disappearing from the graph.
- The Impact Analysis skill now instructs agents to use Ontoly resolution once and report ambiguity or not-found evidence instead of manually trying spelling variants.

## v0.1.0-alpha.4

This CLI release turns HTML graph output into the Software Graph Explorer.

- `ontoly graph --format html` and `ontoly architecture --format html` open an architecture-first explorer.
- Search now selects, centers, and expands the matching node neighborhood.
- The explorer adds grouped filters, node relationship details, trace focus, a minimap, and deterministic graph summaries.

## v0.1.0-alpha.3

This CLI release adds interactive HTML architecture exports.

- `ontoly architecture --format html` emits a self-contained architecture graph.
- Large graph rendering now uses connected node-link layouts with reduced label noise.
- `--max-nodes` and `--max-edges` bound architecture HTML output for large repositories.

## v0.1.0-alpha.2

This CLI release adds interactive Software Graph HTML export.

- `ontoly graph --format html` emits a searchable, filterable graph artifact.
- `@0xsarwagya/ontoly-plugin-html` ships as an independently installable plugin.
- HTML output works offline without CDN assets.

## v0.1.0-alpha.1

This release candidate prepares Ontoly for its first public alpha.

## What Works

- Build a Software Graph from TypeScript examples.
- Inspect graph nodes, relationships, diagnostics, and statistics.
- Query the graph through the Query Engine and CLI.
- Start MCP and call deterministic graph capabilities.
- Install Ontoly Agent Skills as self-contained folders.
- Run validation, semantic evaluation, package checks, docs checks, and release gates.

## What Changed in the RC Pass

- Skill installation no longer depends on a sibling `skills/shared` folder after install.
- Installed skill artifacts are validated in CI.
- MCP capabilities validate required inputs and return structured errors.
- MCP responses include provenance and deterministic confidence derived from graph evidence.
- Package metadata is normalized for npm publishing.
- GitHub templates and release docs are present.

## Read Next

- [README](../README.md)
- [Known Limitations](known-limitations.md)
- [Compatibility Matrix](compatibility-matrix.md)
- [Feature Matrix](feature-matrix.md)
