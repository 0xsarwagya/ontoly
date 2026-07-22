import type {
  JsonObject,
  NodeType,
  RelationshipType,
  SoftwareGraph,
  SoftwareGraphDiagnostic,
  SoftwareGraphEdge,
  SoftwareGraphNode,
  SoftwareGraphRepository,
  SourceSpan,
  EdgeEvidence,
} from "@0xsarwagya/ontoly-core";
import type { GraphArtifactPaths } from "@0xsarwagya/ontoly-cache";

export type BuildMode = "clean" | "warm" | "watch" | "incremental" | "dry-run";

export const COMPILER_PIPELINE_VERSION = "1.0.0";

export const COMPILER_STAGE_IDS = [
  "invocation",
  "context-initialization",
  "configuration-loading",
  "repository-discovery",
  "source-inventory",
  "cache-loading-and-compatibility",
  "change-detection-and-invalidation",
  "frontend-planning",
  "frontend-parsing",
  "fact-normalization",
  "symbol-and-reference-resolution",
  "core-compiler-passes",
  "diagnostics-pipeline",
  "graph-construction",
  "optimization-passes",
  "graph-validation",
  "serialization-planning",
  "serialization",
  "artifact-commit",
] as const;

export type CompilerStageId = (typeof COMPILER_STAGE_IDS)[number];

export type PassKind =
  | "source-classifier"
  | "parser"
  | "resolver"
  | "semantic"
  | "diagnostic"
  | "optimization"
  | "validator"
  | "emitter";

export interface OntolyConfig {
  readonly root?: string | undefined;
  readonly outputDir?: string | undefined;
  readonly include?: readonly string[] | undefined;
  /**
   * Additional paths to skip during repository discovery, on top of the
   * built-in defaults (node_modules, dist, .next, .turbo, etc.).
   *
   * Two matching modes:
   * - Bare name (no `/`) — matches any path segment with that name, e.g.
   *   `"Pods"` skips every `Pods/` directory anywhere in the tree.
   * - Relative path (contains `/`) — anchored prefix match against the
   *   repo-relative path, e.g. `"apps/companion-app/ios"` skips exactly
   *   that subtree.
   */
  readonly exclude?: readonly string[] | undefined;
  readonly plugins?: readonly string[] | undefined;
  readonly parsers?: Record<string, boolean> | undefined;
}

/**
 * A map of repository-relative paths to file contents.
 *
 * Keys are POSIX-style relative paths (forward slashes, no leading `./`);
 * values are the UTF-8 file contents. Used to feed source into the compiler
 * without a repository on disk.
 */
export type InMemorySources = Record<string, string>;

/**
 * Read-only source access for the compiler.
 *
 * The default implementation reads from the filesystem, but callers can supply
 * an in-memory provider to build a Software Graph from source that never
 * touches disk. All paths are repository-relative and normalized.
 */
export interface SourceProvider {
  /** Repository-relative paths of every file the provider can serve, sorted. */
  readonly listFiles: () => readonly string[];
  /** File contents for a repository-relative path, or `undefined` if absent. */
  readonly readFile: (relativePath: string) => string | undefined;
  /** Whether the provider can serve the given repository-relative path. */
  readonly hasFile: (relativePath: string) => boolean;
}

export interface CompilerInvocation {
  readonly root: string;
  readonly mode: BuildMode;
  readonly configPath?: string | undefined;
  readonly outputDir: string;
  readonly write: boolean;
  /**
   * When set, source is read from this provider instead of the filesystem,
   * enabling zero-disk builds. `root` is still used to root relative paths and
   * to label the repository.
   */
  readonly sourceProvider?: SourceProvider | undefined;
}

export interface BuildSoftwareGraphOptions {
  readonly root?: string | undefined;
  readonly configPath?: string | undefined;
  readonly outputDir?: string | undefined;
  readonly write?: boolean | undefined;
  readonly mode?: BuildMode | undefined;
  readonly passes?: readonly CompilerPass[] | undefined;
  readonly validationHooks?: readonly GraphValidationHook[] | undefined;
  /**
   * Read source from this provider instead of the filesystem. When set, the
   * pipeline performs a zero-disk build rooted at `root`.
   */
  readonly sourceProvider?: SourceProvider | undefined;
}

export interface RepositoryDiscovery {
  readonly root: string;
  readonly name: string;
  readonly packageName?: string | undefined;
  readonly packageManager?: string | undefined;
  readonly packageJsonPath?: string | undefined;
  readonly files: readonly string[];
}

export interface SourceArtifact {
  readonly path: string;
  readonly kind: "file" | "package" | "config" | "schema" | "unknown";
  readonly digest: string;
}

export interface SourceInventory {
  readonly sources: readonly SourceArtifact[];
}

export interface CompilerCacheView {
  readonly compatible: boolean;
  readonly entries: ReadonlyMap<string, unknown>;
}

export interface CompilerExtensionRegistry {
  readonly namespaces: readonly string[];
}

export interface CompilerContext {
  readonly invocation: CompilerInvocation;
  readonly config: OntolyConfig;
  readonly repository: SoftwareGraphRepository;
  readonly diagnostics: DiagnosticSink;
  readonly extensions: CompilerExtensionRegistry;
  readonly passManager: PassManager;
  readonly validationHooks: readonly GraphValidationHook[];
}

