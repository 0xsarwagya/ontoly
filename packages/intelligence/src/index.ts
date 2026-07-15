import {
  createSemanticIndex,
  resolveIntent,
  type JsonObject,
  type NodeType,
  type SemanticIndex,
  type SemanticSearchResult,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import {
  createSemanticsArtifact,
  type FeatureOwnership,
  type IntentVocabulary,
  type SemanticsArtifact,
  type SemanticGraphLink,
  type SemanticNeighborhood,
} from "@0xsarwagya/ontoly-enhancer-semantics";

export interface CreateIntelligenceOptions {
  readonly semanticIndex?: SemanticIndex | undefined;
  readonly semantics?: SemanticsArtifact | undefined;
}

export interface IntentExpansionResult {
  readonly query: string;
  readonly normalized: string;
  readonly expandedTerms: readonly string[];
  readonly matchedVocabulary: readonly string[];
  readonly matchedFeatures: readonly FeatureMatch[];
  readonly matchedIntents: readonly IntentMatch[];
  readonly candidates: readonly IntelligenceCandidate[];
  readonly confidence: number;
}

export interface IntentResolutionResult extends IntentExpansionResult {
  readonly recommendedCapability: string;
  readonly evidence: readonly string[];
}

export interface IntelligenceEvidencePack {
  readonly query: string;
  readonly status: "PASS" | "PARTIAL" | "NOT_FOUND";
  readonly nodes: readonly IntelligenceEvidenceNode[];
  readonly links: readonly SemanticGraphLink[];
  readonly files: readonly string[];
  readonly features: readonly FeatureMatch[];
  readonly expansion: IntentExpansionResult;
  readonly confidence: number;
  readonly diagnostics: readonly JsonObject[];
}

export interface FeatureMatch {
  readonly id: string;
  readonly name: string;
  readonly terms: readonly string[];
  readonly score: number;
  readonly ownerNodeIds: readonly string[];
  readonly confidence: number;
}

export interface IntentMatch {
  readonly intent: string;
  readonly terms: readonly string[];
  readonly nodeIds: readonly string[];
  readonly score: number;
  readonly confidence: number;
}

export interface IntelligenceCandidate {
  readonly nodeId: string;
  readonly name: string;
  readonly kind: NodeType;
  readonly score: number;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface IntelligenceEvidenceNode extends IntelligenceCandidate {
  readonly file?: string | undefined;
  readonly featureIds: readonly string[];
  readonly relatedNodeIds: readonly string[];
}

export interface SemanticNeighborhoodResult {
  readonly node: IntelligenceEvidenceNode;
  readonly neighborhood: SemanticNeighborhood;
  readonly related: readonly IntelligenceEvidenceNode[];
}

export interface OntolyIntelligence {
  readonly graph: SoftwareGraph;
  readonly semanticIndex: SemanticIndex;
  readonly semantics: SemanticsArtifact;
  readonly expand: (query: string) => IntentExpansionResult;
  readonly intent: (query: string) => IntentResolutionResult;
  readonly evidence: (query: string, options?: EvidenceOptions) => IntelligenceEvidencePack;
  readonly feature: (query: string, options?: FeatureOptions) => readonly FeatureMatch[];
  readonly related: (nodeIdOrQuery: string, options?: RelatedOptions) => SemanticNeighborhoodResult | undefined;
}

export interface EvidenceOptions {
  readonly nodeLimit?: number | undefined;
  readonly linkLimit?: number | undefined;
  readonly fileLimit?: number | undefined;
}

export interface FeatureOptions {
  readonly limit?: number | undefined;
}

export interface RelatedOptions {
  readonly relatedLimit?: number | undefined;
}

const DEFAULT_NODE_LIMIT = 20;
const DEFAULT_LINK_LIMIT = 50;
const DEFAULT_FILE_LIMIT = 10;
const DEFAULT_FEATURE_LIMIT = 10;
const DEFAULT_RELATED_LIMIT = 20;
const EXECUTABLE_QUERY_TERMS = new Set(["average", "averages", "calculate", "code", "compute", "function", "method"]);
const EXECUTABLE_KINDS = new Set<NodeType>(["Function", "Method", "Operation"]);
const GENERIC_EXPANSION_TERMS = new Set([
  "class",
  "classes",
  "constructor",
  "constructors",
  "default",
  "defaults",
  "dependency",
  "export",
  "exported",
  "exporteds",
  "exportkind",
  "exports",
  "fn",
  "iface",
  "import",
  "indexs",
  "interface",
  "interfaces",
  "module",
  "service",
  "src",
  "type",
]);

export function createIntelligence(
  graph: SoftwareGraph,
  options: CreateIntelligenceOptions = {},
): OntolyIntelligence {
  const semanticIndex = options.semanticIndex ?? createSemanticIndex(graph);
  const semantics = options.semantics ?? createSemanticsArtifact(graph, semanticIndex);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const neighborhoodByNodeId = new Map(semantics.neighborhoods.map((neighborhood) => [neighborhood.nodeId, neighborhood] as const));
  const featureIdsByNode = nodeFeatureIndex(semantics.featureOwnership);

  function expand(query: string): IntentExpansionResult {
    const resolved = resolveIntent(semanticIndex, query, { limit: 20 });
    const vocabulary = matchedVocabulary(semantics, resolved);
    const features = feature(query, { limit: DEFAULT_FEATURE_LIMIT });
    const intents = matchedIntents(semantics.intentVocabulary, resolved);
    const candidates = mergeCandidates({
      graph,
      resolved,
      features,
      intents,
      vocabulary,
    });
    const expandedTerms = uniqueStrings([
      ...resolved.intent.expandedTerms,
      ...vocabulary.flatMap((term) => [term, ...aliasesForVocabulary(semantics, term)]),
      ...features.flatMap((item) => item.terms),
      ...intents.flatMap((item) => item.terms),
    ].filter(isUsefulExpansionTerm)).slice(0, 80);

    return {
      query,
      normalized: resolved.intent.normalized,
      expandedTerms,
      matchedVocabulary: vocabulary,
      matchedFeatures: features,
      matchedIntents: intents,
      candidates,
      confidence: round(Math.max(resolved.confidence, average([...features.map((item) => item.confidence), ...intents.map((item) => item.confidence)]))),
    };
  }

  function intent(query: string): IntentResolutionResult {
    const expansion = expand(query);
    const resolved = resolveIntent(semanticIndex, query, { limit: 20 });
    return {
      ...expansion,
      recommendedCapability: resolved.recommendedCapability,
      evidence: [
        ...resolved.evidence,
        ...expansion.matchedFeatures.slice(0, 3).map((featureMatch) => `Feature ${featureMatch.name} matched ${featureMatch.terms.join(", ")}.`),
        ...expansion.matchedIntents.slice(0, 3).map((intentMatch) => `Intent ${intentMatch.intent} expanded to ${intentMatch.terms.join(", ")}.`),
      ],
    };
  }

  function evidence(query: string, options: EvidenceOptions = {}): IntelligenceEvidencePack {
    const expansion = expand(query);
    const nodeLimit = clamp(options.nodeLimit ?? DEFAULT_NODE_LIMIT, 1, 100);
    const linkLimit = clamp(options.linkLimit ?? DEFAULT_LINK_LIMIT, 0, 200);
    const fileLimit = clamp(options.fileLimit ?? DEFAULT_FILE_LIMIT, 0, 50);
    const nodeIds = uniqueStrings([
      ...expansion.candidates.map((candidate) => candidate.nodeId),
      ...expansion.matchedFeatures.flatMap((featureMatch) => featureMatch.ownerNodeIds),
      ...expansion.matchedIntents.flatMap((intentMatch) => intentMatch.nodeIds),
    ]).slice(0, nodeLimit);
    const nodes = nodeIds
      .map((nodeId) => evidenceNode(nodeById.get(nodeId), expansion, featureIdsByNode, neighborhoodByNodeId))
      .filter(isEvidenceNode)
      .sort(compareEvidenceNodes)
      .slice(0, nodeLimit);
    const nodeIdSet = new Set(nodes.map((node) => node.nodeId));
    const links = semantics.semanticGraph.links
      .filter((link) => semanticLinkTouches(link, nodeIdSet))
      .sort(compareSemanticGraphLinks)
      .slice(0, linkLimit);
    const files = uniqueStrings(nodes.map((node) => node.file ?? "").filter(Boolean)).slice(0, fileLimit);
    const diagnostics = nodes.length === 0
      ? [{
        code: "INTELLIGENCE_NOT_FOUND",
        message: `No semantic evidence matched "${query}".`,
        suggestedFix: "Run ontoly semantics build, then retry with a narrower feature, symbol, or route name.",
      }]
      : [];

    return {
      query,
      status: nodes.length === 0 ? "NOT_FOUND" : nodes.length < nodeLimit ? "PASS" : "PARTIAL",
      nodes,
      links,
      files,
      features: expansion.matchedFeatures,
      expansion,
      confidence: expansion.confidence,
      diagnostics,
    };
  }

  function feature(query: string, options: FeatureOptions = {}): readonly FeatureMatch[] {
    const terms = termsForQuery(query);
    const resolved = resolveIntent(semanticIndex, query, { limit: 20 });
    const candidateNodeIds = new Set(resolved.candidates.map((candidate) => candidate.nodeId));
    const limit = clamp(options.limit ?? DEFAULT_FEATURE_LIMIT, 1, 100);
    return semantics.featureOwnership
      .map((featureOwnership) => featureMatch(featureOwnership, terms, candidateNodeIds))
      .filter((match) => match.score > 0)
      .sort(compareFeatureMatches)
      .slice(0, limit);
  }

  function related(nodeIdOrQuery: string, options: RelatedOptions = {}): SemanticNeighborhoodResult | undefined {
    const node = resolveNode(nodeIdOrQuery, graph, semanticIndex);
    if (!node) {
      return undefined;
    }
    const neighborhood = neighborhoodByNodeId.get(node.id);
    if (!neighborhood) {
      return undefined;
    }
    const limit = clamp(options.relatedLimit ?? DEFAULT_RELATED_LIMIT, 1, 100);
    const expansion = expand(node.name);
    const relatedNodes = uniqueStrings([
      ...neighborhood.related.map((item) => item.nodeId),
      ...neighborhood.relatedByFeature.map((item) => item.nodeId),
      ...neighborhood.relatedByIntent.map((item) => item.nodeId),
      ...neighborhood.relatedByVocabulary.map((item) => item.nodeId),
    ])
      .map((nodeId) => evidenceNode(nodeById.get(nodeId), expansion, featureIdsByNode, neighborhoodByNodeId))
      .filter(isEvidenceNode)
      .sort(compareEvidenceNodes)
      .slice(0, limit);
    const serializedNode = evidenceNode(node, expansion, featureIdsByNode, neighborhoodByNodeId);
    if (!serializedNode) {
      return undefined;
    }
    return {
      node: serializedNode,
      neighborhood,
      related: relatedNodes,
    };
  }

  return {
    graph,
    semanticIndex,
    semantics,
    expand,
    intent,
    evidence,
    feature,
    related,
  };
}

function matchedVocabulary(semantics: SemanticsArtifact, resolved: SemanticSearchResult): readonly string[] {
  const terms = new Set(resolved.intent.expandedTerms);
  const matched = semantics.domainVocabulary
    .filter((term) => terms.has(term.term) || term.aliases.some((alias) => terms.has(alias)))
    .map((term) => term.term);
  return uniqueStrings([...matched, ...resolved.matchedConcepts].filter(isUsefulExpansionTerm)).slice(0, 30);
}

function aliasesForVocabulary(semantics: SemanticsArtifact, term: string): readonly string[] {
  return semantics.domainVocabulary.find((item) => item.term === term)?.aliases ?? [];
}

function matchedIntents(
  intents: readonly IntentVocabulary[],
  resolved: SemanticSearchResult,
): readonly IntentMatch[] {
  const terms = new Set(resolved.intent.expandedTerms);
  return intents
    .map((intent) => {
      const overlap = intent.terms.filter((term) => terms.has(term) || terms.has(intent.intent));
      const score = overlap.length + (terms.has(intent.intent) ? 2 : 0);
      return {
        intent: intent.intent,
        terms: intent.terms,
        nodeIds: intent.nodeIds,
        score,
        confidence: intent.confidence,
      };
    })
    .filter((match) => match.score > 0)
    .sort(compareIntentMatches)
    .slice(0, 12);
}

function mergeCandidates(input: {
  readonly graph: SoftwareGraph;
  readonly resolved: SemanticSearchResult;
  readonly features: readonly FeatureMatch[];
  readonly intents: readonly IntentMatch[];
  readonly vocabulary: readonly string[];
}): readonly IntelligenceCandidate[] {
  const nodeById = new Map(input.graph.nodes.map((node) => [node.id, node] as const));
  const scores = new Map<string, IntelligenceCandidate>();
  for (const candidate of input.resolved.candidates) {
    const node = nodeById.get(candidate.nodeId);
    if (!node) {
      continue;
    }
    putCandidate(scores, node, candidate.score, candidate.confidence, candidate.reasons.map((reason) => reason.factor));
  }
  for (const feature of input.features) {
    for (const nodeId of feature.ownerNodeIds) {
      const node = nodeById.get(nodeId);
      if (node) {
        putCandidate(scores, node, feature.score, feature.confidence, [`feature:${feature.id}`]);
      }
    }
  }
  for (const intent of input.intents) {
    for (const nodeId of intent.nodeIds.slice(0, 10)) {
      const node = nodeById.get(nodeId);
      if (node) {
        putCandidate(scores, node, intent.score, intent.confidence, [`intent:${intent.intent}`]);
      }
    }
  }
  return [...scores.values()].sort(compareCandidates).slice(0, 40);
}

function putCandidate(
  candidates: Map<string, IntelligenceCandidate>,
  node: SoftwareGraphNode,
  score: number,
  confidence: number,
  reasons: readonly string[],
): void {
  const current = candidates.get(node.id);
  const nextScore = round(score);
  if (!current || current.score < nextScore) {
    candidates.set(node.id, {
      nodeId: node.id,
      name: node.name,
      kind: node.type,
      score: nextScore,
      confidence: round(confidence),
      reasons: uniqueStrings(reasons),
    });
  }
}

function featureMatch(
  feature: FeatureOwnership,
  queryTerms: readonly string[],
  candidateNodeIds: ReadonlySet<string> = new Set(),
): FeatureMatch {
  const overlap = feature.terms.filter((term) => queryTerms.includes(term));
  const nameTerms = termsForQuery(feature.name);
  const nameOverlap = nameTerms.filter((term) => queryTerms.includes(term));
  const candidateOverlap = feature.ownedNodeIds.filter((nodeId) => candidateNodeIds.has(nodeId));
  const ownerOverlap = feature.owners.filter((owner) => candidateNodeIds.has(owner.nodeId));
  const score = overlap.length * 3 + nameOverlap.length * 2 + candidateOverlap.length * 2 + ownerOverlap.length * 3;
  return {
    id: feature.id,
    name: feature.name,
    terms: feature.terms,
    score,
    ownerNodeIds: feature.owners.map((owner) => owner.nodeId),
    confidence: feature.confidence.overall,
  };
}

function evidenceNode(
  node: SoftwareGraphNode | undefined,
  expansion: IntentExpansionResult,
  featureIdsByNode: ReadonlyMap<string, readonly string[]>,
  neighborhoodByNodeId: ReadonlyMap<string, SemanticNeighborhood>,
): IntelligenceEvidenceNode | undefined {
  if (!node) {
    return undefined;
  }
  const candidate = expansion.candidates.find((item) => item.nodeId === node.id);
  const neighborhood = neighborhoodByNodeId.get(node.id);
  return {
    nodeId: node.id,
    name: node.name,
    kind: node.type,
    score: candidate?.score ?? 0,
    confidence: candidate?.confidence ?? neighborhood?.confidence.overall ?? 0.5,
    reasons: candidate?.reasons ?? [],
    ...(node.file ? { file: node.file } : {}),
    featureIds: featureIdsByNode.get(node.id) ?? [],
    relatedNodeIds: uniqueStrings([
      ...(neighborhood?.related.map((item) => item.nodeId) ?? []),
      ...(neighborhood?.relatedByFeature.map((item) => item.nodeId) ?? []),
    ]).slice(0, 20),
  };
}

function resolveNode(
  nodeIdOrQuery: string,
  graph: SoftwareGraph,
  semanticIndex: SemanticIndex,
): SoftwareGraphNode | undefined {
  const exact = graph.nodes.find((node) => node.id === nodeIdOrQuery || node.name === nodeIdOrQuery);
  if (exact) {
    return exact;
  }
  const resolved = resolveIntent(semanticIndex, nodeIdOrQuery, { limit: 8 });
  const queryTerms = termsForQuery(nodeIdOrQuery);
  const wantsExecutable = queryTerms.some((term) => EXECUTABLE_QUERY_TERMS.has(term));
  const preferred = wantsExecutable
    ? resolved.candidates.find((candidate) =>
      EXECUTABLE_KINDS.has(candidate.kind) && termsForQuery(candidate.displayName).some((term) => queryTerms.includes(term)),
    ) ?? resolved.candidates[0]
    : resolved.candidates[0];
  const candidateId = preferred?.nodeId;
  return candidateId ? graph.nodes.find((node) => node.id === candidateId) : undefined;
}

function nodeFeatureIndex(features: readonly FeatureOwnership[]): ReadonlyMap<string, readonly string[]> {
  const byNode = new Map<string, string[]>();
  for (const feature of features) {
    for (const nodeId of feature.ownedNodeIds) {
      const current = byNode.get(nodeId) ?? [];
      current.push(feature.id);
      byNode.set(nodeId, current);
    }
  }
  return new Map([...byNode.entries()].map(([nodeId, ids]) => [nodeId, uniqueStrings(ids)]));
}

function semanticLinkTouches(link: SemanticGraphLink, nodeIds: ReadonlySet<string>): boolean {
  return nodeIds.has(link.from.replace(/^node:/, "")) || nodeIds.has(link.to.replace(/^node:/, ""));
}

function termsForQuery(query: string): readonly string[] {
  return uniqueStrings(query
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter(isUsefulExpansionTerm));
}

function isUsefulExpansionTerm(term: string): boolean {
  return term.length <= 18 &&
    !/\d/.test(term) &&
    !GENERIC_EXPANSION_TERMS.has(term) &&
    !term.includes("srcts") &&
    !term.includes("srctsx") &&
    !/^(class|constructor|fn|method)/.test(term) &&
    !/(thrown|throws)$/.test(term) &&
    !/(?:src|dist|test|spec)(?:ts|tsx|js|jsx)$/.test(term);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isEvidenceNode(value: IntelligenceEvidenceNode | undefined): value is IntelligenceEvidenceNode {
  return Boolean(value);
}

function compareCandidates(left: IntelligenceCandidate, right: IntelligenceCandidate): number {
  return right.score - left.score || right.confidence - left.confidence || left.nodeId.localeCompare(right.nodeId);
}

function compareEvidenceNodes(left: IntelligenceEvidenceNode, right: IntelligenceEvidenceNode): number {
  return compareCandidates(left, right);
}

function compareFeatureMatches(left: FeatureMatch, right: FeatureMatch): number {
  return right.score - left.score || right.confidence - left.confidence || left.id.localeCompare(right.id);
}

function compareIntentMatches(left: IntentMatch, right: IntentMatch): number {
  return right.score - left.score || right.confidence - left.confidence || left.intent.localeCompare(right.intent);
}

function compareSemanticGraphLinks(left: SemanticGraphLink, right: SemanticGraphLink): number {
  return left.type.localeCompare(right.type) || left.from.localeCompare(right.from) || left.to.localeCompare(right.to);
}
