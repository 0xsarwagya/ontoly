# RFC 0002: Compiler Pipeline

## Status

Draft

## Summary

This RFC defines the Ontoly compiler pipeline: the deterministic
multi-stage process that turns a repository into a validated Software Graph
as specified by RFC-0001.

This document does not implement compiler logic. It defines the long-term
architecture, lifecycle, invariants, extension points, failure behavior,
and stage contracts that Ontoly compiler implementations must follow.

## Normative Language

The words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as
defined by RFC 2119.

## Design Goals

1. **Deterministic builds.** Equivalent inputs and configuration MUST
   produce equivalent graph content, diagnostics, and content hashes.
2. **Explicit stages.** Each compiler stage MUST have defined inputs,
   outputs, side effects, failure modes, and extension hooks.
3. **Frontend neutrality.** TypeScript is a frontend, not the compiler.
   OpenAPI, GraphQL, Prisma, SQL, and future parsers MUST plug into the
   same pipeline.
4. **Graph-first architecture.** The compiler emits Software Graph facts,
   not query answers, prompts, embeddings, or generated SDKs.
5. **Incremental correctness.** Incremental builds MUST produce the same
   validated graph as a clean build for the same input.
6. **Recoverable diagnostics.** Non-fatal errors SHOULD become graph-native
   diagnostics when a valid partial graph can still be produced.
7. **Safe extensibility.** Plugins and compiler extensions MUST be able to
   participate without breaking determinism or core graph compatibility.
8. **Long-lived infrastructure.** The pipeline MUST be stable enough for
   package authors, plugin authors, and external tooling to depend on for
   years.

## Non-Goals

The compiler pipeline does not define:

- A query language.
- AI reasoning or model integration.
- Code generation.
- SDK generation.
- Documentation generation.
- Graph visualization.
- A hosted service.
- A binary graph format.
- A persistent database format.
- Language-specific AST schemas.

These may consume or extend compiler output, but they are not compiler
responsibilities.

## Compiler Responsibilities

The compiler is responsible for:

- Loading compiler configuration.
- Discovering repository structure.
- Discovering source artifacts.
- Selecting applicable frontends.
- Running parser frontends.
- Normalizing frontend output into Software Graph facts.
- Resolving symbols and references where deterministic resolution is
  available.
- Running compiler passes.
- Running optimization passes that do not change semantics.
- Producing graph-native diagnostics.
- Constructing a canonical Software Graph.
- Validating the graph against RFC-0001.
- Serializing graph artifacts.
- Managing incremental state.
- Exposing extension hooks.

The compiler is not responsible for:

- Answering questions about the repository.
- Choosing AI prompts.
- Executing generated code.
- Mutating source files.
- Inferring facts from probabilistic models.
- Producing consumer-specific artifacts as part of the core pipeline.

## Compiler Invariants

All compiler implementations MUST preserve these invariants:

1. **No AI in graph construction.** Compiler graph facts MUST NOT depend on
   probabilistic model output.
2. **Stable ordering.** Files, parser outputs, nodes, edges, diagnostics,
   and extensions MUST be processed in deterministic order.
3. **Stable IDs.** Node, edge, and diagnostic IDs MUST follow RFC-0001.
4. **No absolute paths in canonical graph content.** Local absolute paths
   MAY exist in compiler context, but MUST NOT appear in canonical graph
   fields.
5. **Explainable relationships.** Edges SHOULD contain provenance. Edges
   without provenance are invalid unless a future RFC explicitly permits
   them.
6. **Incremental equivalence.** A successful incremental build MUST be
   semantically equivalent to a successful clean build.
7. **Plugin containment.** Plugins MUST NOT mutate compiler internal state
   outside explicit hooks.
8. **Validation before serialization.** A graph MUST be validated before it
   is persisted as canonical output.
9. **Diagnostics are data.** Recoverable compiler problems SHOULD be
   represented as graph-native diagnostics.
10. **Core schema compatibility.** Extensions MUST NOT redefine RFC-0001
    core fields or semantics.

## Compiler Lifecycle

The compiler lifecycle is:

```text
Invocation
  -> Context initialization
  -> Configuration loading
  -> Repository discovery
  -> Source inventory
  -> Cache loading
  -> Frontend planning
  -> Frontend parsing
  -> Intermediate fact normalization
  -> Symbol and reference resolution
  -> Compiler passes
  -> Diagnostics aggregation
  -> Graph construction
  -> Optimization passes
  -> Graph validation
  -> Serialization
  -> Artifact commit
```

Lifecycle rules:

- A build MAY stop early on fatal errors.
- A build SHOULD emit diagnostics for recoverable errors.
- A persisted graph MUST be the result of a successful validation stage.
- A failed build MUST NOT partially overwrite the last valid canonical
  graph artifact.

## Build Modes

### Clean Build

A clean build ignores previous compiler state except immutable dependency
caches and rebuilds the graph from source inventory.

Use cases:

- First build.
- CI verification.
- Cache invalidation.
- Compiler upgrades.
- Spec version changes.

Rules:

- Clean builds MUST NOT trust previous graph facts.
- Clean builds MAY reuse package manager or parser dependency caches when
  those caches do not affect graph semantics.

### Warm Build

A warm build may reuse previous source digests, parsed frontend artifacts,
resolution data, and graph regions.

Rules:

- Warm builds MUST verify cache compatibility before reuse.
- Warm builds MUST produce the same graph as a clean build.
- Cache hits MUST be recorded in build metadata when exposed.

### Watch Build

A watch build runs repeatedly in response to source or configuration
changes.

Rules:

- Watch builds SHOULD debounce changes.
- Watch builds SHOULD preserve a last-known-valid graph when a rebuild
  fails.
- Watch builds MUST treat configuration changes as potentially invalidating
  all stages.

### Incremental Build

An incremental build invalidates and recomputes only affected source
regions and graph regions.

Rules:

- Incremental builds MUST be clean-build equivalent.
- Dependency invalidation MUST be conservative.
- If affected regions cannot be determined safely, the compiler MUST
  broaden invalidation or fall back to a clean build.

### Dry Run

A dry run executes the pipeline without committing artifacts.

Rules:

- Dry runs MAY emit diagnostics and graph previews.
- Dry runs MUST NOT modify canonical graph artifacts.

## Compiler Context

`CompilerContext` is the immutable or append-only build state shared across
stages.

```ts
interface CompilerContext {
  invocation: CompilerInvocation;
  config: CompilerConfig;
  repository: RepositoryContext;
  sources: SourceInventory;
  cache: CompilerCacheView;
  frontends: FrontendPlan;
  diagnostics: DiagnosticSink;
  extensions: ExtensionRegistry;
  clock: DeterministicClock;
  paths: PathService;
  content: ContentStore;
}
```

Rules:

- Context fields that affect graph semantics MUST be deterministic.
- Stages SHOULD receive a narrowed view of the context rather than mutable
  global state.
- Mutable compiler state MUST be append-only or scoped to a stage.
- Wall-clock time MAY be recorded in volatile build metadata but MUST NOT
  affect graph content hashes.

## Frontend Architecture

A frontend is responsible for one source family, language, schema, or
artifact type. Examples:

- TypeScript frontend.
- OpenAPI frontend.
- GraphQL frontend.
- Prisma frontend.
- SQL frontend.
- Package manifest frontend.

Frontends produce intermediate graph facts. They do not directly persist
graphs and do not own global graph validation.

Frontend responsibilities:

- Identify supported sources.
- Parse source artifacts.
- Emit source facts.
- Emit local diagnostics.
- Attach provenance.
- Declare dependencies on other sources when known.

Frontend non-responsibilities:

- Global graph validation.
- Cross-frontend canonicalization.
- Artifact persistence.
- Query execution.
- Consumer-specific output.

## Parser Abstraction

Parsers are frontend components that turn source artifacts into facts.

```ts
interface Parser {
  name: string;
  version: string;
  supportedSources: SourceMatcher;
  parse(input: ParserInput): ParserOutput;
}

interface ParserInput {
  context: ParserContext;
  sources: SourceArtifact[];
  previous?: ParserCache;
}

interface ParserOutput {
  facts: GraphFact[];
  diagnostics: Diagnostic[];
  dependencies: SourceDependency[];
  cache?: ParserCache;
}
```

Parser rules:

- Parsers MUST be deterministic for identical input.
- Parsers MUST NOT perform network access unless explicitly configured and
  represented in provenance.
