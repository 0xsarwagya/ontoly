import {
  createSemanticIndex,
  stableHash,
  stableStringify,
  type JsonObject,
  type JsonValue,
  type NodeType,
  type SemanticIndex,
  type SemanticIndexEntry,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import {
  ARTIFACT_DESCRIPTORS,
  artifactRequirement,
  createArtifact,
  defineEnhancer,
  type Enhancer,
  type EnhancerValidationIssue,
} from "@0xsarwagya/ontoly-enhancer";

export const SEMANTICS_ARTIFACT_VERSION = "1.0.0";
export const SEMANTICS_ENHANCER_ID = "semantics";
export const SEMANTICS_ENHANCER_VERSION = "1.0.0";

export interface SemanticConfidence {
  readonly syntax: number;
  readonly semantic: number;
  readonly feature: number;
  readonly relationship: number;
  readonly overall: number;
}

export interface FeatureOwner {
  readonly nodeId: string;
  readonly name: string;
  readonly kind: NodeType;
  readonly score: number;
  readonly evidence: readonly string[];
}

export interface FeatureOwnership {
  readonly id: string;
  readonly name: string;
  readonly terms: readonly string[];
  readonly owners: readonly FeatureOwner[];
  readonly ownedNodeIds: readonly string[];
  readonly omittedNodeCount: number;
  readonly confidence: SemanticConfidence;
  readonly evidence: readonly string[];
}

export interface DomainVocabulary {
  readonly term: string;
  readonly aliases: readonly string[];
  readonly nodeIds: readonly string[];
  readonly featureIds: readonly string[];
  readonly confidence: number;
}

export interface IntentVocabulary {
  readonly intent: string;
  readonly terms: readonly string[];
  readonly nodeIds: readonly string[];
  readonly featureIds: readonly string[];
  readonly confidence: number;
}

export interface RelatedNode {
  readonly nodeId: string;
  readonly reason: string;
  readonly score: number;
}

export interface SemanticNeighborhood {
  readonly nodeId: string;
  readonly related: readonly RelatedNode[];
  readonly relatedByFeature: readonly RelatedNode[];
  readonly relatedByIntent: readonly RelatedNode[];
  readonly relatedByVocabulary: readonly RelatedNode[];
  readonly confidence: SemanticConfidence;
}

export interface SemanticGraphNode {
  readonly id: string;
  readonly kind: "Feature" | "Intent" | "Vocabulary" | "SoftwareNode";
  readonly label: string;
  readonly weight: number;
  readonly nodeId?: string | undefined;
  readonly featureId?: string | undefined;
  readonly terms?: readonly string[] | undefined;
}

export interface SemanticGraphLink {
  readonly id: string;
  readonly type: "OWNS" | "HAS_TERM" | "EXPANDS_TO" | "MENTIONS" | "RELATED_TO";
  readonly from: string;
  readonly to: string;
  readonly weight: number;
  readonly evidence: readonly string[];
}

export interface GraphifyStyleSemanticGraph {
  readonly nodes: readonly SemanticGraphNode[];
  readonly links: readonly SemanticGraphLink[];
  readonly statistics: {
    readonly nodes: number;
    readonly links: number;
    readonly features: number;
    readonly vocabulary: number;
    readonly intents: number;
    readonly softwareNodes: number;
  };
}

export interface SemanticsArtifact {
  readonly version: string;
  readonly graphVersion: string;
  readonly graphHash: string;
  readonly repository: {
    readonly name: string;
    readonly root: string;
    readonly packageName?: string | undefined;
  };
  readonly featureOwnership: readonly FeatureOwnership[];
  readonly domainVocabulary: readonly DomainVocabulary[];
  readonly intentVocabulary: readonly IntentVocabulary[];
  readonly neighborhoods: readonly SemanticNeighborhood[];
  readonly semanticGraph: GraphifyStyleSemanticGraph;
  readonly statistics: {
    readonly nodes: number;
    readonly edges: number;
    readonly features: number;
    readonly domainTerms: number;
    readonly intentTerms: number;
    readonly neighborhoods: number;
    readonly semanticGraphNodes: number;
    readonly semanticGraphLinks: number;
  };
  readonly deterministicHash: string;
}

interface EntryContext {
  readonly entry: SemanticIndexEntry;
  readonly node: SoftwareGraphNode;
  readonly tokens: readonly string[];
  readonly featureTerms: readonly string[];
}

interface FeatureBucket {
  readonly id: string;
  readonly name: string;
  readonly terms: readonly string[];
  readonly entries: readonly EntryContext[];
}

const MAX_FEATURES = 240;
const MAX_FEATURE_NODES = 80;
const MAX_FEATURE_OWNERS = 12;
const MAX_DOMAIN_TERMS = 320;
const MAX_INTENT_TERMS = 320;
const MAX_NODE_REFERENCES = 40;
const MAX_NEIGHBORHOOD_RELATED = 16;
const MAX_SEMANTIC_GRAPH_SOFTWARE_NODES = 1200;
const MAX_SEMANTIC_GRAPH_LINKS = 6000;

const FEATURE_OWNER_KINDS = new Map<NodeType, number>([
  ["Service", 120],
  ["Controller", 110],
  ["Repository", 100],
  ["Provider", 92],
  ["Module", 90],
  ["Route", 82],
  ["Operation", 78],
  ["Class", 70],
  ["Function", 64],
  ["Method", 64],
  ["Interface", 56],
  ["TypeAlias", 54],
  ["Model", 52],
  ["Resource", 50],
  ["Configuration", 46],
  ["EnvironmentVariable", 44],
]);

const GENERIC_TERMS = new Set([
  "app",
  "application",
  "base",
  "class",
  "classes",
  "common",
  "config",
  "configuration",
  "constructor",
  "constructors",
  "controller",
  "default",
  "defaults",
  "dependency",
  "dto",
  "entity",
  "export",
  "exported",
  "exporteds",
  "exportkind",
  "exports",
  "file",
  "fn",
  "handler",
  "helper",
  "import",
  "iface",
  "index",
  "indexs",
  "input",
  "interface",
  "interfaces",
  "internal",
  "main",
  "mapper",
  "model",
  "module",
  "node",
  "output",
  "provider",
  "repository",
  "request",
  "response",
  "resolver",
  "route",
  "schema",
  "service",
  "shared",
  "source",
  "src",
  "type",
  "utils",
  "value",
]);

const INTENT_ANCHORS = new Set([
  "auth",
  "authentication",
  "authorization",
  "cache",
  "device",
  "jwt",
  "login",
  "notification",
  "redis",
  "signal",
  "signals",
  "sleep",
  "threshold",
  "thresholds",
]);

export function createSemanticsEnhancer(): Enhancer {
  return defineEnhancer({
    id: SEMANTICS_ENHANCER_ID,
    name: "Semantics",
    description: "Generate deterministic feature ownership, vocabulary, intent, neighborhoods, and a Graphify-style semantic graph.",
    version: SEMANTICS_ENHANCER_VERSION,
    requires: [artifactRequirement("SoftwareGraph"), artifactRequirement("SemanticIndex", { optional: true })],
    produces: [ARTIFACT_DESCRIPTORS.Semantics],
    supportsIncremental: true,
    run: (context) => {
      const graphArtifact = context.artifacts.require("SoftwareGraph");
      const semanticIndex = context.semanticIndex ?? createSemanticIndex(context.graph);
      const semantics = createSemanticsArtifact(context.graph, semanticIndex);
      const semanticIndexArtifact = context.artifacts.get("SemanticIndex");

      return {
        artifacts: [
          createArtifact({
            descriptor: ARTIFACT_DESCRIPTORS.Semantics,
            data: semantics as unknown as JsonValue,
            graphHash: context.graph.metadata.deterministicHash,
            graphGeneratedAt: context.graph.metadata.generatedAt,
            producedBy: SEMANTICS_ENHANCER_ID,
            enhancerVersion: SEMANTICS_ENHANCER_VERSION,
            dependencies: [
              graphArtifact,
              ...(semanticIndexArtifact ? [semanticIndexArtifact] : []),
            ],
          }),
        ],
        statistics: {
          features: semantics.statistics.features,
          domainTerms: semantics.statistics.domainTerms,
          intentTerms: semantics.statistics.intentTerms,
          neighborhoods: semantics.statistics.neighborhoods,
          semanticGraphNodes: semantics.statistics.semanticGraphNodes,
          semanticGraphLinks: semantics.statistics.semanticGraphLinks,
        },
      };
    },
  });
}

export function createSemanticsArtifact(graph: SoftwareGraph, semanticIndex: SemanticIndex = createSemanticIndex(graph)): SemanticsArtifact {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const incoming = groupEdges(graph.edges, "to");
  const outgoing = groupEdges(graph.edges, "from");
  const contexts = semanticIndex.entries
    .map((entry) => entryContext(entry, nodeById.get(entry.stableId)))
    .filter(isEntryContext)
    .sort(compareEntryContexts);
  const buckets = buildFeatureBuckets(contexts);
  const featureOwnership = buckets.map((bucket) => featureOwnershipFor(bucket, incoming, outgoing)).sort(compareFeatureOwnership);
  const featureIdsByNode = featureNodeIndex(featureOwnership);
  const domainVocabulary = [...buildDomainVocabulary(semanticIndex, featureIdsByNode)].sort(compareDomainVocabulary);
  const intentVocabulary = [...buildIntentVocabulary(contexts, featureIdsByNode)].sort(compareIntentVocabulary);
  const intentIdsByNode = nodeTermIndex(intentVocabulary.map((intent) => ({
    id: intent.intent,
    nodeIds: intent.nodeIds,
  })));
  const vocabularyIdsByNode = nodeTermIndex(domainVocabulary.map((term) => ({
    id: term.term,
    nodeIds: term.nodeIds,
  })));
  const neighborhoods = contexts
    .map((context) => neighborhoodFor({
      context,
      nodeById,
      incoming,
      outgoing,
      featureOwnership,
      featureIdsByNode,
      intentIdsByNode,
      vocabularyIdsByNode,
    }))
    .sort(compareNeighborhoods);
  const semanticGraph = buildSemanticGraph({
    featureOwnership,
    domainVocabulary,
    intentVocabulary,
    neighborhoods,
    nodeById,
  });
  const withoutHash = {
    version: SEMANTICS_ARTIFACT_VERSION,
    graphVersion: graph.version,
    graphHash: graph.metadata.deterministicHash,
    repository: repositoryReference(graph),
    featureOwnership,
    domainVocabulary,
    intentVocabulary,
    neighborhoods,
    semanticGraph,
    statistics: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      features: featureOwnership.length,
      domainTerms: domainVocabulary.length,
      intentTerms: intentVocabulary.length,
      neighborhoods: neighborhoods.length,
      semanticGraphNodes: semanticGraph.statistics.nodes,
      semanticGraphLinks: semanticGraph.statistics.links,
    },
  };

  return {
    ...withoutHash,
    deterministicHash: stableHash(stableStringify(withoutHash)),
  };
}