export interface CompilerPipelineState {
  readonly stageOutputs: ReadonlyMap<CompilerStageId, JsonObject>;
  readonly stageTrace: readonly CompilerStageId[];
  readonly passResults: readonly PassExecutionRecord[];
  readonly discovery?: RepositoryDiscovery | undefined;
  readonly sources?: SourceInventory | undefined;
  readonly cache?: CompilerCacheView | undefined;
  readonly graph?: SoftwareGraph | undefined;
  readonly validation?: GraphValidationResult | undefined;
  readonly artifacts?: GraphArtifactPaths | undefined;
  readonly fatal: boolean;
}

export interface CompilerStageResult {
  readonly output?: JsonObject | undefined;
  readonly passResults?: readonly PassExecutionRecord[] | undefined;
  readonly discovery?: RepositoryDiscovery | undefined;
  readonly sources?: SourceInventory | undefined;
  readonly cache?: CompilerCacheView | undefined;
  readonly graph?: SoftwareGraph | undefined;
  readonly validation?: GraphValidationResult | undefined;
  readonly artifacts?: GraphArtifactPaths | undefined;
  readonly fatal?: boolean | undefined;
}

export interface CompilerStage {
  readonly id: CompilerStageId;
  readonly run: (
    context: CompilerContext,
    state: CompilerPipelineState,
  ) => Promise<CompilerStageResult> | CompilerStageResult;
}

export interface PipelineExecutorResult {
  readonly state: CompilerPipelineState;
}

export interface BuildSoftwareGraphResult {
  readonly status: "success" | "failed";
  readonly mode: BuildMode;
  readonly graph?: SoftwareGraph | undefined;
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly discovery: RepositoryDiscovery;
  readonly artifacts?: GraphArtifactPaths | undefined;
  readonly stages: readonly CompilerStageId[];
}

export interface WatchSoftwareGraphOptions extends BuildSoftwareGraphOptions {
  readonly debounceMs?: number | undefined;
  readonly onBuild?: ((result: BuildSoftwareGraphResult) => void | Promise<void>) | undefined;
  readonly onError?: ((error: unknown) => void) | undefined;
}

export interface WatchHandle {
  readonly close: () => void;
}

export interface DoctorCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly message: string;
}

export interface DiagnosticSink {
  readonly add: (diagnostic: SoftwareGraphDiagnostic) => SoftwareGraphDiagnostic;
  readonly list: () => readonly SoftwareGraphDiagnostic[];
  readonly hasErrors: () => boolean;
}

export type CompilerSymbolKind = NodeType;

export interface CompilerSymbolProvenance {
  readonly passId?: string | undefined;
  readonly parser?: string | undefined;
  readonly parserVersion?: string | undefined;
  readonly source?: string | undefined;
}

export interface CompilerSymbol {
  readonly id: string;
  readonly kind: CompilerSymbolKind;
  readonly name: string;
  readonly file?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly language?: string | undefined;
  readonly metadata?: JsonObject | undefined;
  readonly provenance?: CompilerSymbolProvenance | undefined;
}

export interface CompilerRelationship {
  readonly id?: string | undefined;
  readonly type: RelationshipType;
  readonly from: string;
  readonly to: string;
  readonly evidence?: readonly EdgeEvidence[] | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface CompilerGraphBuilder {
  readonly addNode: (node: SoftwareGraphNode) => void;
  readonly addSymbol: (symbol: CompilerSymbol) => void;
  readonly addEdge: (edge: SoftwareGraphEdge) => void;
  readonly addRelationship: (relationship: CompilerRelationship) => void;
  readonly addDiagnostic: (diagnostic: SoftwareGraphDiagnostic) => void;
  readonly build: (input: GraphBuildInput) => SoftwareGraph;
}

export interface GraphBuildInput {
  readonly repository: SoftwareGraphRepository;
  readonly fileCount: number;
  readonly parserVersions?: Record<string, string> | undefined;
  readonly durationMs?: number | undefined;
}

export interface CompilerPass {
  readonly id: string;
  readonly kind: PassKind;
  readonly stage: CompilerStageId;
  readonly semantic: boolean;
  readonly reads?: readonly string[] | undefined;
  readonly writes?: readonly string[] | undefined;
  readonly before?: readonly string[] | undefined;
  readonly after?: readonly string[] | undefined;
  readonly requires?: readonly string[] | undefined;
  readonly run: (
    context: CompilerContext,
    state: CompilerPipelineState,
  ) => Promise<CompilerPassResult> | CompilerPassResult;
}

export interface CompilerPassResult {
  readonly symbols?: readonly CompilerSymbol[] | undefined;
  readonly relationships?: readonly CompilerRelationship[] | undefined;
  readonly nodes?: readonly SoftwareGraphNode[] | undefined;
  readonly edges?: readonly SoftwareGraphEdge[] | undefined;
  readonly diagnostics?: readonly SoftwareGraphDiagnostic[] | undefined;
  readonly parserVersions?: Record<string, string> | undefined;
  readonly output?: JsonObject | undefined;
}

export interface PassExecutionRecord {
  readonly passId: string;
  readonly stage: CompilerStageId;
  readonly result: CompilerPassResult;
}

export interface PassManager {
  readonly passesForStage: (stage: CompilerStageId) => readonly CompilerPass[];
  readonly runStage: (
    stage: CompilerStageId,
    context: CompilerContext,
    state: CompilerPipelineState,
  ) => Promise<readonly PassExecutionRecord[]>;
}

export interface GraphValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface GraphValidationResult {
  readonly ok: boolean;
  readonly issues: readonly GraphValidationIssue[];
}

export interface GraphValidationHook {
  readonly id: string;
  readonly validate: (
    graph: SoftwareGraph,
    context: CompilerContext,
  ) => Promise<GraphValidationResult> | GraphValidationResult;
}
