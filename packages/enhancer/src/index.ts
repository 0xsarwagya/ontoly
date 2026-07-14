import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  SOFTWARE_GRAPH_VERSION,
  stableHash,
  stableStringify,
  type GraphIndexes,
  type JsonObject,
  type JsonValue,
  type SoftwareGraph,
  type SoftwareGraphDiagnostic,
} from "@0xsarwagya/ontoly-core";
import type { SemanticIndex } from "@0xsarwagya/ontoly-semantic-index";

export const ENHANCER_API_VERSION = "1.0.0";
export const ENHANCER_MANIFEST_VERSION = "1.0.0";
export const ARTIFACT_MODEL_VERSION = "1.0.0";

export type ArtifactKind =
  | "SoftwareGraph"
  | "SemanticIndex"
  | "RepositorySummary"
  | "ArchitectureReport"
  | "HealthReport"
  | "RiskReport"
  | "MarkdownDocs"
  | "MermaidDiagram"
  | "HtmlGraph"
  | "OpenAPI"
  | "SDK"
  | "Coverage"
  | "Evaluation"
  | "CapabilityCatalog"
  | "ValidationReport"
  | "EvidencePack"
  | "Custom";

export interface ArtifactSchema {
  readonly version: string;
  readonly mediaType: string;
  readonly description?: string | undefined;
  readonly jsonSchema?: JsonObject | undefined;
}

export interface ArtifactDescriptor {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly schema: ArtifactSchema;
}

export interface ArtifactProvenance {
  readonly source: "SoftwareGraph" | "Enhancer" | "External";
  readonly graphHash: string;
  readonly producedBy?: string | undefined;
  readonly enhancerVersion?: string | undefined;
  readonly inputArtifactHashes: Record<string, string>;
}

export interface OntolyArtifact<T extends JsonValue = JsonValue> {
  readonly descriptor: ArtifactDescriptor;
  readonly data: T;
  readonly hash: string;
  readonly graphHash: string;
  readonly createdAt: string;
  readonly dependencies: readonly string[];
  readonly provenance: ArtifactProvenance;
}

export interface EnhancerRequirement {
  readonly artifact: string;
  readonly version?: string | undefined;
  readonly optional?: boolean | undefined;
}

export interface EnhancerManifest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly apiVersion: string;
  readonly inputs: readonly EnhancerRequirement[];
  readonly outputs: readonly ArtifactDescriptor[];
  readonly dependencies: readonly string[];
  readonly supportedGraphVersion: string;
  readonly supportsIncremental: boolean;
}

export interface EnhancerValidationIssue {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly enhancerId?: string | undefined;
  readonly artifactId?: string | undefined;
}

export interface EnhancerRunResult {
  readonly artifacts: readonly OntolyArtifact[];
  readonly diagnostics?: readonly SoftwareGraphDiagnostic[] | undefined;
  readonly statistics?: JsonObject | undefined;
}

export interface Enhancer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly requires: readonly EnhancerRequirement[];
  readonly produces: readonly ArtifactDescriptor[];
  readonly manifest: () => EnhancerManifest;
  readonly before: (context: EnhancerContext) => Promise<void> | void;
  readonly after: (context: EnhancerContext, result: EnhancerRunResult) => Promise<void> | void;
  readonly dependencies: () => readonly string[];
  readonly run: (context: EnhancerContext) => Promise<EnhancerRunResult> | EnhancerRunResult;
  readonly validate: (context: EnhancerContext) => readonly EnhancerValidationIssue[];
  readonly supportsIncremental: () => boolean;
  readonly cacheKey: (context: EnhancerContext) => string;
}

export interface ReadonlyEnhancerFilesystem {
  readonly readFile: (path: string) => Promise<string>;
  readonly exists: (path: string) => Promise<boolean>;
  readonly listFiles: (path: string) => Promise<readonly string[]>;
}

export interface EnhancerLogger {
  readonly info: (message: string) => void;
  readonly warning: (message: string) => void;
  readonly error: (message: string) => void;
  readonly debug: (message: string) => void;
}

export interface EnhancerCache {
  readonly get: (key: string) => Promise<EnhancerRunResult | undefined> | EnhancerRunResult | undefined;
  readonly set: (key: string, value: EnhancerRunResult) => Promise<void> | void;
  readonly has: (key: string) => Promise<boolean> | boolean;
}

export interface ArtifactRegistry {
  readonly register: (descriptor: ArtifactDescriptor) => ArtifactRegistry;
  readonly put: (artifact: OntolyArtifact) => ArtifactRegistry;
  readonly get: <T extends JsonValue = JsonValue>(artifactId: string) => OntolyArtifact<T> | undefined;
  readonly require: <T extends JsonValue = JsonValue>(artifactId: string) => OntolyArtifact<T>;
  readonly has: (artifactId: string) => boolean;
  readonly descriptors: () => readonly ArtifactDescriptor[];
  readonly artifacts: () => readonly OntolyArtifact[];
  readonly toJSON: () => JsonObject;
}

export interface EnhancerContext {
  readonly graph: SoftwareGraph;
  readonly semanticIndex?: SemanticIndex | undefined;
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly statistics: JsonObject;
  readonly indexes: GraphIndexes;
  readonly configuration: JsonObject;
  readonly filesystem: ReadonlyEnhancerFilesystem;
  readonly logger: EnhancerLogger;
  readonly cache: EnhancerCache;
  readonly artifacts: ArtifactRegistry;
}