export function validateSemanticsArtifact(
  artifact: SemanticsArtifact,
  graph: SoftwareGraph,
): readonly EnhancerValidationIssue[] {
  const issues: EnhancerValidationIssue[] = [];
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));

  if (artifact.version !== SEMANTICS_ARTIFACT_VERSION) {
    issues.push(validationIssue("SEMANTICS_VERSION_MISMATCH", "error", `Semantics version ${artifact.version} is not supported.`));
  }
  if (artifact.graphHash !== graph.metadata.deterministicHash) {
    issues.push(validationIssue("SEMANTICS_GRAPH_HASH_MISMATCH", "error", "Semantics artifact graph hash does not match the Software Graph."));
  }
  const neighborhoods = new Set(artifact.neighborhoods.map((neighborhood) => neighborhood.nodeId));
  for (const node of graph.nodes) {
    if (!neighborhoods.has(node.id)) {
      issues.push(validationIssue("SEMANTICS_NEIGHBORHOOD_MISSING", "warning", `Missing semantic neighborhood for ${node.id}.`));
      break;
    }
  }
  for (const feature of artifact.featureOwnership) {
    for (const nodeId of feature.ownedNodeIds) {
      if (!graphNodeIds.has(nodeId)) {
        issues.push(validationIssue("SEMANTICS_FEATURE_NODE_MISSING", "error", `Feature ${feature.id} references missing node ${nodeId}.`));
      }
    }
  }

  return issues.sort(compareValidationIssues);
}

