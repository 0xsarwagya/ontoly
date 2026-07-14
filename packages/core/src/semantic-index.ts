import {
  normalizePath,
  stableHash,
  stableStringify,
  type JsonObject,
  type NodeType,
  type RelationshipType,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "./index";

export const SEMANTIC_INDEX_VERSION = "1.0.0";

export type SearchCategory =
  | "concept"
  | "symbol"
  | "feature"
  | "configuration"
  | "environment"
  | "route"
  | "entrypoint"
  | "repository";

export interface SemanticIndexRelationshipSummary {
  readonly incoming: Record<string, number>;
  readonly outgoing: Record<string, number>;
  readonly degree: number;
  readonly neighborIds: readonly string[];
  readonly neighborNames: readonly string[];
}

export interface SemanticIndexEntry {
  readonly stableId: string;
  readonly displayName: string;
  readonly normalizedName: string;
  readonly kind: NodeType;
  readonly module?: string | undefined;
  readonly package?: string | undefined;
  readonly namespace?: string | undefined;
  readonly framework?: string | undefined;
  readonly relationships: SemanticIndexRelationshipSummary;
  readonly aliases: readonly string[];
  readonly keywords: readonly string[];
  readonly filePath?: string | undefined;
  readonly folderPath?: string | undefined;
  readonly parentChain: readonly string[];
  readonly documentation?: string | undefined;
  readonly comments?: string | undefined;
  readonly importance: number;
  readonly usageFrequency: number;
  readonly architectureLayer: string;
}

export interface RepositoryVocabularyTerm {
  readonly term: string;
  readonly frequency: number;
  readonly nodeIds: readonly string[];
  readonly kinds: readonly NodeType[];
}

export interface SemanticIndexStatistics {
  readonly entries: number;
  readonly aliases: number;
  readonly keywords: number;
  readonly vocabulary: number;
  readonly graphHash: string;
}

export interface SemanticIndex {
  readonly version: string;
  readonly graphVersion: string;
  readonly graphHash: string;
  readonly repository: {
    readonly name: string;
    readonly root: string;
    readonly packageName?: string | undefined;
  };
  readonly entries: readonly SemanticIndexEntry[];
  readonly entryIds: readonly string[];
  readonly invertedIndex: Record<string, readonly string[]>;
  readonly vocabulary: readonly RepositoryVocabularyTerm[];
  readonly metadata: {
    readonly generatedAt: string;
    readonly deterministicHash: string;
    readonly statistics: SemanticIndexStatistics;
  };
}

export interface NormalizedIntent {
  readonly raw: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
  readonly phrases: readonly string[];
  readonly expandedTerms: readonly string[];
}

export interface ScoreReason {
  readonly factor: string;
  readonly score: number;
  readonly evidence: string;
}

export interface SemanticCandidate {
  readonly nodeId: string;
  readonly stableId: string;
  readonly displayName: string;
  readonly kind: NodeType;
  readonly score: number;
  readonly confidence: number;
  readonly matchedTerms: readonly string[];
  readonly reasons: readonly ScoreReason[];
  readonly entry: SemanticIndexEntry;
}

export interface SemanticSearchResult {
  readonly query: string;
  readonly category: SearchCategory;
  readonly intent: NormalizedIntent;
  readonly matchedConcepts: readonly string[];
  readonly candidates: readonly SemanticCandidate[];
  readonly confidence: number;
  readonly recommendedCapability: string;
  readonly evidence: readonly string[];
  readonly latencyMs: number;
}

export interface SearchOptions {
  readonly category?: SearchCategory | undefined;
  readonly limit?: number | undefined;
  readonly kinds?: readonly NodeType[] | undefined;
  readonly packageScope?: string | undefined;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "use",
  "uses",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
]);

const FRAMEWORK_SUFFIXES = new Set([
  "app",
  "application",
  "client",
  "config",
  "configuration",
  "controller",
  "dto",
  "entity",
  "factory",
  "guard",
  "handler",
  "hook",
  "interceptor",
  "middleware",
  "module",
  "pipe",
  "provider",
  "repository",
  "resolver",
  "route",
  "schema",
  "service",
  "store",
  "table",
  "type",
]);

const CATEGORY_TYPES: Record<SearchCategory, readonly NodeType[]> = {
  concept: [],
  symbol: ["Function", "Method", "Class", "Interface", "TypeAlias", "Enum", "Field", "Service", "Provider", "Controller", "Repository", "Resource", "Route"],
  feature: ["Route", "Controller", "Service", "Provider", "Module", "Package", "Function", "Method", "Resource", "Operation"],
  configuration: ["Configuration", "EnvironmentVariable", "BuildTarget", "Script", "Task"],
  environment: ["EnvironmentVariable"],
  route: ["Route", "Operation", "Controller"],
  entrypoint: ["Route", "Operation", "Controller", "Function", "Method", "Module", "Script", "Task", "Application"],
  repository: ["Workspace", "Application", "Package", "Module", "Framework", "Dependency", "Configuration"],
};