- Parsers MUST NOT write canonical compiler artifacts.
- Parsers MUST attach producer provenance to emitted facts.
- Parser diagnostics MUST be converted to graph-native diagnostics.
- Parser caches MUST be versioned and invalidated when parser versions or
  relevant configuration changes.

## Intermediate Representation

Before graph construction, frontends emit `GraphFact` records.

```ts
type GraphFact =
  | NodeFact
  | EdgeFact
  | DiagnosticFact
  | ExtensionFact;
```

Purpose:

- Decouple frontend parsing from final graph assembly.
- Allow multiple frontends to contribute to the same node or edge.
- Preserve provenance before deduplication.
- Enable passes to enrich or reject facts before graph construction.

Rules:

- Facts MUST have deterministic keys.
- Facts MAY be merged during graph construction.
- Facts MUST NOT require parser-specific AST structures for interpretation.

## Pipeline Stages

Each stage below defines inputs, outputs, side effects, failure modes, and
extension hooks.

### Stage 1: Invocation

Captures CLI, API, watch, CI, or plugin-driven build intent.

Inputs:

- Command or API options.
- Current working directory.
- Environment selected by caller.

Outputs:

- `CompilerInvocation`.
- Selected build mode.
- Initial diagnostic sink.

Side effects:

- None, except process-level logging requested by caller.

Failure modes:

- Invalid command arguments.
- Unsupported build mode.
- Missing required root path.

Extension hooks:

- `onInvocationStart`
- `onInvocationResolved`

Hook constraints:

- Hooks MAY add diagnostics.
- Hooks MUST NOT mutate source files.

### Stage 2: Context Initialization

Creates deterministic services and build-local state.

Inputs:

- `CompilerInvocation`.

Outputs:

- `CompilerContext`.
- Path normalization service.
- Content store.
- Extension registry.

Side effects:

- MAY create an in-memory content-addressed store.
- MUST NOT write canonical graph artifacts.

Failure modes:

- Invalid repository root.
- Unsupported platform path semantics.
- Unable to initialize required compiler services.

Extension hooks:

- `onContextCreate`

Hook constraints:

- Hooks MAY register extension namespaces.
- Hooks MAY register frontends and passes.
- Hooks MUST NOT read arbitrary source files unless explicitly requested by
  a later stage.

### Stage 3: Configuration Loading

Loads Ontoly compiler configuration and relevant tool configuration.

Inputs:

- `CompilerContext`.
- Default compiler configuration.
- `ontoly.config.*` when present.
- Relevant package or workspace configuration.

Outputs:

- Normalized `CompilerConfig`.
- Configuration source records.
- Configuration diagnostics.

Side effects:

- MAY read configuration files.
- MUST NOT write graph artifacts.

Failure modes:

- Configuration parse failure.
- Unsupported config version.
- Invalid plugin declaration.
- Conflicting frontend configuration.

Extension hooks:

- `onConfigLoad`
- `onConfigNormalize`

Hook constraints:

- Hooks MAY validate extension config.
- Hooks MAY contribute diagnostics.
- Hooks MUST NOT make graph facts directly.

### Stage 4: Repository Discovery

Discovers repository identity, workspace layout, package manifests, and VCS
metadata.

Inputs:

- Normalized `CompilerConfig`.
- Repository root.
- Path service.

Outputs:

- `RepositoryContext`.
- Repository descriptor facts.
- Package and workspace source records.
- Discovery diagnostics.

Side effects:

- Reads directory entries and repository metadata.
- MAY read package manifests and VCS metadata.

Failure modes:

- Root does not exist.
- Root is unreadable.
- Workspace manifests are malformed.
- Package manager workspace configuration is inconsistent.

Extension hooks:

- `onRepositoryDiscover`
- `onWorkspaceDiscover`

Hook constraints:

- Hooks MAY contribute repository metadata extensions.
- Hooks MAY add virtual packages or source roots when configured.

### Stage 5: Source Inventory

Builds the canonical list of source artifacts eligible for parsing.

Inputs:

- `RepositoryContext`.
- Include and exclude rules.
- Frontend source matchers.
- Ignore rules.

Outputs:

- `SourceInventory`.
- Source digests.
- Source classification.
- Source dependency seeds.
- Inventory diagnostics.

Side effects:

- Reads file metadata and source content digests.
- MAY read small source files to determine classification.