function buildFeatureBuckets(contexts: readonly EntryContext[]): readonly FeatureBucket[] {
  const buckets = new Map<string, EntryContext[]>();
  const termsById = new Map<string, readonly string[]>();

  for (const context of contexts) {
    const terms = context.featureTerms;
    if (terms.length === 0) {
      continue;
    }
    const id = `feature:${terms.join("-")}`;
    termsById.set(id, terms);
    const items = buckets.get(id) ?? [];
    items.push(context);
    buckets.set(id, items);
  }

  return [...buckets.entries()]
    .map(([id, entries]) => ({
      id,
      name: titleCase((termsById.get(id) ?? []).join(" ")),
      terms: termsById.get(id) ?? [],
      entries: entries.sort(compareEntryContexts),
    }))
    .sort((left, right) => right.entries.length - left.entries.length || left.id.localeCompare(right.id))
    .slice(0, MAX_FEATURES)
    .sort(compareFeatureBuckets);
}

function featureOwnershipFor(
  bucket: FeatureBucket,
  incoming: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
  outgoing: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
): FeatureOwnership {
  const ranked = bucket.entries
    .map((context) => ({
      context,
      score: ownershipScore(context, incoming.get(context.node.id)?.length ?? 0, outgoing.get(context.node.id)?.length ?? 0),
    }))
    .sort((left, right) => right.score - left.score || compareEntryContexts(left.context, right.context));
  const owners = ranked.slice(0, MAX_FEATURE_OWNERS).map(({ context, score }) => ({
    nodeId: context.node.id,
    name: context.node.name,
    kind: context.node.type,
    score: round(score),
    evidence: ownerEvidence(context),
  }));
  const ownedNodeIds = ranked
    .map(({ context }) => context.node.id)
    .slice(0, MAX_FEATURE_NODES)
    .sort();

  return {
    id: bucket.id,
    name: bucket.name,
    terms: bucket.terms,
    owners,
    ownedNodeIds,
    omittedNodeCount: Math.max(0, ranked.length - ownedNodeIds.length),
    confidence: averageConfidence(ranked.map(({ context }) => confidenceFor(context, incoming, outgoing))),
    evidence: [
      `${bucket.entries.length} graph node(s) share feature terms: ${bucket.terms.join(", ")}.`,
      ...owners.slice(0, 3).map((owner) => `${owner.name} (${owner.kind}) is an owner candidate with score ${owner.score}.`),
    ],
  };
}