const RELATIONSHIP_CAPABILITIES: readonly {
  readonly capability: string;
  readonly terms: readonly string[];
}[] = [
  { capability: "RequestTrace", terms: ["route", "request", "endpoint", "api", "handler", "controller", "login", "logout"] },
  { capability: "ConfigurationUsage", terms: ["config", "configuration", "setting", "environment", "env", "secret"] },
  { capability: "EnvironmentUsage", terms: ["env", "environment", "secret", "variable"] },
  { capability: "AuthenticationFlow", terms: ["auth", "authentication", "login", "signin", "jwt", "session", "token"] },
  { capability: "AuthorizationFlow", terms: ["authorization", "permission", "guard", "role", "policy", "authorize"] },
  { capability: "ImpactAnalysis", terms: ["remove", "delete", "change", "break", "impact", "depends", "dependent"] },
  { capability: "DependencyAnalysis", terms: ["dependency", "depends", "imports", "uses", "injects", "providers"] },
  { capability: "FeatureTouchpoints", terms: ["feature", "owner", "touchpoint", "where", "find", "locate"] },
];

const SEMANTIC_EXPANSIONS: Record<string, readonly string[]> = {
  api: ["route", "endpoint", "operation", "controller"],
  auth: ["authentication", "authorize", "authorization", "identity", "jwt", "login", "session", "signin", "token"],
  authentication: ["auth", "identity", "jwt", "login", "session", "signin", "token"],
  authorize: ["authorization", "permission", "guard"],
  authorization: ["authorize", "permission", "guard", "role", "policy"],
  average: ["averages", "aggregate", "aggregation", "mean", "statistics"],
  averages: ["average", "aggregate", "aggregation", "mean", "statistics"],
  config: ["configuration", "setting", "settings"],
  configuration: ["config", "setting", "settings"],
  controller: ["handler", "route", "endpoint"],
  database: ["db", "repository", "persistence", "prisma", "table"],
  db: ["database", "repository", "persistence", "table"],
  duration: ["time", "period", "interval"],
  endpoint: ["api", "route", "operation"],
  env: ["environment", "variable", "secret", "configuration"],
  environment: ["env", "variable", "secret", "configuration"],
  fhir: ["resource", "healthcare"],
  handler: ["controller", "route", "endpoint"],
  identity: ["auth", "authentication", "user", "session"],
  jwt: ["auth", "authentication", "token", "session"],
  login: ["auth", "authentication", "signin", "session", "jwt"],
  notification: ["notifications", "alert", "event", "message"],
  notifications: ["notification", "alert", "event", "message"],
  patient: ["resident", "user", "subject"],
  permission: ["authorization", "authorize", "guard", "role"],
  plan: ["definition", "resource"],
  provider: ["service", "injectable", "dependency"],
  repo: ["repository", "persistence", "database"],
  repository: ["repo", "persistence", "database"],
  resident: ["patient", "user", "subject"],
  route: ["api", "endpoint", "operation", "handler"],
  service: ["provider", "injectable", "dependency"],
  session: ["auth", "authentication", "login", "signin", "jwt"],
  signin: ["auth", "authentication", "login", "session"],
  signal: ["signals", "metric", "measurement", "event"],
  signals: ["signal", "metric", "measurement", "event"],
  statistic: ["statistics", "average", "aggregate"],
  statistics: ["statistic", "average", "aggregate"],
  threshold: ["thresholds", "limit", "configuration", "setting"],
  thresholds: ["threshold", "limit", "configuration", "setting"],
  token: ["jwt", "auth", "authentication", "session"],
};

export function createSemanticIndex(graph: SoftwareGraph): SemanticIndex {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const incoming = groupEdges(graph.edges, "to");
  const outgoing = groupEdges(graph.edges, "from");
  const entries = graph.nodes.map((node) => createEntry(graph, node, nodeById, incoming, outgoing)).sort(compareEntries);
  const invertedIndex = buildInvertedIndex(entries);
  const vocabulary = buildVocabulary(entries);
  const statistics: SemanticIndexStatistics = {
    entries: entries.length,
    aliases: sum(entries.map((entry) => entry.aliases.length)),
    keywords: sum(entries.map((entry) => entry.keywords.length)),
    vocabulary: vocabulary.length,
    graphHash: graph.metadata.deterministicHash,
  };
  const indexWithoutMetadata = {
    version: SEMANTIC_INDEX_VERSION,
    graphVersion: graph.version,
    graphHash: graph.metadata.deterministicHash,
    repository: {
      name: graph.repository.name,
      root: graph.repository.root,
      packageName: graph.repository.packageName,
    },
    entries,
    entryIds: entries.map((entry) => entry.stableId),
    invertedIndex,
    vocabulary,
    metadata: {
      generatedAt: "1970-01-01T00:00:00.000Z",
      deterministicHash: "",
      statistics,
    },
  } satisfies SemanticIndex;
  const deterministicHash = stableHash(stableStringify({
    ...indexWithoutMetadata,
    metadata: {
      ...indexWithoutMetadata.metadata,
      deterministicHash: undefined,
    },
  }));

  return {
    ...indexWithoutMetadata,
    metadata: {
      ...indexWithoutMetadata.metadata,
      deterministicHash,
    },
  };
}

