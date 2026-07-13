# RFC 0004: Plugin and Compiler Pass System

## Status

Draft

## Summary

This RFC defines Ontoly's plugin and compiler pass system.

Ontoly must be extensible without modifying the compiler. Extensions should
participate in the compiler pipeline through explicit, deterministic pass
interfaces rather than event emitters. The model is closer to LLVM passes
than application lifecycle callbacks: plugins declare capabilities, passes,
inputs, outputs, dependencies, and compatibility. The compiler builds a
pass plan, validates it, executes it deterministically, and rejects plugins
that cannot preserve graph compatibility.

This document does not implement the plugin system.

## Normative Language

The words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as
defined by RFC 2119.

## Design Goals

1. **Extensibility without compiler modification.** New parsers, passes,
   diagnostics, validators, emitters, and graph consumers MUST be addable as
   plugins.
2. **Pass-oriented architecture.** Plugins participate through declared
   passes and capabilities, not ad hoc event emitters.
3. **Determinism.** Plugin execution MUST preserve deterministic compiler
   output for identical input.
4. **Compatibility.** Plugins MUST declare compatible Software Graph spec,
   compiler pipeline, and plugin API versions.
5. **Isolation.** Plugin execution MUST have explicit access boundaries.
6. **Explainability.** Semantic plugin output MUST include provenance.
7. **Dependency ordering.** Pass order MUST be derived from declared
   dependencies and stable tie-breaking.
8. **Failure containment.** Optional plugin failure SHOULD NOT corrupt
   canonical graph output.

## Non-Goals

This RFC does not define:

- A marketplace.
- Package installation mechanics.
- Plugin UI.
- Network protocol for remote plugins.
- AI or model integration.
- Runtime application plugins.
- Event emitter APIs.
- Binary plugin ABI.
- Generated SDK formats.

## Core Concepts

### Plugin

A distributable extension package that declares one or more capabilities and
contributes one or more passes, frontends, diagnostics processors,
validators, or emitters.

### Capability

A declared ability of a plugin. Capabilities are negotiated before
execution.

Examples:

- `source-classifier`
- `parser`
- `resolver`
- `semantic-pass`
- `optimization-pass`
- `diagnostic-pass`
- `graph-validator`
- `emitter`
- `cache-provider`

### Pass

A deterministic unit of work scheduled by the compiler pass manager.

Passes have declared:

- Identity.
- Kind.
- Inputs.
- Outputs.
- Dependencies.
- Invalidations.
- Whether they are semantic.
- Isolation requirements.

### Pass Manager

The compiler component that validates pass declarations, computes
dependency order, executes passes, collects outputs, and enforces
determinism and isolation.

### Pass Product

The declared output of a pass, such as graph facts, diagnostics, indexes,
validation results, or emitted artifacts.

### Plugin Host

The runtime boundary responsible for loading plugins, validating manifests,
providing capability handles, executing passes, and enforcing isolation.

## Plugin Categories

### Parser Plugins

Parser plugins add support for new source kinds or languages.

Examples:

- OpenAPI parser.
- GraphQL parser.
- Prisma parser.
- SQL parser.
- Terraform parser.

Parser plugins may contribute:

- Source classifiers.
- Frontends.
- Parser passes.
- Resolver passes.
- Source-specific diagnostics.

Parser plugins MUST emit intermediate graph facts and graph-native
diagnostics, not final serialized graphs.

### Compiler Pass Plugins

Compiler pass plugins participate before final graph construction or
validation.

Examples:

- Derive Route nodes from framework declarations.
- Link OpenAPI operations to TypeScript handlers.
- Infer Service nodes from configured architecture rules.
- Associate Permissions with routes.

Semantic compiler passes MAY add or replace graph facts. They MUST include
provenance and MUST declare their inputs and output fact kinds.

### Graph Transformation Plugins

Graph transformation plugins operate on a candidate or validated graph.

Two classes exist:

1. **Semantic graph transforms.** Run before validation and may add,
   remove, or replace semantic graph facts through explicit replacement
   records.
2. **Non-semantic graph transforms.** Run after graph construction or
   validation and may sort, index, annotate, or project without changing
   graph meaning.

Semantic transforms are compiler passes. Non-semantic transforms are
optimization passes or graph consumer passes.

### Diagnostics Plugins

Diagnostics plugins inspect facts, graph regions, or validated graphs and
emit graph-native diagnostics.

Examples:

- Circular dependency diagnostics.
- Missing ownership diagnostics.
- Architecture boundary violations.
- Public API compatibility warnings.
- Security policy findings.

Diagnostics plugins MUST NOT mutate graph facts unless they also declare a
separate semantic pass.

### Emitters

Emitters consume a validated Software Graph and produce non-canonical
artifacts.

Examples:

- Mermaid diagrams.
- Documentation JSON.
- Architecture reports.
- SDK input manifests.
- Dependency reports.
- Static analysis reports.

Emitters MUST NOT modify the canonical graph. Emitter artifacts MUST be
distinguishable from canonical `.ontoly/graph.json`.

## Plugin Manifest

Every plugin MUST provide a manifest.

```json
{
  "name": "@0xsarwagya/ontoly-plugin-example",
  "version": "0.1.0",
  "pluginApi": "^1.0.0",
  "softwareGraph": "^1.0.0",
  "compilerPipeline": "^1.0.0",
  "capabilities": [],
  "passes": [],
  "extensions": [],
  "isolation": {
    "mode": "process",
    "permissions": []
  }
}
```

Required fields:

- `name`
- `version`
- `pluginApi`
- `softwareGraph`
- `compilerPipeline`
- `capabilities`

Optional fields:

- `passes`
- `extensions`
- `isolation`
- `configurationSchema`
- `requires`
- `peerPlugins`
- `artifacts`

Rules:

- `name` MUST be globally unique.
- `version` MUST be semantic.
- Compatibility ranges MUST be explicit.
- Manifests MUST be JSON-serializable.
- Manifest fields that affect execution MUST be included in compiler cache
  compatibility checks.

## Capability Negotiation

Capability negotiation happens before pass planning.

Inputs:

- Compiler version.
- Plugin API version.
- Software Graph spec version.
- Compiler Pipeline version.
- Plugin manifest.
- User configuration.
- Available host permissions.

Outputs:

- Enabled capabilities.
- Disabled capabilities with diagnostics.
- Required host permissions.
- Pass declarations.
- Extension namespace registrations.

Rules:

- A plugin MUST NOT execute a capability that was not negotiated.
- Required capability failure MUST fail plugin activation.
- Optional capability failure SHOULD produce diagnostics and continue.
- Capability negotiation MUST be deterministic.
- Plugins MUST declare whether network, filesystem write, process, or
  environment access is required.

## Pass Model

```ts
interface PassDeclaration {
  id: string;
  plugin: string;
  kind: PassKind;
  semantic: boolean;
  stage: PipelineStage;
  reads: PassInput[];
  writes: PassOutput[];
  before?: string[];
  after?: string[];
  requires?: string[];
  invalidates?: InvalidationRule[];
  isolation?: IsolationRequirement;
}

type PassKind =
  | "source-classifier"
  | "parser"
  | "resolver"
  | "semantic"
  | "diagnostic"
  | "optimization"
  | "validator"
  | "emitter";
```

Pass rules:

- Pass IDs MUST be stable and namespace-qualified.
- Passes MUST declare their pipeline stage.
- Semantic passes MUST declare graph fact outputs.
- Non-semantic passes MUST NOT change graph meaning.
- Passes MUST NOT read undeclared inputs.
- Passes MUST NOT write undeclared outputs.
- Passes MUST produce deterministic output for identical declared inputs.
- Pass outputs MUST include producer identity when they affect graph
  content.

## Pass Inputs and Outputs

Pass inputs may include:

- Source inventory.
- Source content.
- Parser facts.
- Normalized facts.
- Resolved facts.
- Candidate graph.
- Validated graph.
- Diagnostics.
- Indexes.
- Cache entries owned by the plugin.
- User configuration owned by the plugin.

Pass outputs may include:

- Source classifications.
- Graph facts.
- Replacement records.
- Diagnostics.
- Resolution records.
- Validation results.
- Indexes.
- Cache entries.
- Non-canonical artifacts.

Rules:

- Inputs and outputs MUST be typed.
- Outputs MUST be serializable or explicitly marked volatile.
- Passes MUST NOT mutate inputs in place.
- Graph changes MUST be expressed as new facts or replacement records.
- Replacement records MUST identify what they replace and why.

## Dependency Ordering

The pass manager computes a directed acyclic graph of passes.

Ordering inputs:

- Pipeline stage.
- `requires`.
- `before`.
- `after`.
- Read/write dependencies.
- Compiler-defined phase boundaries.

Rules:

- Stage order from RFC-0002 takes precedence.
- Pass dependency cycles are fatal unless a plugin explicitly declares an
  iterative fixed-point group and the compiler supports it.
- Stable tie-breaking MUST sort by pass ID.
- Passes in the same stage MAY run in parallel only when declared
  read/write sets do not conflict.
- Parallel execution MUST produce the same output as deterministic serial
  execution.

## Fixed-Point Pass Groups

Some analyses require repeated execution until no new facts are produced.

Rules:

- Fixed-point groups MUST be explicit.
- The compiler MUST enforce max iterations.
- Each iteration MUST be deterministic.
- The group MUST define convergence by stable fact set equality.
- Non-convergence MUST produce diagnostics and fail the group if required.

Examples:

- Cross-language reference resolution.
- Transitive ownership derivation.
- Multi-schema model association.

## Lifecycle Hooks

The plugin system avoids event emitters. Hooks are named pass attachment
points in the compiler pipeline.

Canonical hook points:

- `context:create`
- `config:normalize`
- `source:classify`
- `cache:load`
- `frontend:plan`
- `parse`
- `fact:normalize`
- `resolve`
- `pass:semantic`
- `diagnostic:process`
- `graph:construct`
- `graph:optimize`
- `graph:validate`
- `serialize:plan`
- `emit`
- `artifact:commit`

Rules:

- Hooks are not broadcast events.
- A hook exists only to schedule declared passes.
- The pass manager determines execution order.
- Plugins MUST NOT subscribe dynamically during execution.
- Plugins MAY register passes during activation only.

## Version Compatibility

Plugins MUST declare compatibility with:

- Plugin API version.
- Software Graph spec version.
- Compiler Pipeline version.
- Optional query engine version when consuming query APIs.
- Optional plugin dependencies.

Compatibility rules:

- Unknown major versions MUST be rejected by default.
- Compatible minor versions MAY be accepted when the plugin does not
  require new capabilities.
- Plugin API compatibility is separate from package version.
- Compiler caches MUST include plugin version and manifest hash.
- A plugin upgrade MUST invalidate outputs owned by that plugin unless
  compatibility metadata proves reuse is safe.

## Extension Namespaces

Plugins may register extension namespaces defined by RFC-0001.

Rules:

- Namespace MUST be globally unique.
- Namespace SHOULD match plugin package name.
- Plugin MUST declare the graph locations where the namespace may appear:
  graph, repository, node, edge, diagnostic, provenance, or metadata.
- Plugin MUST document extension schema.
- Extension metadata MUST NOT redefine core fields.
- Required extensions MUST be declared during capability negotiation.

## Execution Isolation

Plugin execution MUST be isolated according to plugin capability and trust.

Isolation modes:

- `in-process`
- `worker`
- `process`
- `sandbox`
- `remote`

Rules:

- The compiler host chooses the minimum allowed isolation for configured
  trust level.
- In-process plugins are trusted and SHOULD be reserved for first-party or
  explicitly trusted plugins.
- Untrusted plugins SHOULD run in process, sandbox, or remote isolation.
- Isolated plugins MUST communicate through typed pass inputs and outputs.
- Isolated plugins MUST NOT receive ambient compiler internals.

Permission categories:

- `read-source`
- `read-config`
- `write-cache`
- `write-artifact`
- `read-env`
- `network`
- `spawn-process`

Rules:

- Permissions MUST be declared in the manifest.
- Permissions MUST be approved by configuration or host policy.
- Semantic graph construction SHOULD NOT require network access.
- Network access, when allowed, MUST be represented in provenance for graph
  facts affected by remote data.

## Determinism Requirements

Plugins MUST:

- Process inputs in deterministic order.
- Produce stable IDs.
- Avoid wall-clock time in semantic output.
- Avoid random values in semantic output.
- Avoid non-deterministic filesystem traversal.
- Avoid unpinned remote data.
- Declare cache inputs.
- Include provenance for semantic facts.

Plugins MUST NOT:

- Mutate source files during graph compilation.
- Mutate compiler-owned objects in place.
- Write canonical graph artifacts directly.
- Depend on process-global mutable state for semantic output.
- Hide semantic changes inside extensions.

## Cache Participation

Plugins may own namespaced cache entries.

Rules:

- Cache keys MUST include plugin name, plugin version, manifest hash,
  relevant configuration hash, input source digests, and capability
  versions.
- Plugins MUST tolerate missing cache entries.
- Plugin caches MUST be invalidated when compatibility checks fail.
- Cache data MUST be namespaced.
- Cache data MUST NOT be required to interpret canonical graph content.

## Diagnostics

Plugins may emit graph-native diagnostics.

Rules:

- Diagnostics MUST follow RFC-0001.
- Diagnostics MUST include plugin producer identity.
- Diagnostics SHOULD reference graph nodes, graph edges, or source ranges
  when possible.
- Parser-specific or plugin-specific diagnostic detail belongs in
  namespaced extensions.
- Diagnostic suppressions MUST be explicit in configuration and SHOULD be
  represented in build metadata or diagnostics metadata.

## Graph Transformation Rules

Semantic graph transforms:

- MUST run before graph validation.
- MUST produce facts or replacement records.
- MUST include provenance.
- MUST preserve RFC-0001 core schema.
- MUST be deterministic.

Non-semantic graph transforms:

- MAY run after graph construction.
- MAY build indexes, summaries, projections, or annotations.
- MUST NOT alter node, edge, or diagnostic semantics.
- MUST NOT affect canonical graph content hash unless the output is a
  declared semantic extension.