function buildDomainVocabulary(
  index: SemanticIndex,
  featureIdsByNode: ReadonlyMap<string, readonly string[]>,
): readonly DomainVocabulary[] {
  return index.vocabulary
    .filter((term) => !isGenericTerm(term.term))
    .map((term) => {
      const nodeIds = term.nodeIds.slice(0, MAX_NODE_REFERENCES).sort();
      const featureIds = uniqueStrings(nodeIds.flatMap((nodeId) => featureIdsByNode.get(nodeId) ?? [])).slice(0, 20);
      return {
        term: term.term,
        aliases: vocabularyAliases(term.term),
        nodeIds,
        featureIds,
        confidence: round(Math.min(1, 0.35 + Math.log10(term.frequency + 1) / 2)),
      };
    })
    .sort((left, right) => right.nodeIds.length - left.nodeIds.length || left.term.localeCompare(right.term))
    .slice(0, MAX_DOMAIN_TERMS);
}

function buildIntentVocabulary(
  contexts: readonly EntryContext[],
  featureIdsByNode: ReadonlyMap<string, readonly string[]>,
): readonly IntentVocabulary[] {
  const nodesByIntent = new Map<string, Set<string>>();
  const termsByIntent = new Map<string, Set<string>>();

  for (const context of contexts) {
    const intentTerms = uniqueStrings([
      ...context.tokens.filter((token) => INTENT_ANCHORS.has(token)),
      ...context.featureTerms,
    ]).slice(0, 5);
    const phrases = phrasePairs(intentTerms);
    for (const intent of uniqueStrings([...intentTerms, ...phrases])) {
      if (isGenericTerm(intent) || intent.length < 3) {
        continue;
      }
      const nodeIds = nodesByIntent.get(intent) ?? new Set<string>();
      nodeIds.add(context.node.id);
      nodesByIntent.set(intent, nodeIds);
      const terms = termsByIntent.get(intent) ?? new Set<string>();
      for (const term of intentTerms) {
        terms.add(term);
      }
      termsByIntent.set(intent, terms);
    }
  }

  return [...nodesByIntent.entries()]
    .map(([intent, nodeSet]) => {
      const nodeIds = [...nodeSet].sort().slice(0, MAX_NODE_REFERENCES);
      return {
        intent,
        terms: [...(termsByIntent.get(intent) ?? new Set<string>())].sort(),
        nodeIds,
        featureIds: uniqueStrings(nodeIds.flatMap((nodeId) => featureIdsByNode.get(nodeId) ?? [])).slice(0, 20),
        confidence: round(Math.min(1, 0.3 + Math.log10(nodeSet.size + 1) / 2)),
      };
    })
    .sort((left, right) => right.nodeIds.length - left.nodeIds.length || left.intent.localeCompare(right.intent))
    .slice(0, MAX_INTENT_TERMS);
}