Failure modes:

- Source file cannot be read.
- Source path conflicts after normalization.
- Unsupported source encoding.
- Include and exclude rules select no usable sources.

Extension hooks:

- `onSourceDiscovered`
- `onSourceClassified`
- `onSourceIgnored`

Hook constraints:

- Hooks MAY classify additional source kinds.
- Hooks MAY attach source metadata extensions.
- Hooks MUST NOT emit graph nodes or edges directly.

### Stage 6: Cache Loading and Compatibility

Loads previous compiler state for warm, watch, and incremental builds.

Inputs:

- `SourceInventory`.
- Compiler config hash.
- Compiler version.
- Software Graph spec version.
- Frontend and plugin versions.
- Previous cache artifacts.

Outputs:

- `CompilerCacheView`.
- Cache compatibility diagnostics.
- Invalidation plan seed.

Side effects:

- Reads cache artifacts.
- MAY discard incompatible cache entries.

Failure modes:

- Cache artifact unreadable.
- Cache schema unsupported.
- Cache content hash mismatch.
- Cache references missing sources.

Extension hooks:

- `onCacheLoad`
- `onCacheValidate`

Hook constraints:

- Hooks MAY validate namespaced cache entries.
- Hooks MUST tolerate cache absence.

### Stage 7: Change Detection and Invalidation

Determines which sources, parser outputs, resolution scopes, and graph
regions are affected by changes.

Inputs:

- Current source digests.
- Previous source digests.
- Source dependency graph.
- Parser dependency records.
- Config hash.
- Frontend versions.

Outputs:

- `InvalidationPlan`.
- Affected source set.
- Affected frontend set.
- Affected graph region hints.
- Invalidation diagnostics.

Side effects:

- None beyond diagnostics.

Failure modes:

- Dependency graph unavailable.
- Previous cache is incomplete.
- Source rename cannot be matched.
- Change impact cannot be bounded.

Extension hooks:

- `onInvalidate`

Hook constraints:

- Hooks MAY broaden invalidation.
- Hooks MUST NOT narrow invalidation unless they can prove equivalence.

Fallback:

- If invalidation cannot be proven safe, the compiler MUST fall back to a
  clean or broader rebuild.

### Stage 8: Frontend Planning

Assigns sources to frontends and creates deterministic parse tasks.

Inputs:

- `SourceInventory`.
- Registered frontends and parsers.
- `InvalidationPlan`.
- Compiler configuration.

Outputs:

- `FrontendPlan`.
- Ordered parse task graph.
- Frontend diagnostics.

Side effects:

- None.

Failure modes:

- No frontend can handle a required source.
- Multiple frontends claim exclusive ownership of a source.
- Frontend dependency cycle cannot be scheduled.

Extension hooks:

- `onFrontendPlan`
- `onParseTaskCreate`

Hook constraints:

- Hooks MAY register additional parse tasks.
- Hooks MUST preserve deterministic task ordering.

### Stage 9: Frontend Parsing

Runs parser tasks and emits intermediate facts.

Inputs:

- `FrontendPlan`.
- Source content.
- Parser caches.
- Parser-specific configuration.

Outputs:

- `ParserOutput` per task.
- Node facts.
- Edge facts.
- Diagnostic facts.
- Source dependency records.
- Parser cache updates.

Side effects:

- MAY populate parser-local caches.
- MUST NOT write canonical graph artifacts.

Failure modes:

- Syntax parse failure.
- Schema parse failure.
- Unsupported language feature.
- Parser crash.
- Parser timeout.
- Source dependency unavailable.

Extension hooks:

- `beforeParse`
- `afterParse`
- `onParserDiagnostic`

Hook constraints:

- Hooks MAY observe parser output.
- Hooks MAY add diagnostics.
- Hooks MUST NOT mutate parser facts in place; transformations happen in
  later pass stages.

Failure handling:

- Recoverable parse failures SHOULD emit diagnostics and partial facts when
  safe.
- Fatal parser crashes SHOULD isolate the failed frontend when possible and
  continue with unaffected frontends only if graph validity can be
  preserved.

### Stage 10: Fact Normalization

Normalizes frontend output into canonical intermediate facts.

Inputs:

- Raw parser facts.
- Parser diagnostics.
- Source inventory.
- Path service.
- Spec version.