export function validateSemanticIndex(index: SemanticIndex, graph?: SoftwareGraph): readonly string[] {
  const issues: string[] = [];
  if (index.version !== SEMANTIC_INDEX_VERSION) {
    issues.push(`Unsupported semantic index version ${index.version}.`);
  }
  if (graph && index.graphHash !== graph.metadata.deterministicHash) {
    issues.push("Semantic index graph hash does not match Software Graph hash.");
  }
  const seen = new Set<string>();
  for (const entry of index.entries) {
    if (seen.has(entry.stableId)) {
      issues.push(`Duplicate semantic index entry ${entry.stableId}.`);
    }
    seen.add(entry.stableId);
  }
  for (const [term, ids] of Object.entries(index.invertedIndex)) {
    for (const id of ids) {
      if (!seen.has(id)) {
        issues.push(`Inverted index term "${term}" references missing entry ${id}.`);
      }
    }
  }
  return issues.sort();
}

export function normalizeIntent(input: string): NormalizedIntent {
  const raw = input.trim();
  const tokens = tokenize(raw);
  const phrases = phraseVariants(raw, tokens);
  const expandedTerms = uniqueStrings([
    ...tokens,
    ...phrases,
    ...tokens.flatMap(expansionsFor),
    ...tokens.map(singularize),
    ...tokens.map(pluralize),
  ]);

  return {
    raw,
    normalized: normalizePhrase(raw),
    tokens,
    phrases,
    expandedTerms,
  };
}

export function resolveIntent(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  const startedAt = performanceNow();
  const category = options.category ?? "concept";
  const intent = normalizeIntent(query);
  const candidates = rankCandidates(index, intent, {
    ...options,
    category,
  });
  const confidence = candidates[0]?.confidence ?? 0;
  const matchedConcepts = uniqueStrings(candidates.flatMap((candidate) => candidate.matchedTerms)).slice(0, 20);

  return {
    query,
    category,
    intent,
    matchedConcepts,
    candidates,
    confidence,
    recommendedCapability: recommendCapability(intent, candidates, category),
    evidence: candidates.slice(0, 5).map((candidate) =>
      `${candidate.displayName} (${candidate.kind}) matched ${candidate.matchedTerms.join(", ") || "graph context"} with score ${candidate.score.toFixed(2)}.`,
    ),
    latencyMs: round(performanceNow() - startedAt, 3),
  };
}

export function findConcept(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, { ...options, category: "concept" });
}

export function findSymbol(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, { ...options, category: "symbol", kinds: options.kinds ?? CATEGORY_TYPES.symbol });
}

export function findFeature(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, { ...options, category: "feature", kinds: options.kinds ?? CATEGORY_TYPES.feature });
}

export function findConfiguration(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, {
    ...options,
    category: "configuration",
    kinds: options.kinds ?? CATEGORY_TYPES.configuration,
  });
}

export function findEnvironment(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, { ...options, category: "environment", kinds: options.kinds ?? CATEGORY_TYPES.environment });
}

export function findRoute(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, { ...options, category: "route", kinds: options.kinds ?? CATEGORY_TYPES.route });
}

export function findEntryPoint(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, { ...options, category: "entrypoint", kinds: options.kinds ?? CATEGORY_TYPES.entrypoint });
}

export function findRepositoryConcept(index: SemanticIndex, query: string, options: SearchOptions = {}): SemanticSearchResult {
  return resolveIntent(index, query, { ...options, category: "repository", kinds: options.kinds ?? CATEGORY_TYPES.repository });
}

function createEntry(
  graph: SoftwareGraph,
  node: SoftwareGraphNode,
  nodeById: ReadonlyMap<string, SoftwareGraphNode>,
  incoming: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
  outgoing: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
): SemanticIndexEntry {
  const incomingEdges = incoming.get(node.id) ?? [];
  const outgoingEdges = outgoing.get(node.id) ?? [];
  const neighbors = uniqueStrings([
    ...incomingEdges.map((edge) => edge.from),
    ...outgoingEdges.map((edge) => edge.to),
  ]);
  const neighborNodes = neighbors.map((id) => nodeById.get(id)).filter(isNode);
  const parentChain = parentChainFor(node, nodeById, incomingEdges);
  const aliasSource = aliasSourceValues(graph, node, neighborNodes, parentChain);
  const aliases = generateAliases(aliasSource, node);
  const keywords = generateKeywords(aliasSource, node);
  const degree = incomingEdges.length + outgoingEdges.length;

  return withOptionalProperties({
    stableId: node.id,
    displayName: node.name,
    normalizedName: normalizePhrase(node.name),
    kind: node.type,
    relationships: {
      incoming: countEdgesByType(incomingEdges),
      outgoing: countEdgesByType(outgoingEdges),
      degree,
      neighborIds: neighbors,
      neighborNames: uniqueStrings(neighborNodes.map((neighbor) => neighbor.name)),
    },
    aliases,
    keywords,
    parentChain,
    importance: nodeImportance(node, degree, incomingEdges.length),
    usageFrequency: incomingEdges.length,
    architectureLayer: architectureLayer(node),
  }, {
    module: containingName(parentChain, "Module"),
    package: node.package ?? stringMetadata(node.metadata, "package") ?? stringMetadata(node.metadata, "packageName"),
    namespace: stringMetadata(node.metadata, "namespace"),
    framework: stringMetadata(node.metadata, "framework") ?? frameworkFromNeighbors(neighborNodes),
    filePath: node.file ? normalizePath(node.file) : undefined,
    folderPath: node.file ? folderPath(node.file) : undefined,
    documentation: deterministicDocumentation(node.metadata),
    comments: deterministicComments(node.metadata),
  });
}