export interface CreateEnhancerContextOptions {
  readonly graph: SoftwareGraph;
  readonly semanticIndex?: SemanticIndex | undefined;
  readonly statistics?: JsonObject | undefined;
  readonly configuration?: JsonObject | undefined;
  readonly filesystem?: ReadonlyEnhancerFilesystem | undefined;
  readonly logger?: EnhancerLogger | undefined;
  readonly cache?: EnhancerCache | undefined;
  readonly artifacts?: ArtifactRegistry | undefined;
}

export interface DefineEnhancerInput {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly requires?: readonly EnhancerRequirement[] | undefined;
  readonly produces?: readonly ArtifactDescriptor[] | undefined;
  readonly before?: ((context: EnhancerContext) => Promise<void> | void) | undefined;
  readonly after?: ((context: EnhancerContext, result: EnhancerRunResult) => Promise<void> | void) | undefined;
  readonly dependencies?: (() => readonly string[]) | readonly string[] | undefined;
  readonly run: (context: EnhancerContext) => Promise<EnhancerRunResult> | EnhancerRunResult;
  readonly validate?: ((context: EnhancerContext) => readonly EnhancerValidationIssue[]) | undefined;
  readonly supportsIncremental?: (() => boolean) | boolean | undefined;
  readonly cacheKey?: ((context: EnhancerContext) => string) | undefined;
  readonly supportedGraphVersion?: string | undefined;
}