Outputs:

- Normalized facts.
- Normalized diagnostics.
- Fact provenance.

Side effects:

- None.

Failure modes:

- Invalid fact shape.
- Unsupported node or edge type.
- Non-canonical path.
- Missing provenance.
- Invalid extension namespace.

Extension hooks:

- `onFactNormalize`

Hook constraints:

- Hooks MAY normalize namespaced extension facts they own.
- Hooks MUST NOT rewrite core facts from other producers unless explicitly
  configured as a compiler pass.

### Stage 11: Symbol and Reference Resolution

Resolves names, imports, exports, types, schema references, and cross-source
links.

Inputs:

- Normalized facts.
- Source dependency records.
- Language symbol tables.
- Schema registries.
- Package and module resolution configuration.

Outputs:

- Resolved edge facts.
- Alias records.
- Resolution diagnostics.
- Updated dependency records.

Side effects:

- MAY update resolution caches.
- MUST NOT write graph artifacts.

Failure modes:

- Unresolved import.
- Ambiguous symbol.
- Broken schema reference.
- Circular resolution dependency.
- Unsupported resolver configuration.

Extension hooks:

- `onResolveStart`
- `resolveReference`
- `onResolveComplete`

Hook constraints:

- Hooks MAY provide resolvers for extension source kinds.
- Hooks MUST return deterministic results.
- Hooks MUST include provenance for resolved facts.

### Stage 12: Core Compiler Passes

Runs deterministic passes that enrich, reconcile, or derive graph facts.

Inputs:

- Normalized and resolved facts.
- Compiler context.
- Pass registry.

Outputs:

- Additional facts.
- Rewritten facts through explicit replacement records.
- Pass diagnostics.

Side effects:

- MAY update pass-local caches.
- MUST NOT persist canonical graph artifacts.

Failure modes:

- Pass dependency unavailable.
- Pass emits invalid facts.
- Pass order cycle.
- Pass timeout or crash.

Extension hooks:

- `registerCompilerPass`
- `beforePass`
- `afterPass`

Hook constraints:

- Passes MUST declare:
  - name
  - version
  - input fact kinds
  - output fact kinds
  - dependencies
  - whether they are semantic or non-semantic
- Semantic passes MAY add graph facts.
- Non-semantic passes MUST NOT change graph meaning.

Examples of core passes:

- Module export reconciliation.
- Package dependency derivation.
- Route to operation association.
- Model field association.
- Permission association.
- Dead reference detection.

### Stage 13: Diagnostics Pipeline

Aggregates, normalizes, deduplicates, ranks, and validates diagnostics.

Inputs:

- Diagnostics from all previous stages.
- Facts.
- Compiler context.

Outputs:

- Graph-native diagnostics.
- Fatal build status when applicable.
- Diagnostic summary.

Side effects:

- MAY emit logs through caller-provided reporter.
- MUST NOT mutate source files.

Failure modes:

- Diagnostic references unknown facts.
- Diagnostic code invalid.
- Diagnostic severity invalid.
- Diagnostic provenance missing.

Extension hooks:

- `onDiagnosticCreate`
- `onDiagnosticNormalize`
- `onDiagnosticFinalize`

Hook constraints:

- Hooks MAY add namespaced diagnostic metadata.
- Hooks MAY suppress diagnostics only through explicit user configuration.
- Suppression MUST be represented in metadata or build logs.

### Stage 14: Graph Construction

Converts facts into the RFC-0001 Software Graph model.

Inputs:

- Valid normalized facts.
- Resolved facts.
- Diagnostics.
- Repository descriptor.
- Graph metadata seed.

Outputs:

- Unoptimized `SoftwareGraph`.
- Node merge records.
- Edge merge records.
- Construction diagnostics.

Side effects:

- None.

Failure modes:

- Duplicate unmergeable node IDs.
- Duplicate unmergeable edge IDs.
- Edge references missing node.
- Required graph field missing.
- Invalid provenance.

Extension hooks:

- `beforeGraphConstruct`
- `onNodeMerge`
- `onEdgeMerge`
- `afterGraphConstruct`

Hook constraints:

- Hooks MAY observe merge decisions.
- Hooks MAY contribute namespaced metadata.
- Hooks MUST NOT bypass core graph invariants.

Construction rules:

- Multiple facts for the same node SHOULD merge when they describe the same
  semantic entity.
- Multiple facts for the same edge SHOULD merge provenance.
- Conflicting core fields MUST produce diagnostics.
- Unresolvable conflicts MUST fail validation.

### Stage 15: Optimization Passes

Runs non-semantic graph cleanup and indexing passes.

Inputs:

- Unoptimized Software Graph.
- Optimization pass registry.
- Compiler configuration.

Outputs:

- Optimized Software Graph.
- Derived indexes.
- Optimization diagnostics.

Side effects:

- MAY write non-canonical performance caches after successful validation.
- MUST NOT change semantic graph meaning.

Failure modes:

- Optimization emits invalid graph.
- Index construction fails.
- Non-semantic pass changes content hash unexpectedly.

Extension hooks:

- `registerOptimizationPass`
- `beforeOptimize`
- `afterOptimize`

Hook constraints:

- Optimization passes MUST be semantics-preserving.
- Optimization passes MAY sort, dedupe, index, compact, and annotate
  volatile metadata.
- Optimization passes MUST NOT add semantic nodes or edges.

Examples:

- Stable sorting.
- Edge provenance deduplication.
- Derived index construction.
- Metadata count computation.
- Canonical path normalization.

### Stage 16: Graph Validation

Validates the graph against RFC-0001 and compiler invariants.

Inputs:

- Optimized Software Graph.
- Software Graph spec validator.
- Extension validators.

Outputs:

- Validated Software Graph.
- Validation diagnostics.
- Fatal or non-fatal validation result.

Side effects:

- None.

Failure modes:

- Unsupported spec version.
- Invalid node ID.
- Invalid edge ID.
- Missing edge endpoint.
- Invalid diagnostic reference.
- Invalid extension namespace.
- Metadata counts mismatch.
- Content hash mismatch.

Extension hooks:

- `registerGraphValidator`
- `onGraphValidate`

Hook constraints:

- Extension validators MAY validate namespaced metadata.
- Extension validation failure MUST NOT invalidate core graph content unless
  the extension is declared required by configuration or compatibility
  metadata.

Validation rules:

- Core validation MUST run before extension validation.
- A graph with core validation errors MUST NOT be serialized as the
  canonical graph artifact.
- Warnings MAY be serialized as diagnostics if the graph is otherwise valid.

### Stage 17: Serialization Planning

Determines what artifacts should be written and how canonical JSON should
be produced.

Inputs:

- Validated Software Graph.
- Build mode.
- Output configuration.
- Previous artifact manifest.

Outputs:

- Serialization plan.
- Artifact manifest.
- Temporary artifact paths.

Side effects:

- MAY create temporary output directories.
- MUST NOT replace canonical artifacts yet.

Failure modes:

- Output directory invalid.
- Unsupported serializer.
- Insufficient permissions.
- Artifact path escapes output root.

Extension hooks:

- `onSerializePlan`

Hook constraints:

- Hooks MAY request additional non-canonical artifacts.
- Hooks MUST NOT alter canonical graph serialization.

### Stage 18: Serialization

Serializes the validated graph and derived artifacts.

Inputs:

- Validated Software Graph.
- Serialization plan.
- Canonical JSON serializer.
- Derived artifact serializers.

Outputs:

- Canonical graph JSON bytes.
- Optional diagnostics JSON.
- Optional indexes JSON.
- Optional metadata JSON.
- Optional cache updates.
- Artifact content hashes.

Side effects:

- Writes temporary artifact files.
- MAY write non-canonical extension artifacts.

Failure modes:

- Canonical JSON serialization failure.
- Content hash mismatch.
- Temporary write failure.
- Extension artifact serialization failure.

Extension hooks:

- `beforeSerialize`
- `afterSerialize`

Hook constraints:

- Hooks MAY serialize plugin artifacts.
- Hooks MUST NOT mutate the validated graph.
- Failed optional extension artifact serialization SHOULD NOT invalidate the
  canonical graph unless configured as required.

### Stage 19: Artifact Commit

Atomically promotes serialized temporary artifacts to canonical output
locations.

Inputs:

- Serialized temporary artifacts.
- Artifact manifest.
- Last-known-valid artifact manifest.

Outputs:

- Committed canonical graph artifact.
- Committed derived artifacts.
- Updated cache manifest.
- Build result.