function aliasSourceValues(
  graph: SoftwareGraph,
  node: SoftwareGraphNode,
  neighbors: readonly SoftwareGraphNode[],
  parentChain: readonly string[],
): readonly string[] {
  const metadataValues = metadataTextValues(node.metadata);
  const routeValues = routeTextValues(node);
  const envValues = node.type === "EnvironmentVariable" ? [node.name, node.id.replace(/^env:/, "")] : [];

  return uniqueStrings([
    node.id,
    node.name,
    node.file ?? "",
    node.package ?? "",
    ...parentChain,
    ...metadataValues,
    ...routeValues,
    ...envValues,
    ...neighbors.map((neighbor) => neighbor.name),
    ...neighbors.map((neighbor) => neighbor.id),
  ].filter(Boolean));
}

function generateAliases(values: readonly string[], node: SoftwareGraphNode): readonly string[] {
  const aliases = new Set<string>();
  const primaryTokens = new Set(tokenize(node.name));
  for (const value of values) {
    const tokens = tokenize(value);
    const normalized = normalizePhrase(value);
    if (normalized) {
      aliases.add(normalized);
    }
    if (tokens.length > 0) {
      aliases.add(tokens.join(" "));
      aliases.add(tokens.join(""));
      aliases.add(tokens.join("-"));
      aliases.add(tokens.join("_"));
      const withoutSuffix = stripFrameworkSuffix(tokens);
      if (withoutSuffix.length > 0 && withoutSuffix.length !== tokens.length) {
        aliases.add(withoutSuffix.join(" "));
        aliases.add(withoutSuffix.join(""));
      }
      for (const token of tokens) {
        aliases.add(token);
        aliases.add(singularize(token));
        aliases.add(pluralize(token));
        if (primaryTokens.has(token)) {
          for (const expansion of expansionsFor(token)) {
            aliases.add(expansion);
          }
        }
      }
    }
  }

  for (const typeAlias of aliasesForNodeType(node.type)) {
    aliases.add(typeAlias);
  }

  return uniqueStrings([...aliases].filter((alias) => alias.length > 1));
}

function generateKeywords(values: readonly string[], node: SoftwareGraphNode): readonly string[] {
  const keywords = new Set<string>();
  for (const value of values) {
    for (const token of tokenize(value)) {
      keywords.add(token);
      keywords.add(singularize(token));
    }
  }
  keywords.add(node.type.toLowerCase());
  for (const alias of aliasesForNodeType(node.type)) {
    keywords.add(alias);
  }
  return uniqueStrings([...keywords].filter((keyword) => keyword.length > 1));
}

function buildInvertedIndex(entries: readonly SemanticIndexEntry[]): Record<string, readonly string[]> {
  const inverted = new Map<string, Set<string>>();
  for (const entry of entries) {
    for (const term of uniqueStrings([entry.normalizedName, ...entry.aliases, ...entry.keywords])) {
      addInverted(inverted, term, entry.stableId);
      for (const token of tokenize(term)) {
        addInverted(inverted, token, entry.stableId);
      }
    }
  }

  return Object.fromEntries(
    [...inverted.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([term, ids]) => [term, [...ids].sort()] as const),
  );
}

function buildVocabulary(entries: readonly SemanticIndexEntry[]): readonly RepositoryVocabularyTerm[] {
  const terms = new Map<string, { count: number; nodeIds: Set<string>; kinds: Set<NodeType> }>();
  for (const entry of entries) {
    for (const term of uniqueStrings([...entry.keywords, ...entry.aliases.filter((alias) => !alias.includes(" "))])) {
      if (term.length < 2 || STOP_WORDS.has(term)) {
        continue;
      }
      const current = terms.get(term) ?? { count: 0, nodeIds: new Set<string>(), kinds: new Set<NodeType>() };
      current.count += 1;
      current.nodeIds.add(entry.stableId);
      current.kinds.add(entry.kind);
      terms.set(term, current);
    }
  }

  return [...terms.entries()]
    .map(([term, value]) => ({
      term,
      frequency: value.count,
      nodeIds: [...value.nodeIds].sort(),
      kinds: [...value.kinds].sort(),
    }))
    .sort((left, right) => right.frequency - left.frequency || left.term.localeCompare(right.term));
}