function neighborhoodFor(input: {
  readonly context: EntryContext;
  readonly nodeById: ReadonlyMap<string, SoftwareGraphNode>;
  readonly incoming: ReadonlyMap<string, readonly SoftwareGraphEdge[]>;
  readonly outgoing: ReadonlyMap<string, readonly SoftwareGraphEdge[]>;
  readonly featureOwnership: readonly FeatureOwnership[];
  readonly featureIdsByNode: ReadonlyMap<string, readonly string[]>;
  readonly intentIdsByNode: ReadonlyMap<string, readonly string[]>;
  readonly vocabularyIdsByNode: ReadonlyMap<string, readonly string[]>;
}): SemanticNeighborhood {
  const direct = directRelated(input.context.node.id, input.nodeById, input.incoming, input.outgoing);
  const relatedByFeature = relatedBySharedTerms(input.context.node.id, input.featureIdsByNode, "shared feature", input.featureOwnership.flatMap((feature) => feature.ownedNodeIds));
  const relatedByIntent = relatedBySharedTerms(input.context.node.id, input.intentIdsByNode, "shared intent", []);
  const relatedByVocabulary = relatedBySharedTerms(input.context.node.id, input.vocabularyIdsByNode, "shared vocabulary", []);

  return {
    nodeId: input.context.node.id,
    related: direct,
    relatedByFeature,
    relatedByIntent,
    relatedByVocabulary,
    confidence: confidenceFor(input.context, input.incoming, input.outgoing),
  };
}

function buildSemanticGraph(input: {
  readonly featureOwnership: readonly FeatureOwnership[];
  readonly domainVocabulary: readonly DomainVocabulary[];
  readonly intentVocabulary: readonly IntentVocabulary[];
  readonly neighborhoods: readonly SemanticNeighborhood[];
  readonly nodeById: ReadonlyMap<string, SoftwareGraphNode>;
}): GraphifyStyleSemanticGraph {
  const nodes = new Map<string, SemanticGraphNode>();
  const links = new Map<string, SemanticGraphLink>();
  const softwareNodeIds = new Set<string>();

  for (const feature of input.featureOwnership) {
    nodes.set(feature.id, {
      id: feature.id,
      kind: "Feature",
      label: feature.name,
      weight: feature.ownedNodeIds.length,
      featureId: feature.id,
      terms: feature.terms,
    });
    for (const owner of feature.owners) {
      softwareNodeIds.add(owner.nodeId);
      putLink(links, feature.id, `node:${owner.nodeId}`, "OWNS", owner.score, [`${feature.name} owner candidate.`]);
    }
    for (const term of feature.terms) {
      const termId = `term:${term}`;
      nodes.set(termId, { id: termId, kind: "Vocabulary", label: term, weight: 1, terms: [term] });
      putLink(links, feature.id, termId, "HAS_TERM", 1, [`${feature.name} includes term ${term}.`]);
    }
  }

  for (const vocabulary of input.domainVocabulary.slice(0, MAX_DOMAIN_TERMS)) {
    const termId = `term:${vocabulary.term}`;
    nodes.set(termId, {
      id: termId,
      kind: "Vocabulary",
      label: vocabulary.term,
      weight: vocabulary.nodeIds.length,
      terms: [vocabulary.term, ...vocabulary.aliases],
    });
    for (const nodeId of vocabulary.nodeIds.slice(0, 12)) {
      softwareNodeIds.add(nodeId);
      putLink(links, termId, `node:${nodeId}`, "MENTIONS", vocabulary.confidence, [`Vocabulary term ${vocabulary.term} references ${nodeId}.`]);
    }
  }

  for (const intent of input.intentVocabulary.slice(0, MAX_INTENT_TERMS)) {
    const intentId = `intent:${intent.intent}`;
    nodes.set(intentId, {
      id: intentId,
      kind: "Intent",
      label: intent.intent,
      weight: intent.nodeIds.length,
      terms: intent.terms,
    });
    for (const term of intent.terms.slice(0, 8)) {
      const termId = `term:${term}`;
      nodes.set(termId, { id: termId, kind: "Vocabulary", label: term, weight: 1, terms: [term] });
      putLink(links, intentId, termId, "EXPANDS_TO", intent.confidence, [`Intent ${intent.intent} expands to ${term}.`]);
    }
    for (const nodeId of intent.nodeIds.slice(0, 10)) {
      softwareNodeIds.add(nodeId);
      putLink(links, intentId, `node:${nodeId}`, "MENTIONS", intent.confidence, [`Intent ${intent.intent} references ${nodeId}.`]);
    }
  }

  for (const neighborhood of input.neighborhoods.slice(0, MAX_SEMANTIC_GRAPH_SOFTWARE_NODES)) {
    softwareNodeIds.add(neighborhood.nodeId);
    for (const related of neighborhood.relatedByFeature.slice(0, 4)) {
      softwareNodeIds.add(related.nodeId);
      putLink(links, `node:${neighborhood.nodeId}`, `node:${related.nodeId}`, "RELATED_TO", related.score, [related.reason]);
    }
  }

  for (const nodeId of [...softwareNodeIds].sort().slice(0, MAX_SEMANTIC_GRAPH_SOFTWARE_NODES)) {
    const graphNode = input.nodeById.get(nodeId);
    if (!graphNode) {
      continue;
    }
    nodes.set(`node:${nodeId}`, {
      id: `node:${nodeId}`,
      kind: "SoftwareNode",
      label: graphNode.name,
      weight: FEATURE_OWNER_KINDS.get(graphNode.type) ?? 10,
      nodeId,
      terms: [graphNode.type.toLowerCase()],
    });
  }

  const sortedNodes = [...nodes.values()].sort(compareSemanticGraphNodes);
  const sortedLinks = [...links.values()].sort(compareSemanticGraphLinks).slice(0, MAX_SEMANTIC_GRAPH_LINKS);
  return {
    nodes: sortedNodes,
    links: sortedLinks,
    statistics: {
      nodes: sortedNodes.length,
      links: sortedLinks.length,
      features: sortedNodes.filter((node) => node.kind === "Feature").length,
      vocabulary: sortedNodes.filter((node) => node.kind === "Vocabulary").length,
      intents: sortedNodes.filter((node) => node.kind === "Intent").length,
      softwareNodes: sortedNodes.filter((node) => node.kind === "SoftwareNode").length,
    },
  };
}