Side effects:

- Replaces output artifacts atomically when possible.
- Updates cache artifacts.
- MAY preserve previous valid graph on failure.

Failure modes:

- Atomic rename unsupported.
- Destination unwritable.
- Concurrent writer conflict.
- Cache commit failure.

Extension hooks:

- `beforeArtifactCommit`
- `afterArtifactCommit`

Hook constraints:

- Hooks MAY observe committed artifact paths.
- Hooks MUST NOT mutate canonical graph bytes after commit.

Commit rules:

- The compiler MUST NOT leave a partially written canonical graph.
- If commit fails, the previous valid graph SHOULD remain available.
- Cache commit failure SHOULD NOT invalidate a successfully committed graph,
  but MUST be reported.

## Incremental Compilation

Incremental compilation is an optimization of the pipeline, not a different
semantic mode.

### Incremental State

Incremental state SHOULD include:

- Compiler config hash.
- Software Graph spec version.
- Compiler package versions.
- Frontend versions.
- Plugin versions.
- Source digests.
- Source classification.
- Source dependency graph.
- Parser cache entries.
- Resolution cache entries.
- Fact ownership by source.
- Graph region ownership by fact.
- Last validated graph content hash.

### Invalidation Rules

A source change MUST invalidate:

- The changed source.
- Parser outputs for that source.
- Facts produced by that source.
- Resolved references from or to that source when affected.
- Compiler passes that depend on affected facts.
- Graph regions containing affected nodes, edges, or diagnostics.

A config change MUST invalidate:

- Every stage whose behavior depends on the changed config key.
- All downstream stages.

A parser, compiler, plugin, or spec version change MUST invalidate:

- Caches owned by that producer.
- Facts owned by that producer unless compatibility metadata proves reuse is
  safe.

### Incremental Correctness

An incremental build MUST:

- Produce the same canonical graph as a clean build.
- Record diagnostics for invalidated regions consistently.
- Recompute content hashes after graph construction.
- Revalidate the full graph or a validation-equivalent affected subset.

If equivalence cannot be guaranteed, the compiler MUST fall back to a
broader invalidation or clean build.

## Diagnostics Pipeline

Diagnostics flow through the same pipeline as graph facts.

Diagnostic sources:

- Configuration loading.
- Repository discovery.
- Source inventory.
- Cache loading.
- Invalidation.
- Frontend parsing.
- Fact normalization.
- Resolution.
- Compiler passes.
- Graph construction.
- Optimization.
- Validation.
- Serialization.
- Artifact commit.
- Plugins and extensions.

Diagnostic rules:

- Diagnostics MUST use RFC-0001 graph-native diagnostic shape.
- Diagnostics SHOULD reference nodes or edges when available.
- Diagnostics SHOULD reference source ranges when available.
- Fatal errors SHOULD still produce diagnostics when possible.
- Diagnostics MUST be sorted deterministically.
- Duplicate diagnostics SHOULD be merged by stable diagnostic ID.

## Graph Construction and Validation Relationship

Graph construction creates a candidate graph.

Graph validation decides whether that candidate is a valid Software Graph.

Rules:

- Construction MAY produce a graph with internal conflicts so diagnostics
  can reference the conflict.
- Validation MUST reject graphs with core invariant violations.
- A rejected graph MAY be returned to API callers as an invalid build result
  for debugging, but MUST NOT be committed as canonical output.
- Consumers SHOULD only use validated graphs.

## Extension Points

Compiler extension points are explicit. Extensions MAY participate through:

- Configuration schemas.
- Source classifiers.
- Frontends.
- Parsers.
- Resolvers.
- Compiler passes.
- Diagnostic processors.
- Optimization passes.
- Graph validators.
- Serializers for non-canonical artifacts.
- Cache namespace handlers.
- Build reporters.

Extension rules:

- Extensions MUST declare name and version.
- Extensions MUST declare supported Software Graph spec versions.
- Extensions MUST declare which hooks they use.
- Extensions MUST declare whether outputs are semantic.
- Extensions MUST be deterministic.
- Extensions MUST namespace metadata and cache data.
- Extensions MUST NOT modify core schema semantics.
- Extensions MUST NOT require network access unless explicitly configured.
- Extensions that require network access MUST include source and provenance
  records sufficient for reproducibility.