function rankCandidates(
  index: SemanticIndex,
  intent: NormalizedIntent,
  options: SearchOptions & { readonly category: SearchCategory },
): readonly SemanticCandidate[] {
  const candidateIds = candidateIdsFor(index, intent);
  const entryById = new Map(index.entries.map((entry) => [entry.stableId, entry] as const));
  const kinds = options.kinds?.length ? new Set(options.kinds) : categoryTypeSet(options.category);
  const candidates = candidateIds
    .map((id) => entryById.get(id))
    .filter(isEntry)
    .filter((entry) => includeEntryForCategory(entry, intent, options.category))
    .filter((entry) => !kinds || kinds.has(entry.kind))
    .filter((entry) => !options.packageScope || entry.package === options.packageScope || entry.filePath?.startsWith(options.packageScope))
    .map((entry) => scoreEntry(entry, intent, options.category))
    .filter((candidate) => candidate.score > 0)
    .sort(compareCandidates);

  return candidates.slice(0, options.limit ?? 20);
}

function candidateIdsFor(index: SemanticIndex, intent: NormalizedIntent): readonly string[] {
  const ids = new Set<string>();
  const terms = uniqueStrings([intent.normalized, ...intent.phrases, ...intent.tokens, ...intent.expandedTerms]);
  for (const term of terms) {
    for (const id of index.invertedIndex[term] ?? []) {
      ids.add(id);
    }
  }
  if (ids.size > 0) {
    return [...ids].sort();
  }
  return index.entries
    .filter((entry) => fuzzyEntryMatch(entry, intent))
    .map((entry) => entry.stableId)
    .sort();
}

function scoreEntry(entry: SemanticIndexEntry, intent: NormalizedIntent, category: SearchCategory): SemanticCandidate {
  const reasons: ScoreReason[] = [];
  const matchedTerms = new Set<string>();
  const entryTerms = new Set([entry.normalizedName, ...entry.aliases, ...entry.keywords]);
  const normalizedId = normalizePhrase(entry.stableId);

  addScore(reasons, "exact-symbol", intent.raw === entry.stableId ? 1000 : 0, entry.stableId);
  if (intent.raw === entry.stableId) {
    matchedTerms.add(entry.stableId);
  }

  if (entry.normalizedName === intent.normalized || normalizedId === intent.normalized) {
    addScore(reasons, "exact-normalized-name", 500, entry.displayName);
    matchedTerms.add(intent.normalized);
  }

  if (entry.aliases.includes(intent.normalized)) {
    addScore(reasons, "exact-alias", 420, intent.normalized);
    matchedTerms.add(intent.normalized);
  }

  const nameTokens = tokenize(entry.displayName);
  if (nameTokens.length > 0 && nameTokens.every((token) => intent.expandedTerms.includes(token))) {
    addScore(reasons, "complete-name-token-match", 260, nameTokens.join(", "));
    for (const token of nameTokens) {
      matchedTerms.add(token);
    }
  }

  for (const phrase of intent.phrases) {
    if (entry.aliases.includes(phrase) || entry.normalizedName === phrase) {
      addScore(reasons, "phrase-match", 180, phrase);
      matchedTerms.add(phrase);
    } else if (phrase.length > 2 && [...entryTerms].some((term) => term.includes(phrase) || phrase.includes(term))) {
      addScore(reasons, "partial-phrase-match", 80, phrase);
      matchedTerms.add(phrase);
    }
  }

  const tokenMatches = intent.tokens.filter((token) => entryTerms.has(token) || entryTerms.has(singularize(token)));
  for (const token of tokenMatches) {
    matchedTerms.add(token);
  }
  addScore(reasons, "token-overlap", tokenMatches.length * 55, tokenMatches.join(", "));

  const expandedMatches = intent.expandedTerms
    .filter((term) => !intent.tokens.includes(term))
    .filter((term) => entryTerms.has(term));
  for (const term of expandedMatches) {
    matchedTerms.add(term);
  }
  addScore(reasons, "intent-expansion", expandedMatches.length * 32, expandedMatches.join(", "));

  const relationshipMatches = intent.expandedTerms
    .filter((term) => entry.relationships.neighborNames.some((name) => tokenize(name).includes(term)));
  addScore(reasons, "relationship-context", Math.min(120, relationshipMatches.length * 18), relationshipMatches.join(", "));

  const categoryBoost = categoryBoostFor(entry, category);
  addScore(reasons, "architecture-layer", categoryBoost, `${entry.kind} in ${entry.architectureLayer}`);

  addScore(reasons, "graph-importance", Math.min(90, entry.importance * 18), `degree ${entry.relationships.degree}`);
  addScore(reasons, "usage-frequency", Math.min(60, entry.usageFrequency * 8), `${entry.usageFrequency} incoming edges`);
  addScore(reasons, "repository-locality", repositoryLocalityBoost(entry), repositoryLocalityEvidence(entry));

  const penalty = repositoryRankingPenalty(entry);
  const score = Math.max(0, reasons.reduce((total, reason) => total + reason.score, 0) - penalty);
  const returnedReasons = penalty > 0
    ? [...reasons, { factor: "repository-noise-demotion", score: -penalty, evidence: repositoryNoiseEvidence(entry) }]
    : reasons;
  return {
    nodeId: entry.stableId,
    stableId: entry.stableId,
    displayName: entry.displayName,
    kind: entry.kind,
    score: round(score, 3),
    confidence: round(Math.min(1, score / 650), 3),
    matchedTerms: uniqueStrings([...matchedTerms]),
    reasons: returnedReasons.filter((reason) => reason.score !== 0).sort(compareReasons),
    entry,
  };
}