Validated graph consumer transforms:

- MAY consume validated graphs.
- MAY emit artifacts.
- MUST NOT replace canonical graph artifacts.

## Emitters

Emitters are passes that consume a validated Software Graph and produce
non-canonical artifacts.

Emitter rules:

- Emitters MUST declare artifact paths and media types.
- Emitters MUST write only through compiler-provided artifact writers.
- Emitters MUST NOT write outside configured artifact roots.
- Emitters SHOULD include source graph content hash in artifacts when
  useful.
- Required emitter failure MAY fail the build only after canonical graph
  commit policy is applied.
- Optional emitter failure SHOULD produce diagnostics and continue.

## Failure Handling

Plugin failures are classified as:

### Activation Failure

The plugin cannot be loaded or negotiated.

Behavior:

- Required plugin activation failure MUST fail the build.
- Optional plugin activation failure SHOULD emit diagnostics and disable the
  plugin.

### Pass Failure

A declared pass fails during execution.

Behavior:

- Required semantic pass failure MUST fail the affected build stage.
- Optional pass failure SHOULD emit diagnostics and continue only if graph
  validity can be preserved.
- Emitter failure SHOULD not invalidate the canonical graph unless the
  emitter is configured as required.

### Determinism Failure

The compiler detects unstable output from a plugin.

Behavior:

- The compiler MUST reject unstable semantic output.
- The compiler SHOULD emit diagnostics identifying the plugin and pass.
- Cache entries from the plugin SHOULD be invalidated.

### Isolation Failure

The plugin violates its isolation or permission boundary.

Behavior:

- The host MUST terminate or disable the plugin.
- Required plugin isolation failure MUST fail the build.
- Optional plugin isolation failure SHOULD emit diagnostics.

## Plugin Examples

### OpenAPI Parser Plugin

Capabilities:

- `source-classifier`
- `parser`
- `resolver`
- `semantic-pass`

Passes:

- Classify `openapi.yaml`.
- Parse schemas into Model, Field, Route, Operation, and Resource facts.
- Resolve `$ref` schema references.
- Associate operations with generated Permission nodes when explicit
  security requirements exist.

Determinism:

- Schema paths are sorted.
- `$ref` resolution is deterministic.
- Remote references require explicit network permission and pinned digests.

### Mermaid Emitter Plugin

Capabilities:

- `emitter`

Passes:

- Consume validated graph.
- Emit `graph.mmd`.

Determinism:

- Nodes and edges are sorted by ID.
- Output includes graph content hash.
- No graph facts are modified.

### Architecture Diagnostics Plugin

Capabilities:

- `diagnostic-pass`

Passes:

- Inspect validated graph or candidate graph.
- Detect forbidden dependencies between configured layers.
- Emit diagnostics referencing offending nodes and edges.

Determinism:

- Layer rules are config-derived.
- Violations are sorted by edge ID.
- Suppressions are explicit and deterministic.

### TypeScript Framework Route Plugin

Capabilities:

- `semantic-pass`
- `diagnostic-pass`

Passes:

- Read TypeScript parser facts.
- Detect framework route declarations.
- Emit Route and Operation facts.
- Link handlers through REFERENCES or CALLS depending on evidence.
- Emit diagnostics for ambiguous route handlers.

Determinism:

- Framework rules are versioned.
- Ambiguous matches become diagnostics, not random choices.

## Security Considerations

Plugins are code execution.

Host implementations SHOULD:

- Require explicit plugin configuration.
- Prefer isolated execution for third-party plugins.
- Deny network access by default.
- Deny source mutation during graph compilation.
- Limit filesystem writes to cache and artifact roots.
- Capture plugin diagnostics and logs.
- Include plugin names and versions in build metadata.

Semantic graph output from untrusted plugins SHOULD be treated as
untrusted input until graph validation succeeds.

## Compatibility With RFC-0001, RFC-0002, and RFC-0003

This RFC depends on:

- RFC-0001 for Software Graph schema, extensions, provenance, diagnostics,
  and stable IDs.
- RFC-0002 for compiler stages, lifecycle, validation, serialization, and
  artifact commit.
- RFC-0003 when plugins consume Query Engine APIs.

Plugin system changes require an RFC when they alter:

- Pass kinds.
- Pass ordering semantics.
- Manifest schema.
- Capability negotiation.
- Isolation or permission semantics.
- Graph transformation rules.
- Required compatibility fields.

## Open Questions

- Should Ontoly maintain a signed plugin lockfile?
- Should plugin manifests be JSON only, or allow TypeScript config modules
  that resolve to JSON manifests?
- Should remote plugins be deferred until after local plugin isolation is
  stable?
- Should fixed-point pass groups be part of the first plugin API or kept
  internal until needed?
- Should emitters run before or after canonical graph artifact commit by
  default?