export interface EnhancerExecution {
  readonly enhancerId: string;
  readonly status: "executed" | "cached" | "skipped" | "failed";
  readonly cacheKey: string;
  readonly artifacts: readonly OntolyArtifact[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly statistics: JsonObject;
  readonly durationMs: number;
}

export interface EnhancerPipelineResult {
  readonly graphHash: string;
  readonly executions: readonly EnhancerExecution[];
  readonly artifacts: readonly OntolyArtifact[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly statistics: JsonObject;
  readonly deterministicHash: string;
}

export interface EnhancerExecutionPlan {
  readonly enhancers: readonly Enhancer[];
  readonly levels: readonly (readonly Enhancer[])[];
  readonly edges: readonly EnhancerDependencyEdge[];
  readonly issues: readonly EnhancerValidationIssue[];
}

export interface EnhancerDependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly reason: string;
}

export interface RunEnhancerPipelineOptions {
  readonly enhancers: readonly Enhancer[];
  readonly context: EnhancerContext;
  readonly parallel?: boolean | undefined;
  readonly incremental?: boolean | undefined;
}

export interface DiscoverEnhancerOptions {
  readonly root: string;
  readonly searchPaths?: readonly string[] | undefined;
}

export interface DiscoveredEnhancerManifest {
  readonly path: string;
  readonly manifest: EnhancerManifest;
  readonly issues: readonly EnhancerValidationIssue[];
}

export interface EnhancerTestHarness {
  readonly context: EnhancerContext;
  readonly run: (enhancers: readonly Enhancer[]) => Promise<EnhancerPipelineResult>;
  readonly assertDeterministic: (enhancers: readonly Enhancer[]) => Promise<void>;
  readonly snapshot: (result: EnhancerPipelineResult) => JsonObject;
}

export const ARTIFACT_DESCRIPTORS = {
  SoftwareGraph: artifactDescriptor({
    id: "SoftwareGraph",
    kind: "SoftwareGraph",
    name: "Software Graph",
    version: SOFTWARE_GRAPH_VERSION,
    description: "Canonical immutable Ontoly Software Graph.",
  }),
  SemanticIndex: artifactDescriptor({
    id: "SemanticIndex",
    kind: "SemanticIndex",
    name: "Semantic Index",
    version: "1.0.0",
    description: "Deterministic repository vocabulary and intent index.",
  }),
  CapabilityCatalog: artifactDescriptor({
    id: "CapabilityCatalog",
    kind: "CapabilityCatalog",
    name: "Capability Catalog",
    version: "1.0.0",
    description: "Deterministic catalog of Ontoly capabilities and schemas.",
  }),
  EvidencePack: artifactDescriptor({
    id: "EvidencePack",
    kind: "EvidencePack",
    name: "Evidence Pack",
    version: "1.0.0",
    description: "Compact deterministic graph evidence for agent, MCP, CLI, and Workbench workflows.",
  }),
  RepositorySummary: artifactDescriptor({
    id: "RepositorySummary",
    kind: "RepositorySummary",
    name: "Repository Summary",
    version: "1.0.0",
    description: "Repository-wide deterministic summary derived from graph capabilities.",
  }),
  HealthReport: artifactDescriptor({
    id: "HealthReport",
    kind: "HealthReport",
    name: "Health Report",
    version: "1.0.0",
    description: "Repository health report derived from graph diagnostics, cycles, and hotspots.",
  }),
  RiskReport: artifactDescriptor({
    id: "RiskReport",
    kind: "RiskReport",
    name: "Risk Report",
    version: "1.0.0",
    description: "Repository risk report derived from graph evidence.",
  }),
  DeadCodeReport: artifactDescriptor({
    id: "DeadCodeReport",
    kind: "Custom",
    name: "Dead Code Report",
    version: "1.0.0",
    description: "Potential dead-code report derived from graph usage evidence.",
  }),
  ValidationReport: artifactDescriptor({
    id: "ValidationReport",
    kind: "ValidationReport",
    name: "Validation Report",
    version: "1.0.0",
    description: "Graph-native validation diagnostics and consistency summary.",
  }),
  Coverage: artifactDescriptor({
    id: "Coverage",
    kind: "Coverage",
    name: "Semantic Coverage",
    version: "1.0.0",
    description: "Semantic coverage and trust report.",
  }),
  ArchitectureReport: artifactDescriptor({
    id: "ArchitectureReport",
    kind: "ArchitectureReport",
    name: "Architecture Report",
    version: "1.0.0",
    description: "Architecture-level report derived from Software Graph facts.",
  }),
  MarkdownDocs: artifactDescriptor({
    id: "MarkdownDocs",
    kind: "MarkdownDocs",
    name: "Markdown Documentation",
    version: "1.0.0",
    description: "Markdown documentation generated from graph artifacts.",
    mediaType: "text/markdown",
  }),
  MermaidDiagram: artifactDescriptor({
    id: "MermaidDiagram",
    kind: "MermaidDiagram",
    name: "Mermaid Diagram",
    version: "1.0.0",
    description: "Mermaid diagram generated from graph artifacts.",
    mediaType: "text/vnd.mermaid",
  }),
  HtmlGraph: artifactDescriptor({
    id: "HtmlGraph",
    kind: "HtmlGraph",
    name: "HTML Graph",
    version: "1.0.0",
    description: "Interactive HTML graph artifact.",
    mediaType: "text/html",
  }),
  Evaluation: artifactDescriptor({
    id: "Evaluation",
    kind: "Evaluation",
    name: "Evaluation",
    version: "1.0.0",
    description: "Deterministic evaluation output.",
  }),
} as const;

export function artifactDescriptor(input: {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly mediaType?: string | undefined;
  readonly jsonSchema?: JsonObject | undefined;
}): ArtifactDescriptor {
  return {
    id: input.id,
    kind: input.kind,
    name: input.name,
    version: input.version,
    description: input.description,
    schema: {
      version: ARTIFACT_MODEL_VERSION,
      mediaType: input.mediaType ?? "application/json",
      description: input.description,
      ...(input.jsonSchema ? { jsonSchema: input.jsonSchema } : {}),
    },
  };
}

export function artifactRequirement(
  artifact: string,
  options: { readonly version?: string | undefined; readonly optional?: boolean | undefined } = {},
): EnhancerRequirement {
  return {
    artifact,
    ...(options.version ? { version: options.version } : {}),
    ...(options.optional !== undefined ? { optional: options.optional } : {}),
  };
}

export function createArtifact<T extends JsonValue>(input: {
  readonly descriptor: ArtifactDescriptor;
  readonly data: T;
  readonly graphHash: string;
  readonly graphGeneratedAt?: string | undefined;
  readonly producedBy?: string | undefined;
  readonly enhancerVersion?: string | undefined;
  readonly dependencies?: readonly OntolyArtifact[] | undefined;
}): OntolyArtifact<T> {
  const inputArtifactHashes = Object.fromEntries(
    [...(input.dependencies ?? [])]
      .map((artifact) => [artifact.descriptor.id, artifact.hash] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const dependencies = Object.keys(inputArtifactHashes).sort();
  const provenance: ArtifactProvenance = {
    source: input.producedBy ? "Enhancer" : "SoftwareGraph",
    graphHash: input.graphHash,
    ...(input.producedBy ? { producedBy: input.producedBy } : {}),
    ...(input.enhancerVersion ? { enhancerVersion: input.enhancerVersion } : {}),
    inputArtifactHashes,
  };
  const hashInput = {
    descriptor: input.descriptor,
    data: input.data,
    graphHash: input.graphHash,
    dependencies,
    provenance,
  };

  return deepFreeze({
    descriptor: input.descriptor,
    data: input.data,
    hash: stableHash(stableStringify(hashInput)),
    graphHash: input.graphHash,
    createdAt: input.graphGeneratedAt ?? "1970-01-01T00:00:00.000Z",
    dependencies,
    provenance,
  });
}

export function createArtifactRegistry(initialArtifacts: readonly OntolyArtifact[] = []): ArtifactRegistry {
  const descriptors = new Map<string, ArtifactDescriptor>();
  const artifacts = new Map<string, OntolyArtifact>();

  const registry: ArtifactRegistry = {
    register: (descriptor) => {
      descriptors.set(descriptor.id, deepFreeze(descriptor));
      return registry;
    },
    put: (artifact) => {
      descriptors.set(artifact.descriptor.id, artifact.descriptor);
      artifacts.set(artifact.descriptor.id, deepFreeze(artifact));
      return registry;
    },
    get: <T extends JsonValue = JsonValue>(artifactId: string) => artifacts.get(artifactId) as OntolyArtifact<T> | undefined,
    require: <T extends JsonValue = JsonValue>(artifactId: string) => {
      const artifact = artifacts.get(artifactId);
      if (!artifact) {
        throw new Error(`Artifact ${artifactId} is required but was not present in the registry.`);
      }
      return artifact as OntolyArtifact<T>;
    },
    has: (artifactId) => artifacts.has(artifactId),
    descriptors: () => [...descriptors.values()].sort(compareDescriptors),
    artifacts: () => [...artifacts.values()].sort(compareArtifacts),
    toJSON: () => ({
      descriptors: registry.descriptors() as unknown as JsonValue,
      artifacts: registry.artifacts().map((artifact) => ({
        id: artifact.descriptor.id,
        kind: artifact.descriptor.kind,
        version: artifact.descriptor.version,
        hash: artifact.hash,
        graphHash: artifact.graphHash,
        dependencies: [...artifact.dependencies],
        provenance: artifact.provenance,
      })) as unknown as JsonValue,
    }),
  };

  for (const artifact of initialArtifacts) {
    registry.put(artifact);
  }

  return registry;
}

export function createMemoryEnhancerCache(initial: Record<string, EnhancerRunResult> = {}): EnhancerCache {
  const entries = new Map<string, EnhancerRunResult>(Object.entries(initial));
  return {
    get: (key) => entries.get(key),
    set: (key, value) => {
      entries.set(key, deepFreeze(value));
    },
    has: (key) => entries.has(key),
  };
}

export function createNodeReadonlyFilesystem(root: string): ReadonlyEnhancerFilesystem {
  const resolvedRoot = resolve(root);
  return {
    readFile: async (path) => readFile(join(resolvedRoot, path), "utf8"),
    exists: async (path) => {
      try {
        await stat(join(resolvedRoot, path));
        return true;
      } catch {
        return false;
      }
    },
    listFiles: async (path) => {
      try {
        return (await readdir(join(resolvedRoot, path))).sort();
      } catch {
        return [];
      }
    },
  };
}

export function createSilentEnhancerLogger(): EnhancerLogger {
  return {
    info: () => undefined,
    warning: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };
}

export function createDefaultEnhancerContext(options: CreateEnhancerContextOptions): EnhancerContext {
  const graph = deepFreeze(options.graph);
  const semanticIndex = options.semanticIndex ? deepFreeze(options.semanticIndex) : undefined;
  const graphArtifact = createArtifact({
    descriptor: ARTIFACT_DESCRIPTORS.SoftwareGraph,
    data: graph as unknown as JsonValue,
    graphHash: graph.metadata.deterministicHash,
    graphGeneratedAt: graph.metadata.generatedAt,
  });
  const artifacts = options.artifacts ?? createArtifactRegistry([graphArtifact]);

  if (semanticIndex) {
    artifacts.put(createArtifact({
      descriptor: ARTIFACT_DESCRIPTORS.SemanticIndex,
      data: semanticIndex as unknown as JsonValue,
      graphHash: graph.metadata.deterministicHash,
      graphGeneratedAt: graph.metadata.generatedAt,
      producedBy: "preloaded",
      enhancerVersion: ENHANCER_API_VERSION,
      dependencies: [graphArtifact],
    }));
  }

  return deepFreeze({
    graph,
    ...(semanticIndex ? { semanticIndex } : {}),
    diagnostics: graph.diagnostics,
    statistics: deepFreeze(options.statistics ?? graphStatistics(graph)),
    indexes: graph.indexes,
    configuration: deepFreeze(options.configuration ?? {}),
    filesystem: options.filesystem ?? createNodeReadonlyFilesystem(graph.repository.root),
    logger: options.logger ?? createSilentEnhancerLogger(),
    cache: options.cache ?? createMemoryEnhancerCache(),
    artifacts,
  });
}

export function defineEnhancer(input: DefineEnhancerInput): Enhancer {
  const requires = [...(input.requires ?? [artifactRequirement("SoftwareGraph")])].sort(compareRequirements);
  const produces = [...(input.produces ?? [])].sort(compareDescriptors);
  const dependencyIds = Array.isArray(input.dependencies) ? input.dependencies : [];
  const dependencies = typeof input.dependencies === "function"
    ? input.dependencies
    : () => [...dependencyIds].sort();
  const supportsIncremental = typeof input.supportsIncremental === "function"
    ? input.supportsIncremental
    : () => Boolean(input.supportsIncremental);
  const supportedGraphVersion = input.supportedGraphVersion ?? SOFTWARE_GRAPH_VERSION;

  const enhancer: Enhancer = {
    id: input.id,
    name: input.name,
    description: input.description,
    version: input.version,
    requires,
    produces,
    manifest: () => enhancerManifest(enhancer, supportedGraphVersion),
    before: input.before ?? (() => undefined),
    after: input.after ?? (() => undefined),
    dependencies,
    run: input.run,
    validate: input.validate ?? ((context) => validateEnhancerAgainstContext(enhancer, context)),
    supportsIncremental,
    cacheKey: input.cacheKey ?? ((context) => defaultEnhancerCacheKey(enhancer, context)),
  };

  return deepFreeze(enhancer);
}

export function enhancerManifest(enhancer: Enhancer, supportedGraphVersion = SOFTWARE_GRAPH_VERSION): EnhancerManifest {
  return {
    id: enhancer.id,
    name: enhancer.name,
    description: enhancer.description,
    version: enhancer.version,
    apiVersion: ENHANCER_API_VERSION,
    inputs: enhancer.requires,
    outputs: enhancer.produces,
    dependencies: enhancer.dependencies(),
    supportedGraphVersion,
    supportsIncremental: enhancer.supportsIncremental(),
  };
}

export function validateEnhancerManifest(manifest: EnhancerManifest): readonly EnhancerValidationIssue[] {
  const issues: EnhancerValidationIssue[] = [];
  if (!manifest.id.trim()) {
    issues.push(issue("ENHANCER_MANIFEST_ID_MISSING", "error", "Enhancer manifest id is required."));
  }
  if (!manifest.version.trim()) {
    issues.push(issue("ENHANCER_MANIFEST_VERSION_MISSING", "error", "Enhancer manifest version is required.", manifest.id));
  }
  if (manifest.apiVersion !== ENHANCER_API_VERSION) {
    issues.push(issue("ENHANCER_API_VERSION_UNSUPPORTED", "error", `Unsupported enhancer API version ${manifest.apiVersion}.`, manifest.id));
  }
  if (manifest.supportedGraphVersion !== SOFTWARE_GRAPH_VERSION) {
    issues.push(issue("ENHANCER_GRAPH_VERSION_UNSUPPORTED", "warning", `Manifest targets graph version ${manifest.supportedGraphVersion}; current is ${SOFTWARE_GRAPH_VERSION}.`, manifest.id));
  }
  for (const output of manifest.outputs) {
    if (!output.id.trim()) {
      issues.push(issue("ENHANCER_OUTPUT_ID_MISSING", "error", "Enhancer output artifact id is required.", manifest.id));
    }
  }
  return issues.sort(compareIssues);
}

export function validateEnhancers(
  enhancers: readonly Enhancer[],
  context?: EnhancerContext | undefined,
): readonly EnhancerValidationIssue[] {
  const issues: EnhancerValidationIssue[] = [];
  const ids = new Set<string>();
  const artifactProducers = new Map<string, string>();

  for (const enhancer of enhancers) {
    if (ids.has(enhancer.id)) {
      issues.push(issue("ENHANCER_DUPLICATE_ID", "error", `Duplicate enhancer id ${enhancer.id}.`, enhancer.id));
    }
    ids.add(enhancer.id);
    issues.push(...validateEnhancerManifest(enhancer.manifest()));

    for (const output of enhancer.produces) {
      const producer = artifactProducers.get(output.id);
      if (producer) {
        issues.push(issue("ENHANCER_DUPLICATE_ARTIFACT_PRODUCER", "error", `Artifact ${output.id} is produced by both ${producer} and ${enhancer.id}.`, enhancer.id, output.id));
      }
      artifactProducers.set(output.id, enhancer.id);
    }

    if (context) {
      issues.push(...enhancer.validate(context));
    }
  }

  return issues.sort(compareIssues);
}

export function createEnhancerExecutionPlan(
  enhancers: readonly Enhancer[],
  existingArtifacts: ArtifactRegistry = createArtifactRegistry(),
): EnhancerExecutionPlan {
  const sortedEnhancers = [...enhancers].sort(compareEnhancers);
  const producerByArtifact = new Map<string, Enhancer>();
  const enhancerById = new Map<string, Enhancer>();
  const edges: EnhancerDependencyEdge[] = [];
  const issues: EnhancerValidationIssue[] = [...validateEnhancers(sortedEnhancers)];

  for (const enhancer of sortedEnhancers) {
    enhancerById.set(enhancer.id, enhancer);
    for (const output of enhancer.produces) {
      producerByArtifact.set(output.id, enhancer);
    }
  }

  for (const enhancer of sortedEnhancers) {
    for (const dependencyId of enhancer.dependencies()) {
      if (enhancerById.has(dependencyId)) {
        edges.push({ from: dependencyId, to: enhancer.id, reason: "dependencies()" });
      } else if (producerByArtifact.has(dependencyId)) {
        const producer = producerByArtifact.get(dependencyId);
        if (producer) {
          edges.push({ from: producer.id, to: enhancer.id, reason: `artifact:${dependencyId}` });
        }
      } else {
        issues.push(issue("ENHANCER_DEPENDENCY_NOT_FOUND", "error", `Dependency ${dependencyId} for ${enhancer.id} was not found.`, enhancer.id));
      }
    }

    for (const requirement of enhancer.requires) {
      if (existingArtifacts.has(requirement.artifact)) {
        continue;
      }
      const producer = producerByArtifact.get(requirement.artifact);
      if (producer) {
        edges.push({ from: producer.id, to: enhancer.id, reason: `requires:${requirement.artifact}` });
        continue;
      }
      if (!requirement.optional) {
        issues.push(issue("ENHANCER_REQUIRED_ARTIFACT_NOT_FOUND", "error", `Required artifact ${requirement.artifact} for ${enhancer.id} was not found.`, enhancer.id, requirement.artifact));
      }
    }
  }

  const uniqueEdges = [...new Map(edges.map((edge) => [`${edge.from}->${edge.to}:${edge.reason}`, edge] as const)).values()]
    .sort(compareEdges);
  const levels = executionLevels(sortedEnhancers, uniqueEdges, issues);

  return {
    enhancers: sortedEnhancers,
    levels,
    edges: uniqueEdges,
    issues: issues.sort(compareIssues),
  };
}

export async function runEnhancerPipeline(options: RunEnhancerPipelineOptions): Promise<EnhancerPipelineResult> {
  const plan = createEnhancerExecutionPlan(options.enhancers, options.context.artifacts);
  const blocking = plan.issues.filter((planIssue) => planIssue.severity === "error");
  if (blocking.length > 0) {
    throw new Error(`Enhancer pipeline is invalid: ${blocking.map((planIssue) => planIssue.message).join("; ")}`);
  }

  const executions: EnhancerExecution[] = [];
  const diagnostics: SoftwareGraphDiagnostic[] = [];
  const startedAt = Date.now();

  for (const level of plan.levels) {
    const runOne = async (enhancer: Enhancer): Promise<EnhancerExecution> => {
      const runStartedAt = Date.now();
      const validation = enhancer.validate(options.context);
      const errors = validation.filter((item) => item.severity === "error");
      if (errors.length > 0) {
        return {
          enhancerId: enhancer.id,
          status: "failed",
          cacheKey: enhancer.cacheKey(options.context),
          artifacts: [],
          diagnostics: [],
          statistics: { validationErrors: errors.map((item) => item.message) },
          durationMs: Date.now() - runStartedAt,
        };
      }

      const cacheKey = enhancer.cacheKey(options.context);
      const canReadCache = options.incremental !== false && enhancer.supportsIncremental();
      const cached = canReadCache ? await options.context.cache.get(cacheKey) : undefined;
      if (cached) {
        for (const artifact of cached.artifacts) {
          options.context.artifacts.put(artifact);
        }
        return {
          enhancerId: enhancer.id,
          status: "cached",
          cacheKey,
          artifacts: cached.artifacts,
          diagnostics: [...(cached.diagnostics ?? [])],
          statistics: cached.statistics ?? {},
          durationMs: Date.now() - runStartedAt,
        };
      }

      await enhancer.before(options.context);
      const result = await enhancer.run(options.context);
      for (const artifact of result.artifacts) {
        options.context.artifacts.put(artifact);
      }
      await enhancer.after(options.context, result);
      await options.context.cache.set(cacheKey, result);

      return {
        enhancerId: enhancer.id,
        status: "executed",
        cacheKey,
        artifacts: result.artifacts,
        diagnostics: [...(result.diagnostics ?? [])],
        statistics: result.statistics ?? {},
        durationMs: Date.now() - runStartedAt,
      };
    };

    const levelExecutions = options.parallel === false
      ? await runSequential(level, runOne)
      : await Promise.all(level.map(runOne));

    for (const execution of [...levelExecutions].sort(compareExecutions)) {
      executions.push(execution);
      diagnostics.push(...execution.diagnostics);
    }
  }

  const artifacts = options.context.artifacts.artifacts();
  const statistics = {
    durationMs: Date.now() - startedAt,
    enhancers: executions.length,
    executed: executions.filter((execution) => execution.status === "executed").length,
    cached: executions.filter((execution) => execution.status === "cached").length,
    artifacts: artifacts.length,
  };
  const deterministicHash = stableHash(stableStringify({
    graphHash: options.context.graph.metadata.deterministicHash,
    executions: executions.map((execution) => ({
      enhancerId: execution.enhancerId,
      status: execution.status,
      artifacts: execution.artifacts.map((artifact) => [artifact.descriptor.id, artifact.hash]),
    })),
    artifacts: artifacts.map((artifact) => [artifact.descriptor.id, artifact.hash]),
  }));

  return deepFreeze({
    graphHash: options.context.graph.metadata.deterministicHash,
    executions,
    artifacts,
    diagnostics: diagnostics.sort(compareDiagnostics),
    statistics,
    deterministicHash,
  });
}

export function defaultEnhancerCacheKey(enhancer: Enhancer, context: EnhancerContext): string {
  const requiredArtifacts = enhancer.requires
    .map((requirement) => context.artifacts.get(requirement.artifact))
    .filter(isArtifact)
    .map((artifact) => [artifact.descriptor.id, artifact.hash] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return stableHash(stableStringify({
    api: ENHANCER_API_VERSION,
    enhancer: {
      id: enhancer.id,
      version: enhancer.version,
      requires: enhancer.requires,
      produces: enhancer.produces.map((artifact) => [artifact.id, artifact.version]),
    },
    graphHash: context.graph.metadata.deterministicHash,
    configuration: context.configuration,
    requiredArtifacts,
  }));
}

export function visualizeEnhancerPipeline(
  enhancers: readonly Enhancer[],
  format: "json" | "mermaid" | "dot" = "mermaid",
  existingArtifacts: ArtifactRegistry = createArtifactRegistry([
    createArtifact({
      descriptor: ARTIFACT_DESCRIPTORS.SoftwareGraph,
      data: { artifact: "SoftwareGraph" },
      graphHash: "graph",
    }),
  ]),
): string {
  const plan = createEnhancerExecutionPlan(enhancers, existingArtifacts);
  if (format === "json") {
    return `${JSON.stringify({
      enhancers: plan.enhancers.map((enhancer) => enhancer.manifest()),
      edges: plan.edges,
      levels: plan.levels.map((level) => level.map((enhancer) => enhancer.id)),
      issues: plan.issues,
    }, null, 2)}\n`;
  }

  const artifactEdges = enhancerArtifactEdges(plan.enhancers);
  if (format === "dot") {
    return [
      "digraph EnhancerPipeline {",
      "  rankdir=LR;",
      ...artifactEdges.map((edge) => `  "${edge.from}" -> "${edge.to}" [label="${edge.reason}"];`),
      "}",
      "",
    ].join("\n");
  }

  return [
    "flowchart LR",
    ...artifactEdges.map((edge) => `  ${nodeKey(edge.from)}["${escapeMermaid(edge.from)}"] -->|${escapeMermaid(edge.reason)}| ${nodeKey(edge.to)}["${escapeMermaid(edge.to)}"]`),
    "",
  ].join("\n");
}

export async function discoverEnhancerManifests(options: DiscoverEnhancerOptions): Promise<readonly DiscoveredEnhancerManifest[]> {
  const root = resolve(options.root);
  const searchPaths = options.searchPaths ?? [
    join(root, "packages"),
    join(root, "plugins"),
    join(root, "enhancers"),
    join(root, "node_modules", "@0xsarwagya"),
    join(root, "node_modules"),
  ];
  const manifestPaths = new Set<string>();

  for (const searchPath of searchPaths) {
    for (const candidate of await discoverManifestPaths(searchPath)) {
      manifestPaths.add(candidate);
    }
  }

  const discovered: DiscoveredEnhancerManifest[] = [];
  for (const path of [...manifestPaths].sort()) {
    try {
      const manifest = JSON.parse(await readFile(path, "utf8")) as EnhancerManifest;
      discovered.push({
        path,
        manifest,
        issues: validateEnhancerManifest(manifest),
      });
    } catch (error) {
      discovered.push({
        path,
        manifest: invalidManifest(path),
        issues: [issue("ENHANCER_MANIFEST_READ_FAILED", "error", `Could not read enhancer manifest ${path}: ${error instanceof Error ? error.message : String(error)}`)],
      });
    }
  }

  return discovered.sort((left, right) => left.path.localeCompare(right.path));
}

export async function readEnhancerManifest(path: string): Promise<EnhancerManifest> {
  return JSON.parse(await readFile(path, "utf8")) as EnhancerManifest;
}

export function createEnhancerTestHarness(options: CreateEnhancerContextOptions): EnhancerTestHarness {
  const context = createDefaultEnhancerContext(options);
  return {
    context,
    run: (enhancers) => runEnhancerPipeline({ enhancers, context, parallel: false, incremental: false }),
    assertDeterministic: async (enhancers) => {
      const first = await runEnhancerPipeline({
        enhancers,
        context: createDefaultEnhancerContext({ ...options, cache: createMemoryEnhancerCache(), artifacts: undefined }),
        parallel: false,
        incremental: false,
      });
      const second = await runEnhancerPipeline({
        enhancers,
        context: createDefaultEnhancerContext({ ...options, cache: createMemoryEnhancerCache(), artifacts: undefined }),
        parallel: false,
        incremental: false,
      });
      if (stableStringify(testSnapshot(first)) !== stableStringify(testSnapshot(second))) {
        throw new Error("Enhancer output is not deterministic.");
      }
    },
    snapshot: testSnapshot,
  };
}

function validateEnhancerAgainstContext(enhancer: Enhancer, context: EnhancerContext): readonly EnhancerValidationIssue[] {
  const issues: EnhancerValidationIssue[] = [];
  if (context.graph.version !== SOFTWARE_GRAPH_VERSION) {
    issues.push(issue("ENHANCER_GRAPH_VERSION_MISMATCH", "warning", `Graph version ${context.graph.version} differs from ${SOFTWARE_GRAPH_VERSION}.`, enhancer.id));
  }

  for (const requirement of enhancer.requires) {
    const artifact = context.artifacts.get(requirement.artifact);
    if (!artifact && !requirement.optional) {
      issues.push(issue("ENHANCER_REQUIRED_ARTIFACT_MISSING", "error", `Required artifact ${requirement.artifact} is missing.`, enhancer.id, requirement.artifact));
      continue;
    }
    if (artifact && requirement.version && artifact.descriptor.version !== requirement.version) {
      issues.push(issue("ENHANCER_REQUIRED_ARTIFACT_VERSION_MISMATCH", "error", `Artifact ${requirement.artifact} version ${artifact.descriptor.version} does not satisfy ${requirement.version}.`, enhancer.id, requirement.artifact));
    }
  }

  return issues.sort(compareIssues);
}

function enhancerArtifactEdges(enhancers: readonly Enhancer[]): readonly EnhancerDependencyEdge[] {
  const edges: EnhancerDependencyEdge[] = [];
  for (const enhancer of [...enhancers].sort(compareEnhancers)) {
    for (const requirement of enhancer.requires) {
      edges.push({ from: requirement.artifact, to: enhancer.id, reason: "requires" });
    }
    for (const artifact of enhancer.produces) {
      edges.push({ from: enhancer.id, to: artifact.id, reason: "produces" });
    }
  }
  return edges.sort(compareEdges);
}

async function discoverManifestPaths(searchPath: string): Promise<readonly string[]> {
  let entries: readonly string[];
  try {
    entries = await readdir(searchPath);
  } catch {
    return [];
  }

  const direct = join(searchPath, "enhancer.json");
  const found: string[] = [];
  if (await pathExists(direct)) {
    found.push(direct);
  }

  for (const entry of [...entries].sort()) {
    if (entry.startsWith(".")) {
      continue;
    }
    const candidate = join(searchPath, entry);
    if (!(await isDirectory(candidate))) {
      continue;
    }
    const manifest = join(candidate, "enhancer.json");
    if (await pathExists(manifest)) {
      found.push(manifest);
    }
    if (entry.startsWith("@")) {
      for (const scoped of await discoverManifestPaths(candidate)) {
        found.push(scoped);
      }
    }
  }

  return found.sort();
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function executionLevels(
  enhancers: readonly Enhancer[],
  edges: readonly EnhancerDependencyEdge[],
  issues: EnhancerValidationIssue[],
): readonly (readonly Enhancer[])[] {
  const remaining = new Map(enhancers.map((enhancer) => [enhancer.id, enhancer] as const));
  const incoming = new Map<string, Set<string>>();
  for (const enhancer of enhancers) {
    incoming.set(enhancer.id, new Set());
  }
  for (const edge of edges) {
    incoming.get(edge.to)?.add(edge.from);
  }

  const levels: Enhancer[][] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((enhancer) => [...(incoming.get(enhancer.id) ?? [])].every((id) => !remaining.has(id)))
      .sort(compareEnhancers);
    if (ready.length === 0) {
      issues.push(issue("ENHANCER_PIPELINE_CYCLE", "error", "Enhancer pipeline contains a dependency cycle."));
      return [];
    }
    levels.push(ready);
    for (const enhancer of ready) {
      remaining.delete(enhancer.id);
    }
  }

  return levels;
}

async function runSequential<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<readonly R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await fn(item));
  }
  return results;
}

function graphStatistics(graph: SoftwareGraph): JsonObject {
  return {
    files: graph.metadata.fileCount,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    diagnostics: graph.diagnostics.length,
    deterministicHash: graph.metadata.deterministicHash,
  };
}

function testSnapshot(result: EnhancerPipelineResult): JsonObject {
  return {
    graphHash: result.graphHash,
    deterministicHash: result.deterministicHash,
    executions: result.executions.map((execution) => ({
      enhancerId: execution.enhancerId,
      status: execution.status,
      artifacts: execution.artifacts.map((artifact) => ({
        id: artifact.descriptor.id,
        hash: artifact.hash,
      })),
    })),
    artifacts: result.artifacts.map((artifact) => ({
      id: artifact.descriptor.id,
      hash: artifact.hash,
      dependencies: [...artifact.dependencies],
    })),
  };
}

function invalidManifest(path: string): EnhancerManifest {
  return {
    id: `invalid:${path}`,
    name: "Invalid Enhancer Manifest",
    description: "Manifest could not be read.",
    version: "0.0.0",
    apiVersion: ENHANCER_API_VERSION,
    inputs: [],
    outputs: [],
    dependencies: [],
    supportedGraphVersion: SOFTWARE_GRAPH_VERSION,
    supportsIncremental: false,
  };
}

function issue(
  code: string,
  severity: EnhancerValidationIssue["severity"],
  message: string,
  enhancerId?: string,
  artifactId?: string,
): EnhancerValidationIssue {
  return {
    code,
    severity,
    message,
    ...(enhancerId ? { enhancerId } : {}),
    ...(artifactId ? { artifactId } : {}),
  };
}

function nodeKey(value: string): string {
  return `n_${stableHash(value).slice(0, 12)}`;
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, "'");
}