function repositoryLocalityBoost(entry: SemanticIndexEntry): number {
  let score = 0;
  if (isRepositoryLocalEntry(entry)) {
    score += 28;
  }
  if (["Service", "Controller", "Module", "Route", "Repository", "Provider"].includes(entry.kind)) {
    score += 22;
  }
  if (["Configuration", "EnvironmentVariable"].includes(entry.kind)) {
    score += 18;
  }
  if (/(^|[/.])(test|tests|spec|__tests__)([/.]|$)|\.(test|spec)\./i.test(entry.filePath ?? "")) {
    score += 12;
  }
  return score;
}

function repositoryRankingPenalty(entry: SemanticIndexEntry): number {
  let penalty = 0;
  const text = `${entry.stableId} ${entry.filePath ?? ""} ${entry.package ?? ""} ${entry.displayName}`.toLowerCase();
  if (text.includes("node_modules") || entry.stableId.startsWith("dep:")) {
    penalty += 90;
  }
  if (/(\bdto\b|dto$|schema$|type$|types$|generated|__generated__)/i.test(entry.displayName) && !isRepositoryLocalEntry(entry)) {
    penalty += 35;
  }
  if (/node_modules|@nestjs\/|next\/dist|react\/|typescript\/lib/i.test(text)) {
    penalty += 45;
  }
  return penalty;
}

function repositoryLocalityEvidence(entry: SemanticIndexEntry): string {
  return isRepositoryLocalEntry(entry)
    ? `${entry.kind} from repository-local graph evidence`
    : `${entry.kind} from external or generated boundary`;
}

function repositoryNoiseEvidence(entry: SemanticIndexEntry): string {
  return `${entry.displayName} is external, generated, or generic framework-adjacent evidence`;
}

function isRepositoryLocalEntry(entry: SemanticIndexEntry): boolean {
  const text = `${entry.stableId} ${entry.filePath ?? ""} ${entry.package ?? ""}`.toLowerCase();
  return !text.includes("node_modules") && !entry.stableId.startsWith("dep:") && !entry.stableId.startsWith("framework:");
}

function fuzzyEntryMatch(entry: SemanticIndexEntry, intent: NormalizedIntent): boolean {
  const haystack = `${entry.stableId} ${entry.displayName} ${entry.aliases.join(" ")} ${entry.keywords.join(" ")}`.toLowerCase();
  return intent.tokens.some((token) => haystack.includes(token));
}

function recommendCapability(
  intent: NormalizedIntent,
  candidates: readonly SemanticCandidate[],
  category: SearchCategory,
): string {
  if (category === "configuration") {
    return "ConfigurationUsage";
  }
  if (category === "environment") {
    return "EnvironmentUsage";
  }
  if (category === "route") {
    return "RequestTrace";
  }
  const terms = new Set(intent.expandedTerms);
  const matched = RELATIONSHIP_CAPABILITIES
    .map((item) => ({
      capability: item.capability,
      score: item.terms.filter((term) => terms.has(term)).length,
    }))
    .sort((left, right) => right.score - left.score || left.capability.localeCompare(right.capability))[0];
  if (matched && matched.score > 0) {
    return matched.capability;
  }
  const topKind = candidates[0]?.kind;
  if (topKind === "Route" || topKind === "Controller") {
    return "RequestTrace";
  }
  if (topKind === "Configuration" || topKind === "EnvironmentVariable") {
    return "ConfigurationUsage";
  }
  return category === "repository" ? "ArchitectureSummary" : "FeatureTouchpoints";
}

function tokenize(value: string): readonly string[] {
  return uniqueStrings(splitIdentifier(value)
    .map((part) => normalizeToken(part))
    .filter((part) => part.length > 0)
    .filter((part) => !STOP_WORDS.has(part))
    .flatMap((part) => uniqueStrings([part, singularize(part)])));
}