## Plugin Participation

Plugins are downstream graph participants by default.

Plugin roles:

1. **Compiler plugin.** Participates in compiler hooks and can add facts or
   validation.
2. **Graph consumer plugin.** Receives a validated Software Graph and emits
   artifacts such as docs, diagrams, reports, or SDKs.

Rules:

- Graph consumer plugins MUST run after graph validation.
- Compiler plugins MAY run before validation only through registered hooks.
- Compiler plugins that add semantic facts MUST identify themselves as
  producers in provenance.
- Plugins MUST NOT mutate a validated graph in place.
- Plugin artifacts MUST NOT be confused with canonical graph artifacts.

Failure handling:

- A required compiler plugin failure MAY fail the build.
- An optional consumer plugin failure SHOULD fail only that plugin's
  artifact generation.
- Plugin failures SHOULD emit graph-native diagnostics when associated with
  graph content.

## Failure Handling

Failures are classified as:

### Fatal Failures

Fatal failures prevent a valid graph from being produced.

Examples:

- Unsupported Software Graph spec version.
- Invalid compiler configuration.
- Repository root unreadable.
- Core graph validation failure.
- Canonical serialization failure.

Behavior:

- Build result MUST be failure.
- Canonical graph artifact MUST NOT be replaced.
- Diagnostics SHOULD be emitted when possible.

### Recoverable Failures

Recoverable failures allow a valid partial graph.

Examples:

- Unresolved import.
- Unsupported source file.
- Parser failed for one optional source.
- Low-confidence relationship.
- Optional plugin failed.

Behavior:

- Build result MAY be success with diagnostics.
- Affected graph facts SHOULD include low-confidence provenance or
  diagnostics.
- The graph MUST still pass core validation.

### Degraded Failures

Degraded failures disable an optimization but preserve correctness.

Examples:

- Cache unavailable.
- Incremental invalidation incomplete.
- Index write failed.
- Optional derived artifact failed.

Behavior:

- Compiler SHOULD fall back to clean build or broader invalidation.
- Compiler SHOULD emit diagnostics or build warnings.
- Canonical graph may still be committed if validation succeeds.

## Serialization and Artifact Contract

Canonical output:

```text
.ontoly/graph.json
```

Derived outputs MAY include:

```text
.ontoly/diagnostics.json
.ontoly/indexes.json
.ontoly/metadata.json
.ontoly/cache.json
.ontoly/artifacts/
```

Rules:

- `graph.json` is the canonical graph.
- Derived outputs MUST be reproducible or explicitly marked non-canonical.
- Cache files MUST be versioned and namespaced.
- Artifact writes SHOULD be atomic.
- Canonical graph bytes MUST come from the RFC-0001 canonical JSON
  serializer.

## Build Result

Every build returns a structured result:

```ts
interface BuildResult {
  status: "success" | "failed";
  mode: BuildMode;
  graph?: SoftwareGraph;
  diagnostics: Diagnostic[];
  artifacts: ArtifactManifest;
  metadata: BuildMetadata;
}
```

Rules:

- `graph` MUST be present only when a validated graph is available, unless
  an API explicitly requests invalid debug output.
- `diagnostics` MUST include fatal and non-fatal diagnostics.
- `artifacts` MUST identify committed artifacts only.
- `metadata` MAY include volatile timing data that is excluded from graph
  content hash.

## Compatibility With RFC-0001

The compiler pipeline depends on RFC-0001 for:

- Software Graph document shape.
- Node, edge, diagnostic, metadata, and extension models.
- Stable identifier rules.
- Serialization rules.
- Validation requirements.
- Spec version negotiation.

Any compiler pipeline change that alters RFC-0001 graph semantics MUST
update RFC-0001 or create a successor graph-spec RFC.

Any compiler pipeline change that alters stage semantics, plugin hooks,
cache compatibility, validation requirements, or artifact commit behavior
MUST go through an RFC.

## Open Questions

- Should Ontoly publish a formal compiler pass manifest schema?
- Should parser outputs be standardized as a separate public IR?
- Should cache manifests be part of a future RFC or remain implementation
  detail?
- Which compiler hooks should be stable in the first public plugin API?
- Should required consumer plugins be allowed to fail canonical graph
  builds, or only their own artifact generation?