function entryContext(entry: SemanticIndexEntry, node: SoftwareGraphNode | undefined): EntryContext | undefined {
  if (!node) {
    return undefined;
  }
  const tokens = uniqueStrings([
    ...tokenize(entry.displayName),
    ...entry.keywords,
    ...entry.aliases.flatMap(semanticAliasTokens),
    ...entry.parentChain.flatMap(tokenize),
    ...(entry.filePath ? tokenize(entry.filePath) : []),
  ].filter((term) => !isGenericTerm(term)));
  const featureTerms = selectFeatureTerms(tokens, entry);
  return { entry, node, tokens, featureTerms };
}

function selectFeatureTerms(tokens: readonly string[], entry: SemanticIndexEntry): readonly string[] {
  const preferred = [
    ...tokens.filter((token) => INTENT_ANCHORS.has(token)),
    ...tokens.filter((token) => token.length >= 5),
    ...tokens,
  ];
  const selected = uniqueStrings(preferred)
    .filter((token) => !isGenericTerm(token))
    .slice(0, 3);
  if (selected.length > 0) {
    return selected.sort();
  }
  return tokenize(entry.displayName).filter((token) => !isGenericTerm(token)).slice(0, 2).sort();
}

function directRelated(
  nodeId: string,
  nodeById: ReadonlyMap<string, SoftwareGraphNode>,
  incoming: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
  outgoing: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
): readonly RelatedNode[] {
  const related = new Map<string, RelatedNode>();
  for (const edge of [...(incoming.get(nodeId) ?? []), ...(outgoing.get(nodeId) ?? [])]) {
    const otherId = edge.from === nodeId ? edge.to : edge.from;
    if (!nodeById.has(otherId)) {
      continue;
    }
    const previous = related.get(otherId);
    const score = edgeConfidenceScore(edge);
    if (!previous || previous.score < score) {
      related.set(otherId, { nodeId: otherId, reason: edge.type, score });
    }
  }
  return [...related.values()].sort(compareRelatedNodes).slice(0, MAX_NEIGHBORHOOD_RELATED);
}