function compareEnhancers(left: Enhancer, right: Enhancer): number {
  return left.id.localeCompare(right.id);
}

function compareDescriptors(left: ArtifactDescriptor, right: ArtifactDescriptor): number {
  return left.id.localeCompare(right.id);
}

function compareArtifacts(left: OntolyArtifact, right: OntolyArtifact): number {
  return left.descriptor.id.localeCompare(right.descriptor.id);
}

function compareRequirements(left: EnhancerRequirement, right: EnhancerRequirement): number {
  return left.artifact.localeCompare(right.artifact);
}

function compareEdges(left: EnhancerDependencyEdge, right: EnhancerDependencyEdge): number {
  return `${left.from}:${left.to}:${left.reason}`.localeCompare(`${right.from}:${right.to}:${right.reason}`);
}

function compareIssues(left: EnhancerValidationIssue, right: EnhancerValidationIssue): number {
  return `${left.severity}:${left.code}:${left.enhancerId ?? ""}:${left.artifactId ?? ""}:${left.message}`
    .localeCompare(`${right.severity}:${right.code}:${right.enhancerId ?? ""}:${right.artifactId ?? ""}:${right.message}`);
}

function compareDiagnostics(left: SoftwareGraphDiagnostic, right: SoftwareGraphDiagnostic): number {
  return left.id.localeCompare(right.id);
}

function compareExecutions(left: EnhancerExecution, right: EnhancerExecution): number {
  return left.enhancerId.localeCompare(right.enhancerId);
}

function isArtifact(value: OntolyArtifact | undefined): value is OntolyArtifact {
  return Boolean(value);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return value;
}