function splitIdentifier(value: string): readonly string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[@#]/g, " ")
    .replace(/[:./\\|()[\]{}<>,;'"`~!$%^&*+=?]+/g, " ")
    .replace(/[-_]+/g, " ")
    .split(/\s+/g)
    .filter(Boolean);
}

function normalizeToken(token: string): string {
  return token
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizePhrase(value: string): string {
  return tokenize(value).join(" ");
}

function phraseVariants(raw: string, tokens: readonly string[]): readonly string[] {
  const variants = new Set<string>();
  const normalized = normalizePhrase(raw);
  if (normalized) {
    variants.add(normalized);
  }
  if (tokens.length > 0) {
    variants.add(tokens.join(" "));
    variants.add(tokens.join(""));
    variants.add(tokens.join("-"));
    variants.add(tokens.join("_"));
  }
  const withoutSuffix = stripFrameworkSuffix(tokens);
  if (withoutSuffix.length > 0) {
    variants.add(withoutSuffix.join(" "));
    variants.add(withoutSuffix.join(""));
  }
  return uniqueStrings([...variants]);
}

function stripFrameworkSuffix(tokens: readonly string[]): readonly string[] {
  let stripped = [...tokens];
  while (stripped.length > 1 && FRAMEWORK_SUFFIXES.has(stripped[stripped.length - 1] ?? "")) {
    stripped = stripped.slice(0, -1);
  }
  return stripped;
}

function singularize(value: string): string {
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.endsWith("sses")) {
    return value.slice(0, -2);
  }
  if (value.endsWith("s") && !value.endsWith("ss") && value.length > 3) {
    return value.slice(0, -1);
  }
  return value;
}

function pluralize(value: string): string {
  if (value.endsWith("y") && value.length > 2) {
    return `${value.slice(0, -1)}ies`;
  }
  if (value.endsWith("s")) {
    return value;
  }
  return `${value}s`;
}

function aliasesForNodeType(type: NodeType): readonly string[] {
  switch (type) {
    case "Route":
    case "Operation":
      return ["api", "endpoint", "route", "request"];
    case "Controller":
      return ["controller", "handler", "route"];
    case "Service":
    case "Provider":
      return ["service", "provider", "injectable"];
    case "Repository":
      return ["repository", "repo", "persistence", "database"];
    case "Configuration":
      return ["config", "configuration", "setting"];
    case "EnvironmentVariable":
      return ["env", "environment", "secret", "variable"];
    case "Framework":
      return ["framework", "library"];
    case "Package":
      return ["package", "workspace"];
    default:
      return [type.toLowerCase()];
  }
}

function expansionsFor(token: string): readonly string[] {
  return Object.prototype.hasOwnProperty.call(SEMANTIC_EXPANSIONS, token)
    ? SEMANTIC_EXPANSIONS[token] ?? []
    : [];
}

function categoryTypeSet(category: SearchCategory): ReadonlySet<NodeType> | undefined {
  const types = CATEGORY_TYPES[category];
  return types.length > 0 ? new Set(types) : undefined;
}

function includeEntryForCategory(
  entry: SemanticIndexEntry,
  intent: NormalizedIntent,
  category: SearchCategory,
): boolean {
  if (category !== "concept") {
    return true;
  }
  if (!["Import", "Export", "Decorator"].includes(entry.kind)) {
    return true;
  }
  const kind = entry.kind.toLowerCase();
  return intent.tokens.includes(kind) || intent.raw === entry.stableId || intent.normalized === entry.normalizedName;
}

function categoryBoostFor(entry: SemanticIndexEntry, category: SearchCategory): number {
  if (category === "concept") {
    return ["Service", "Provider", "Controller", "Route", "Operation", "Function", "Method", "Module", "Configuration", "EnvironmentVariable"].includes(entry.kind)
      ? 45
      : 0;
  }
  const types = CATEGORY_TYPES[category];
  if (types.length === 0) {
    return 0;
  }
  return types.includes(entry.kind) ? 75 : 0;
}

function nodeImportance(node: SoftwareGraphNode, degree: number, inbound: number): number {
  const layerWeight = {
    Workspace: 5,
    Application: 5,
    Package: 4,
    Module: 4,
    Controller: 4,
    Route: 4,
    Service: 4,
    Provider: 3,
    Repository: 3,
    Configuration: 3,
    EnvironmentVariable: 3,
  } as Partial<Record<NodeType, number>>;
  return round((layerWeight[node.type] ?? 1) + Math.log2(degree + 1) + Math.log2(inbound + 1), 3);
}

function architectureLayer(node: SoftwareGraphNode): string {
  if (["Route", "Controller", "Operation", "Middleware", "Guard"].includes(node.type)) {
    return "application-boundary";
  }
  if (["Service", "Provider", "Factory"].includes(node.type)) {
    return "application-service";
  }
  if (["Repository", "DatabaseTable", "Model", "Resource"].includes(node.type)) {
    return "persistence";
  }
  if (["Configuration", "EnvironmentVariable", "BuildTarget", "Script", "Task"].includes(node.type)) {
    return "configuration";
  }
  if (["Package", "Workspace", "Application", "Framework", "Dependency"].includes(node.type)) {
    return "architecture";
  }
  return "language";
}

function parentChainFor(
  node: SoftwareGraphNode,
  nodeById: ReadonlyMap<string, SoftwareGraphNode>,
  incomingEdges: readonly SoftwareGraphEdge[],
): readonly string[] {
  const parents: string[] = [];
  let current = node;
  const seen = new Set<string>([node.id]);
  for (let depth = 0; depth < 8; depth += 1) {
    const parentEdge = incomingEdges.find((edge) =>
      edge.to === current.id && (edge.type === "CONTAINS" || edge.type === "BELONGS_TO" || edge.type === "DECLARES" || edge.type === "REGISTERS")
    );
    if (!parentEdge || seen.has(parentEdge.from)) {
      break;
    }
    const parent = nodeById.get(parentEdge.from);
    if (!parent) {
      break;
    }
    parents.push(`${parent.type}:${parent.name}`);
    seen.add(parent.id);
    current = parent;
  }
  return parents;
}

function containingName(parentChain: readonly string[], type: NodeType): string | undefined {
  const prefix = `${type}:`;
  return parentChain.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function metadataTextValues(metadata: JsonObject | undefined): readonly string[] {
  if (!metadata) {
    return [];
  }
  const values: string[] = [];
  collectMetadataText(metadata, values, 0);
  return values;
}

function collectMetadataText(value: unknown, values: string[], depth: number): void {
  if (depth > 3 || value === null || value === undefined) {
    return;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    values.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) {
      collectMetadataText(item, values, depth + 1);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))) {
      if (isNoisyMetadataKey(key)) {
        continue;
      }
      values.push(key);
      collectMetadataText(entry, values, depth + 1);
    }
  }
}