function relatedBySharedTerms(
  nodeId: string,
  termsByNode: ReadonlyMap<string, readonly string[]>,
  reasonPrefix: string,
  preferredNodeOrder: readonly string[],
): readonly RelatedNode[] {
  const terms = termsByNode.get(nodeId) ?? [];
  const scores = new Map<string, RelatedNode>();
  const preferred = new Set(preferredNodeOrder);
  for (const [candidateId, candidateTerms] of termsByNode.entries()) {
    if (candidateId === nodeId) {
      continue;
    }
    const overlap = terms.filter((term) => candidateTerms.includes(term));
    if (overlap.length === 0) {
      continue;
    }
    const score = round(Math.min(1, 0.4 + overlap.length / 4 + (preferred.has(candidateId) ? 0.05 : 0)));
    scores.set(candidateId, {
      nodeId: candidateId,
      reason: `${reasonPrefix}: ${overlap.slice(0, 4).join(", ")}`,
      score,
    });
  }
  return [...scores.values()].sort(compareRelatedNodes).slice(0, MAX_NEIGHBORHOOD_RELATED);
}

function featureNodeIndex(features: readonly FeatureOwnership[]): ReadonlyMap<string, readonly string[]> {
  const byNode = new Map<string, string[]>();
  for (const feature of features) {
    for (const nodeId of feature.ownedNodeIds) {
      const values = byNode.get(nodeId) ?? [];
      values.push(feature.id);
      byNode.set(nodeId, values);
    }
  }
  return new Map([...byNode.entries()].map(([nodeId, ids]) => [nodeId, uniqueStrings(ids)]));
}

function nodeTermIndex(items: readonly { readonly id: string; readonly nodeIds: readonly string[] }[]): ReadonlyMap<string, readonly string[]> {
  const byNode = new Map<string, string[]>();
  for (const item of items) {
    for (const nodeId of item.nodeIds) {
      const values = byNode.get(nodeId) ?? [];
      values.push(item.id);
      byNode.set(nodeId, values);
    }
  }
  return new Map([...byNode.entries()].map(([nodeId, ids]) => [nodeId, uniqueStrings(ids)]));
}

function ownershipScore(
  context: EntryContext,
  incoming: number,
  outgoing: number,
): number {
  const kindScore = FEATURE_OWNER_KINDS.get(context.node.type) ?? 20;
  const relationshipScore = Math.min(60, incoming * 4 + outgoing * 3);
  const semanticScore = context.entry.importance + context.entry.usageFrequency;
  return kindScore + relationshipScore + semanticScore;
}

function confidenceFor(
  context: EntryContext,
  incoming: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
  outgoing: ReadonlyMap<string, readonly SoftwareGraphEdge[]>,
): SemanticConfidence {
  const incomingEdges = incoming.get(context.node.id) ?? [];
  const outgoingEdges = outgoing.get(context.node.id) ?? [];
  const degree = incomingEdges.length + outgoingEdges.length;
  const syntax = context.node.span || context.node.file ? 0.9 : 0.65;
  const semantic = Math.min(1, 0.45 + context.entry.aliases.length / 30 + context.entry.keywords.length / 40);
  const feature = Math.min(1, 0.45 + context.featureTerms.length / 4);
  const relationship = Math.min(1, 0.35 + degree / 12);
  return {
    syntax: round(syntax),
    semantic: round(semantic),
    feature: round(feature),
    relationship: round(relationship),
    overall: round((syntax + semantic + feature + relationship) / 4),
  };
}

function averageConfidence(values: readonly SemanticConfidence[]): SemanticConfidence {
  if (values.length === 0) {
    return { syntax: 0, semantic: 0, feature: 0, relationship: 0, overall: 0 };
  }
  return {
    syntax: round(sum(values.map((value) => value.syntax)) / values.length),
    semantic: round(sum(values.map((value) => value.semantic)) / values.length),
    feature: round(sum(values.map((value) => value.feature)) / values.length),
    relationship: round(sum(values.map((value) => value.relationship)) / values.length),
    overall: round(sum(values.map((value) => value.overall)) / values.length),
  };
}

function ownerEvidence(context: EntryContext): readonly string[] {
  return [
    `${context.node.name} is a ${context.node.type}.`,
    `Semantic aliases: ${context.entry.aliases.slice(0, 4).join(", ") || "none"}.`,
    `Feature terms: ${context.featureTerms.join(", ") || "none"}.`,
  ];
}

function vocabularyAliases(term: string): readonly string[] {
  const tokens = tokenize(term);
  return uniqueStrings([
    term,
    tokens.join(""),
    tokens.join("-"),
    tokens.join("_"),
  ].filter((alias) => alias && alias !== term));
}

function phrasePairs(tokens: readonly string[]): readonly string[] {
  const phrases: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];
    if (first && second && first !== second) {
      phrases.push(`${first} ${second}`);
    }
  }
  return uniqueStrings(phrases);
}

function putLink(
  links: Map<string, SemanticGraphLink>,
  from: string,
  to: string,
  type: SemanticGraphLink["type"],
  weight: number,
  evidence: readonly string[],
): void {
  const id = `semantic-link:${stableHash(`${type}|${from}|${to}`)}`;
  const link = { id, type, from, to, weight: round(weight), evidence };
  const current = links.get(id);
  if (!current || current.weight < link.weight) {
    links.set(id, link);
  }
}

function groupEdges(
  edges: readonly SoftwareGraphEdge[],
  side: "from" | "to",
): ReadonlyMap<string, readonly SoftwareGraphEdge[]> {
  const grouped = new Map<string, SoftwareGraphEdge[]>();
  for (const edge of edges) {
    const key = edge[side];
    const values = grouped.get(key) ?? [];
    values.push(edge);
    grouped.set(key, values);
  }
  return new Map([...grouped.entries()].map(([key, values]) => [key, values.sort(compareEdges)]));
}

function edgeConfidenceScore(edge: SoftwareGraphEdge): number {
  const exact = edge.evidence?.some((item) => item.confidence === "exact") ? 0.2 : 0;
  const resolver = edge.evidence?.some((item) => item.kind === "resolver" || item.kind === "semantic") ? 0.15 : 0;
  return round(Math.min(1, 0.65 + exact + resolver));
}

function repositoryReference(graph: SoftwareGraph): SemanticsArtifact["repository"] {
  return {
    name: graph.repository.name,
    root: graph.repository.root,
    ...(graph.repository.packageName ? { packageName: graph.repository.packageName } : {}),
  };
}

function validationIssue(
  code: string,
  severity: EnhancerValidationIssue["severity"],
  message: string,
): EnhancerValidationIssue {
  return {
    code,
    severity,
    message,
    enhancerId: SEMANTICS_ENHANCER_ID,
    artifactId: ARTIFACT_DESCRIPTORS.Semantics.id,
  };
}

function isGenericTerm(term: string): boolean {
  return GENERIC_TERMS.has(term) ||
    term.length < 2 ||
    term.length > 18 ||
    /^\d+$/.test(term) ||
    /\d/.test(term) ||
    term.includes("srcts") ||
    term.includes("srctsx") ||
    /^(class|constructor|fn|method)/.test(term) ||
    /(thrown|throws)$/.test(term) ||
    /(?:src|dist|test|spec)(?:ts|tsx|js|jsx)$/.test(term);
}

function tokenize(value: string): readonly string[] {
  return uniqueStrings(value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean));
}

function semanticAliasTokens(value: string): readonly string[] {
  if (value.length > 40 || /\d/.test(value)) {
    return [];
  }
  const tokens = tokenize(value);
  if (tokens.length <= 1 && value.length > 18) {
    return [];
  }
  return tokens;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isEntryContext(value: EntryContext | undefined): value is EntryContext {
  return Boolean(value);
}

function compareEntryContexts(left: EntryContext, right: EntryContext): number {
  return left.node.id.localeCompare(right.node.id);
}

function compareFeatureBuckets(left: FeatureBucket, right: FeatureBucket): number {
  return left.id.localeCompare(right.id);
}

function compareFeatureOwnership(left: FeatureOwnership, right: FeatureOwnership): number {
  return left.id.localeCompare(right.id);
}

function compareDomainVocabulary(left: DomainVocabulary, right: DomainVocabulary): number {
  return left.term.localeCompare(right.term);
}

function compareIntentVocabulary(left: IntentVocabulary, right: IntentVocabulary): number {
  return left.intent.localeCompare(right.intent);
}

function compareNeighborhoods(left: SemanticNeighborhood, right: SemanticNeighborhood): number {
  return left.nodeId.localeCompare(right.nodeId);
}

function compareRelatedNodes(left: RelatedNode, right: RelatedNode): number {
  return right.score - left.score || left.nodeId.localeCompare(right.nodeId);
}

function compareEdges(left: SoftwareGraphEdge, right: SoftwareGraphEdge): number {
  return left.id.localeCompare(right.id);
}

function compareSemanticGraphNodes(left: SemanticGraphNode, right: SemanticGraphNode): number {
  return left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
}

function compareSemanticGraphLinks(left: SemanticGraphLink, right: SemanticGraphLink): number {
  return left.type.localeCompare(right.type) || left.from.localeCompare(right.from) || left.to.localeCompare(right.to);
}

function compareValidationIssues(left: EnhancerValidationIssue, right: EnhancerValidationIssue): number {
  return left.severity.localeCompare(right.severity) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message);
}