function isNoisyMetadataKey(key: string): boolean {
  return ["language", "parser", "parserVersion", "passId", "provenance", "source"].includes(key);
}

function routeTextValues(node: SoftwareGraphNode): readonly string[] {
  if (node.type !== "Route" && node.type !== "Operation") {
    return [];
  }
  return [
    stringMetadata(node.metadata, "method") ?? "",
    stringMetadata(node.metadata, "path") ?? "",
    stringMetadata(node.metadata, "route") ?? "",
    node.name,
  ].filter(Boolean);
}

function deterministicDocumentation(metadata: JsonObject | undefined): string | undefined {
  return stringMetadata(metadata, "documentation") ?? stringMetadata(metadata, "description") ?? stringMetadata(metadata, "summary");
}

function deterministicComments(metadata: JsonObject | undefined): string | undefined {
  return stringMetadata(metadata, "comments") ?? stringMetadata(metadata, "comment") ?? stringMetadata(metadata, "jsdoc");
}

function stringMetadata(metadata: JsonObject | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function frameworkFromNeighbors(neighbors: readonly SoftwareGraphNode[]): string | undefined {
  return neighbors.find((node) => node.type === "Framework")?.name;
}

function folderPath(file: string): string {
  const normalized = normalizePath(file);
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/") || ".";
}

function countEdgesByType(edges: readonly SoftwareGraphEdge[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function groupEdges(edges: readonly SoftwareGraphEdge[], side: "from" | "to"): ReadonlyMap<string, readonly SoftwareGraphEdge[]> {
  const grouped = new Map<string, SoftwareGraphEdge[]>();
  for (const edge of edges) {
    const current = grouped.get(edge[side]) ?? [];
    current.push(edge);
    grouped.set(edge[side], current);
  }
  return new Map([...grouped.entries()].map(([key, values]) => [key, values.sort(compareEdges)] as const));
}

function addInverted(map: Map<string, Set<string>>, term: string, id: string): void {
  if (!term || STOP_WORDS.has(term)) {
    return;
  }
  const current = map.get(term) ?? new Set<string>();
  current.add(id);
  map.set(term, current);
}

function addScore(reasons: ScoreReason[], factor: string, score: number, evidence: string): void {
  if (score <= 0) {
    return;
  }
  reasons.push({ factor, score: round(score, 3), evidence });
}

function compareCandidates(left: SemanticCandidate, right: SemanticCandidate): number {
  return right.score - left.score || left.kind.localeCompare(right.kind) || left.stableId.localeCompare(right.stableId);
}

function compareReasons(left: ScoreReason, right: ScoreReason): number {
  return right.score - left.score || left.factor.localeCompare(right.factor);
}

function compareEntries(left: SemanticIndexEntry, right: SemanticIndexEntry): number {
  return left.stableId.localeCompare(right.stableId);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function performanceNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isNode(value: SoftwareGraphNode | undefined): value is SoftwareGraphNode {
  return Boolean(value);
}

function isEntry(value: SemanticIndexEntry | undefined): value is SemanticIndexEntry {
  return Boolean(value);
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as T & O;
}
