import { spawnSync } from "node:child_process";
import {
  SOFTWARE_GRAPH_VERSION,
  stableHash,
  stableStringify,
  type JsonObject,
  type JsonValue,
  type NodeType,
  type SoftwareGraph,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import {
  artifactDescriptor,
  createArtifact,
  defineEnhancer,
  type ArtifactDescriptor,
  type Enhancer,
  type EnhancerValidationIssue,
} from "@0xsarwagya/ontoly-enhancer";

export const HISTORY_ARTIFACT_VERSION = "1.0.0";
export const HISTORY_ENHANCER_ID = "history";
export const HISTORY_ENHANCER_VERSION = "1.0.0";

export interface GitHistoryChange {
  readonly file: string;
  readonly additions: number;
  readonly deletions: number;
}

export interface GitHistoryCommit {
  readonly hash: string;
  readonly authoredAt: string;
  readonly author: string;
  readonly subject: string;
  readonly changes: readonly GitHistoryChange[];
}

export type CommitCategory = "bugfix" | "refactor" | "feature" | "other";

export interface CommitReference {
  readonly hash: string;
  readonly authoredAt: string;
  readonly author: string;
  readonly subject: string;
  readonly category: CommitCategory;
}

export interface ContributorStats {
  readonly name: string;
  readonly commits: number;
  readonly churn: number;
  readonly ratio: number;
}

export interface CategoryRatios {
  readonly bugfix: number;
  readonly refactor: number;
  readonly feature: number;
  readonly other: number;
}

export interface OwnershipInfo {
  readonly owner: string | null;
  readonly confidence: number;
  readonly contributors: readonly ContributorStats[];
  readonly busFactor: number;
}

export interface StabilityInfo {
  readonly hotspotScore: number;
  readonly churnScore: number;
  readonly stabilityScore: number;
  readonly classification: "stable" | "watch" | "hotspot";
}

export interface FileHistory {
  readonly file: string;
  readonly firstIntroductionCommit: CommitReference | null;
  readonly lastModification: CommitReference | null;
  readonly modificationCount: number;
  readonly churn: number;
  readonly additions: number;
  readonly deletions: number;
  readonly contributors: readonly ContributorStats[];
  readonly ownership: OwnershipInfo;
  readonly categoryRatios: CategoryRatios;
  readonly stability: StabilityInfo;
}

export interface NodeHistory {
  readonly nodeId: string;
  readonly name: string;
  readonly kind: NodeType;
  readonly file: string | null;
  readonly firstIntroductionCommit: CommitReference | null;
  readonly lastModification: CommitReference | null;
  readonly modificationCount: number;
  readonly contributors: readonly ContributorStats[];
  readonly ownership: OwnershipInfo;
  readonly hotspotScore: number;
  readonly churnScore: number;
  readonly stabilityScore: number;
  readonly ownershipConfidence: number;
  readonly categoryRatios: CategoryRatios;
}

export interface CoChangeRelationship {
  readonly id: string;
  readonly leftFile: string;
  readonly rightFile: string;
  readonly leftNodeIds: readonly string[];
  readonly rightNodeIds: readonly string[];
  readonly count: number;
  readonly score: number;
  readonly categories: CategoryRatios;
  readonly lastCommit: CommitReference | null;
}

export interface DriftTimelinePoint {
  readonly year: string;
  readonly commits: number;
  readonly filesTouched: number;
  readonly filesIntroduced: number;
  readonly churn: number;
}

export interface FeatureDrift {
  readonly id: string;
  readonly name: string;
  readonly files: readonly string[];
  readonly nodeIds: readonly string[];
  readonly timeline: readonly DriftTimelinePoint[];
  readonly currentCoupling: number;
  readonly complexityTrend: "flat" | "increasing";
  readonly couplingTrend: "flat" | "increasing";
  readonly cohesion: "stable" | "decreasing";
  readonly warning: string | null;
}

export interface OwnershipArtifact {
  readonly version: string;
  readonly graphHash: string;
  readonly repository: string;
  readonly nodes: readonly Pick<NodeHistory, "nodeId" | "name" | "kind" | "file" | "ownership" | "ownershipConfidence">[];
  readonly files: readonly Pick<FileHistory, "file" | "ownership">[];
  readonly statistics: {
    readonly ownedNodes: number;
    readonly contributors: number;
    readonly averageConfidence: number;
  };
  readonly deterministicHash: string;
}

export interface HotspotsArtifact {
  readonly version: string;
  readonly graphHash: string;
  readonly repository: string;
  readonly nodes: readonly NodeHistory[];
  readonly files: readonly FileHistory[];
  readonly statistics: {
    readonly hotspots: number;
    readonly highRisk: number;
    readonly averageHotspotScore: number;
  };
  readonly deterministicHash: string;
}

export interface CochangesArtifact {
  readonly version: string;
  readonly graphHash: string;
  readonly repository: string;
  readonly relationships: readonly CoChangeRelationship[];
  readonly statistics: {
    readonly relationships: number;
    readonly maxCount: number;
    readonly omittedLargeCommitPairs: number;
  };
  readonly deterministicHash: string;
}

export interface DriftArtifact {
  readonly version: string;
  readonly graphHash: string;
  readonly repository: string;
  readonly features: readonly FeatureDrift[];
  readonly statistics: {
    readonly features: number;
    readonly warnings: number;
    readonly driftingFeatures: number;
  };
  readonly deterministicHash: string;
}

export interface HistoryArtifact {
  readonly version: string;
  readonly graphVersion: string;
  readonly graphHash: string;
  readonly repository: {
    readonly name: string;
    readonly root: string;
    readonly packageName?: string | undefined;
  };
  readonly commits: {
    readonly total: number;
    readonly first: CommitReference | null;
    readonly last: CommitReference | null;
  };
  readonly nodes: readonly NodeHistory[];
  readonly files: readonly FileHistory[];
  readonly ownership: OwnershipArtifact;
  readonly hotspots: HotspotsArtifact;
  readonly cochanges: CochangesArtifact;
  readonly drift: DriftArtifact;
  readonly statistics: {
    readonly commits: number;
    readonly files: number;
    readonly nodesWithHistory: number;
    readonly contributors: number;
    readonly cochanges: number;
    readonly hotspots: number;
    readonly driftWarnings: number;
    readonly omittedLargeCommitPairs: number;
  };
  readonly deterministicHash: string;
}

export interface CreateHistoryArtifactOptions {
  readonly commits?: readonly GitHistoryCommit[] | undefined;
  readonly repositoryRoot?: string | undefined;
}

interface FileAccumulator {
  readonly file: string;
  readonly commits: CommitReference[];
  readonly contributorCommits: Map<string, number>;
  readonly contributorChurn: Map<string, number>;
  readonly categories: Map<CommitCategory, number>;
  additions: number;
  deletions: number;
}

interface PairAccumulator {
  readonly leftFile: string;
  readonly rightFile: string;
  readonly categories: Map<CommitCategory, number>;
  count: number;
  lastCommit: CommitReference | null;
}

const MAX_COCHANGE_FILES_PER_COMMIT = 80;
const MAX_COCHANGES = 5000;
const MAX_HOTSPOTS = 200;
const GENERIC_PATH_SEGMENTS = new Set([
  "app",
  "apps",
  "common",
  "components",
  "dist",
  "lib",
  "libs",
  "package",
  "packages",
  "shared",
  "src",
  "test",
  "tests",
  "utils",
]);

export const HISTORY_ARTIFACT_DESCRIPTORS = {
  History: historyDescriptor("History", "Repository History", "Deterministic repository temporal intelligence derived from Git history and Software Graph nodes.", "application/vnd.ontoly.history+json"),
  Ownership: historyDescriptor("Ownership", "Repository Ownership", "Deterministic ownership artifact derived from Git history.", "application/vnd.ontoly.ownership+json"),
  Hotspots: historyDescriptor("Hotspots", "Repository Hotspots", "Deterministic hotspot artifact derived from Git churn and modification frequency.", "application/vnd.ontoly.hotspots+json"),
  Cochanges: historyDescriptor("Cochanges", "Repository Co-changes", "Deterministic co-change relationships derived from Git commits.", "application/vnd.ontoly.cochanges+json"),
  Drift: historyDescriptor("Drift", "Architectural Drift", "Deterministic feature drift artifact derived from temporal file and coupling evidence.", "application/vnd.ontoly.drift+json"),
} as const;

export function createHistoryEnhancer(): Enhancer {
  return defineEnhancer({
    id: HISTORY_ENHANCER_ID,
    name: "History",
    description: "Generate deterministic repository history, ownership, hotspots, co-change, and drift artifacts.",
    version: HISTORY_ENHANCER_VERSION,
    produces: [
      HISTORY_ARTIFACT_DESCRIPTORS.History,
      HISTORY_ARTIFACT_DESCRIPTORS.Ownership,
      HISTORY_ARTIFACT_DESCRIPTORS.Hotspots,
      HISTORY_ARTIFACT_DESCRIPTORS.Cochanges,
      HISTORY_ARTIFACT_DESCRIPTORS.Drift,
    ],
    supportsIncremental: true,
    run: (context) => {
      const graphArtifact = context.artifacts.require("SoftwareGraph");
      const history = createHistoryArtifact(context.graph, {
        repositoryRoot: typeof context.configuration.historyRoot === "string"
          ? context.configuration.historyRoot
          : context.graph.repository.root,
      });
      const base = {
        graphHash: context.graph.metadata.deterministicHash,
        graphGeneratedAt: context.graph.metadata.generatedAt,
        producedBy: HISTORY_ENHANCER_ID,
        enhancerVersion: HISTORY_ENHANCER_VERSION,
        dependencies: [graphArtifact],
      };

      return {
        artifacts: [
          createArtifact({
            descriptor: HISTORY_ARTIFACT_DESCRIPTORS.History,
            data: history as unknown as JsonValue,
            ...base,
          }),
          createArtifact({
            descriptor: HISTORY_ARTIFACT_DESCRIPTORS.Ownership,
            data: history.ownership as unknown as JsonValue,
            ...base,
          }),
          createArtifact({
            descriptor: HISTORY_ARTIFACT_DESCRIPTORS.Hotspots,
            data: history.hotspots as unknown as JsonValue,
            ...base,
          }),
          createArtifact({
            descriptor: HISTORY_ARTIFACT_DESCRIPTORS.Cochanges,
            data: history.cochanges as unknown as JsonValue,
            ...base,
          }),
          createArtifact({
            descriptor: HISTORY_ARTIFACT_DESCRIPTORS.Drift,
            data: history.drift as unknown as JsonValue,
            ...base,
          }),
        ],
        statistics: history.statistics as unknown as JsonObject,
      };
    },
    validate: (context) => validateHistoryGraph(context.graph),
    cacheKey: (context) =>
      stableHash(stableStringify({
        enhancer: HISTORY_ENHANCER_ID,
        version: HISTORY_ENHANCER_VERSION,
        graphHash: context.graph.metadata.deterministicHash,
        root: context.graph.repository.root,
      })),
  });
}

export function createHistoryArtifact(
  graph: SoftwareGraph,
  options: CreateHistoryArtifactOptions = {},
): HistoryArtifact {
  const commits = normalizeCommits(options.commits ?? collectGitHistory(options.repositoryRoot ?? graph.repository.root));
  const references = commits.map(commitReference);
  const fileAccumulators = accumulateFiles(commits);
  const fileHistories = createFileHistories(fileAccumulators);
  const fileHistoryByFile = new Map(fileHistories.map((history) => [history.file, history] as const));
  const nodesByFile = groupNodesByFile(graph.nodes);
  const nodeHistories = graph.nodes
    .filter((node) => Boolean(node.file))
    .map((node) => createNodeHistory(node, fileHistoryByFile.get(normalizePath(node.file ?? ""))))
    .sort(compareNodeHistory);
  const pairState = accumulateCochanges(commits);
  const cochanges = createCochangeRelationships(pairState.pairs, nodesByFile);
  const ownership = createOwnershipArtifact(graph, nodeHistories, fileHistories);
  const hotspots = createHotspotsArtifact(graph, nodeHistories, fileHistories);
  const cochangesArtifact = createCochangesArtifact(graph, cochanges, pairState.omittedLargeCommitPairs);
  const drift = createDriftArtifact(graph, fileHistories, nodesByFile, commits);
  const contributors = uniqueStrings(commits.map((commit) => commit.author));
  const historyWithoutHash = {
    version: HISTORY_ARTIFACT_VERSION,
    graphVersion: graph.version,
    graphHash: graph.metadata.deterministicHash,
    repository: {
      name: graph.repository.name,
      root: graph.repository.root,
      ...(graph.repository.packageName ? { packageName: graph.repository.packageName } : {}),
    },
    commits: {
      total: commits.length,
      first: references[0] ?? null,
      last: references.at(-1) ?? null,
    },
    nodes: nodeHistories,
    files: fileHistories,
    ownership,
    hotspots,
    cochanges: cochangesArtifact,
    drift,
    statistics: {
      commits: commits.length,
      files: fileHistories.length,
      nodesWithHistory: nodeHistories.filter((node) => node.modificationCount > 0).length,
      contributors: contributors.length,
      cochanges: cochanges.length,
      hotspots: hotspots.nodes.length,
      driftWarnings: drift.statistics.warnings,
      omittedLargeCommitPairs: pairState.omittedLargeCommitPairs,
    },
  };

  return {
    ...historyWithoutHash,
    deterministicHash: stableHash(stableStringify(historyWithoutHash)),
  };
}

export function collectGitHistory(root: string): readonly GitHistoryCommit[] {
  const result = spawnSync("git", [
    "log",
    "--reverse",
    "--date=iso-strict",
    "--numstat",
    "--format=--ONTOLY-COMMIT--%H%x1f%aI%x1f%an%x1f%s",
    "--",
    ".",
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  return parseGitLog(result.stdout);
}

export function parseGitLog(output: string): readonly GitHistoryCommit[] {
  const commits: GitHistoryCommit[] = [];
  let current: {
    hash: string;
    authoredAt: string;
    author: string;
    subject: string;
    changes: GitHistoryChange[];
  } | undefined;

  const pushCurrent = (): void => {
    if (!current) return;
    commits.push({
      hash: current.hash,
      authoredAt: current.authoredAt,
      author: current.author,
      subject: current.subject,
      changes: uniqueChanges(current.changes),
    });
  };

  for (const rawLine of output.replace(/\r\n/g, "\n").split("\n")) {
    if (rawLine.startsWith("--ONTOLY-COMMIT--")) {
      pushCurrent();
      const [hash = "", authoredAt = "", author = "", subject = ""] = rawLine
        .slice("--ONTOLY-COMMIT--".length)
        .split("\u001f");
      current = {
        hash,
        authoredAt,
        author: author.trim() || "unknown",
        subject: subject.trim(),
        changes: [],
      };
      continue;
    }

    if (!current || rawLine.trim() === "") {
      continue;
    }

    const [rawAdditions, rawDeletions, ...fileParts] = rawLine.split("\t");
    const file = normalizeGitChangePath(fileParts.join("\t"));
    if (!file) {
      continue;
    }
    current.changes.push({
      file,
      additions: parseGitNumber(rawAdditions),
      deletions: parseGitNumber(rawDeletions),
    });
  }

  pushCurrent();
  return normalizeCommits(commits);
}

export function validateHistoryArtifact(
  artifact: HistoryArtifact,
  graph: SoftwareGraph,
): readonly EnhancerValidationIssue[] {
  const issues: EnhancerValidationIssue[] = [];
  if (artifact.version !== HISTORY_ARTIFACT_VERSION) {
    issues.push({
      code: "HISTORY_VERSION_MISMATCH",
      severity: "error",
      message: `History artifact version ${artifact.version} is not supported.`,
      artifactId: "History",
    });
  }
  if (artifact.graphHash !== graph.metadata.deterministicHash) {
    issues.push({
      code: "HISTORY_GRAPH_HASH_MISMATCH",
      severity: "error",
      message: "History artifact was generated for a different Software Graph hash.",
      artifactId: "History",
    });
  }
  return issues.sort(compareIssues);
}

function historyDescriptor(id: string, name: string, description: string, mediaType: string): ArtifactDescriptor {
  return artifactDescriptor({
    id,
    kind: "Custom",
    name,
    version: HISTORY_ARTIFACT_VERSION,
    description,
    mediaType,
  });
}

function normalizeCommits(commits: readonly GitHistoryCommit[]): readonly GitHistoryCommit[] {
  return commits
    .filter((commit) => commit.hash && commit.authoredAt)
    .map((commit) => ({
      hash: commit.hash,
      authoredAt: commit.authoredAt,
      author: commit.author.trim() || "unknown",
      subject: commit.subject.trim(),
      changes: uniqueChanges(commit.changes),
    }))
    .sort((left, right) =>
      left.authoredAt.localeCompare(right.authoredAt) ||
      left.hash.localeCompare(right.hash),
    );
}

function uniqueChanges(changes: readonly GitHistoryChange[]): readonly GitHistoryChange[] {
  const byFile = new Map<string, GitHistoryChange>();
  for (const change of changes) {
    const file = normalizePath(change.file);
    const current = byFile.get(file);
    byFile.set(file, {
      file,
      additions: (current?.additions ?? 0) + Math.max(0, change.additions),
      deletions: (current?.deletions ?? 0) + Math.max(0, change.deletions),
    });
  }
  return [...byFile.values()].sort((left, right) => left.file.localeCompare(right.file));
}

function accumulateFiles(commits: readonly GitHistoryCommit[]): readonly FileAccumulator[] {
  const byFile = new Map<string, FileAccumulator>();
  for (const commit of commits) {
    const reference = commitReference(commit);
    const category = reference.category;
    for (const change of commit.changes) {
      const file = normalizePath(change.file);
      const current = byFile.get(file) ?? createFileAccumulator(file);
      current.commits.push(reference);
      current.additions += change.additions;
      current.deletions += change.deletions;
      incrementMap(current.contributorCommits, reference.author, 1);
      incrementMap(current.contributorChurn, reference.author, change.additions + change.deletions);
      incrementMap(current.categories, category, 1);
      byFile.set(file, current);
    }
  }
  return [...byFile.values()].sort((left, right) => left.file.localeCompare(right.file));
}

function createFileHistories(accumulators: readonly FileAccumulator[]): readonly FileHistory[] {
  const maxModificationCount = Math.max(1, ...accumulators.map((item) => item.commits.length));
  const maxChurn = Math.max(1, ...accumulators.map((item) => item.additions + item.deletions));
  const latestTime = Math.max(0, ...accumulators.flatMap((item) => item.commits.map((commit) => Date.parse(commit.authoredAt) || 0)));
  const earliestTime = Math.min(...accumulators.flatMap((item) => item.commits.map((commit) => Date.parse(commit.authoredAt) || latestTime)));
  const historyWindowDays = Math.max(1, (latestTime - earliestTime) / 86_400_000);

  return accumulators.map((accumulator) => {
    const commits = accumulator.commits.sort(compareCommitReferences);
    const contributors = contributorStats(accumulator.contributorCommits, accumulator.contributorChurn, commits.length);
    const ownership = ownershipInfo(contributors, commits.length);
    const churn = accumulator.additions + accumulator.deletions;
    const lastTime = Date.parse(commits.at(-1)?.authoredAt ?? "") || latestTime;
    const ageDays = Math.max(0, (latestTime - lastTime) / 86_400_000);
    const recencyScore = Math.max(0, 1 - ageDays / historyWindowDays) * 10;
    const hotspotScore = round(
      commits.length / maxModificationCount * 45 +
      churn / maxChurn * 35 +
      Math.min(contributors.length, 5) / 5 * 10 +
      recencyScore,
    );
    const churnScore = round(churn / maxChurn * 100);
    const stabilityScore = round(Math.max(0, 100 - hotspotScore));
    const classification: StabilityInfo["classification"] = hotspotScore >= 70 ? "hotspot" : hotspotScore >= 40 ? "watch" : "stable";

    return {
      file: accumulator.file,
      firstIntroductionCommit: commits[0] ?? null,
      lastModification: commits.at(-1) ?? null,
      modificationCount: commits.length,
      churn,
      additions: accumulator.additions,
      deletions: accumulator.deletions,
      contributors,
      ownership,
      categoryRatios: categoryRatios(accumulator.categories, commits.length),
      stability: {
        hotspotScore,
        churnScore,
        stabilityScore,
        classification,
      },
    };
  }).sort(compareFileHistory);
}

function createNodeHistory(node: SoftwareGraphNode, fileHistory: FileHistory | undefined): NodeHistory {
  const emptyOwnership: OwnershipInfo = {
    owner: null,
    confidence: 0,
    contributors: [],
    busFactor: 0,
  };
  const emptyRatios: CategoryRatios = {
    bugfix: 0,
    refactor: 0,
    feature: 0,
    other: 0,
  };

  return {
    nodeId: node.id,
    name: node.name,
    kind: node.type,
    file: node.file ? normalizePath(node.file) : null,
    firstIntroductionCommit: fileHistory?.firstIntroductionCommit ?? null,
    lastModification: fileHistory?.lastModification ?? null,
    modificationCount: fileHistory?.modificationCount ?? 0,
    contributors: fileHistory?.contributors ?? [],
    ownership: fileHistory?.ownership ?? emptyOwnership,
    hotspotScore: fileHistory?.stability.hotspotScore ?? 0,
    churnScore: fileHistory?.stability.churnScore ?? 0,
    stabilityScore: fileHistory?.stability.stabilityScore ?? 100,
    ownershipConfidence: fileHistory?.ownership.confidence ?? 0,
    categoryRatios: fileHistory?.categoryRatios ?? emptyRatios,
  };
}

function accumulateCochanges(commits: readonly GitHistoryCommit[]): {
  readonly pairs: readonly PairAccumulator[];
  readonly omittedLargeCommitPairs: number;
} {
  const pairs = new Map<string, PairAccumulator>();
  let omittedLargeCommitPairs = 0;

  for (const commit of commits) {
    const files = uniqueStrings(commit.changes.map((change) => normalizePath(change.file)));
    if (files.length > MAX_COCHANGE_FILES_PER_COMMIT) {
      omittedLargeCommitPairs += (files.length * (files.length - 1)) / 2;
      continue;
    }
    const reference = commitReference(commit);
    for (let leftIndex = 0; leftIndex < files.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < files.length; rightIndex += 1) {
        const leftFile = files[leftIndex]!;
        const rightFile = files[rightIndex]!;
        const key = `${leftFile}\u0000${rightFile}`;
        const current = pairs.get(key) ?? {
          leftFile,
          rightFile,
          categories: new Map<CommitCategory, number>(),
          count: 0,
          lastCommit: null,
        };
        current.count += 1;
        current.lastCommit = reference;
        incrementMap(current.categories, reference.category, 1);
        pairs.set(key, current);
      }
    }
  }

  return {
    pairs: [...pairs.values()].sort((left, right) =>
      right.count - left.count ||
      left.leftFile.localeCompare(right.leftFile) ||
      left.rightFile.localeCompare(right.rightFile),
    ),
    omittedLargeCommitPairs,
  };
}

function createCochangeRelationships(
  pairs: readonly PairAccumulator[],
  nodesByFile: ReadonlyMap<string, readonly SoftwareGraphNode[]>,
): readonly CoChangeRelationship[] {
  const maxCount = Math.max(1, ...pairs.map((pair) => pair.count));
  return pairs
    .map((pair) => ({
      id: `cochange:${stableHash(`${pair.leftFile}|${pair.rightFile}`)}`,
      leftFile: pair.leftFile,
      rightFile: pair.rightFile,
      leftNodeIds: (nodesByFile.get(pair.leftFile) ?? []).map((node) => node.id).sort(),
      rightNodeIds: (nodesByFile.get(pair.rightFile) ?? []).map((node) => node.id).sort(),
      count: pair.count,
      score: round(pair.count / maxCount * 100),
      categories: categoryRatios(pair.categories, pair.count),
      lastCommit: pair.lastCommit,
    }))
    .filter((pair) => pair.leftNodeIds.length > 0 || pair.rightNodeIds.length > 0)
    .sort(compareCochangeRelationship)
    .slice(0, MAX_COCHANGES);
}

function createOwnershipArtifact(
  graph: SoftwareGraph,
  nodes: readonly NodeHistory[],
  files: readonly FileHistory[],
): OwnershipArtifact {
  const ownershipNodes = nodes
    .map((node) => ({
      nodeId: node.nodeId,
      name: node.name,
      kind: node.kind,
      file: node.file,
      ownership: node.ownership,
      ownershipConfidence: node.ownershipConfidence,
    }))
    .sort((left, right) => right.ownershipConfidence - left.ownershipConfidence || left.nodeId.localeCompare(right.nodeId));
  const ownershipFiles = files
    .map((file) => ({
      file: file.file,
      ownership: file.ownership,
    }))
    .sort((left, right) => (right.ownership.confidence ?? 0) - (left.ownership.confidence ?? 0) || left.file.localeCompare(right.file));
  const artifact = {
    version: HISTORY_ARTIFACT_VERSION,
    graphHash: graph.metadata.deterministicHash,
    repository: graph.repository.name,
    nodes: ownershipNodes,
    files: ownershipFiles,
    statistics: {
      ownedNodes: ownershipNodes.filter((node) => node.ownership.owner).length,
      contributors: uniqueStrings(files.flatMap((file) => file.contributors.map((contributor) => contributor.name))).length,
      averageConfidence: round(average(ownershipNodes.map((node) => node.ownershipConfidence))),
    },
  };
  return {
    ...artifact,
    deterministicHash: stableHash(stableStringify(artifact)),
  };
}

function createHotspotsArtifact(
  graph: SoftwareGraph,
  nodes: readonly NodeHistory[],
  files: readonly FileHistory[],
): HotspotsArtifact {
  const hotNodes = [...nodes].sort(compareHotspotNodes).slice(0, MAX_HOTSPOTS);
  const hotFiles = [...files].sort(compareHotspotFiles).slice(0, MAX_HOTSPOTS);
  const artifact = {
    version: HISTORY_ARTIFACT_VERSION,
    graphHash: graph.metadata.deterministicHash,
    repository: graph.repository.name,
    nodes: hotNodes,
    files: hotFiles,
    statistics: {
      hotspots: hotNodes.length,
      highRisk: hotNodes.filter((node) => node.hotspotScore >= 70).length,
      averageHotspotScore: round(average(hotNodes.map((node) => node.hotspotScore))),
    },
  };
  return {
    ...artifact,
    deterministicHash: stableHash(stableStringify(artifact)),
  };
}

function createCochangesArtifact(
  graph: SoftwareGraph,
  relationships: readonly CoChangeRelationship[],
  omittedLargeCommitPairs: number,
): CochangesArtifact {
  const artifact = {
    version: HISTORY_ARTIFACT_VERSION,
    graphHash: graph.metadata.deterministicHash,
    repository: graph.repository.name,
    relationships,
    statistics: {
      relationships: relationships.length,
      maxCount: Math.max(0, ...relationships.map((relationship) => relationship.count)),
      omittedLargeCommitPairs,
    },
  };
  return {
    ...artifact,
    deterministicHash: stableHash(stableStringify(artifact)),
  };
}

function createDriftArtifact(
  graph: SoftwareGraph,
  fileHistories: readonly FileHistory[],
  nodesByFile: ReadonlyMap<string, readonly SoftwareGraphNode[]>,
  commits: readonly GitHistoryCommit[],
): DriftArtifact {
  const edgeDegreeByNode = graphEdgeDegrees(graph);
  const features = new Map<string, {
    id: string;
    name: string;
    files: Set<string>;
    nodeIds: Set<string>;
    years: Map<string, {
      commits: Set<string>;
      filesTouched: Set<string>;
      filesIntroduced: Set<string>;
      churn: number;
    }>;
  }>();
  const firstFileCommit = new Map<string, string>();
  for (const file of fileHistories) {
    if (file.firstIntroductionCommit) {
      firstFileCommit.set(file.file, file.firstIntroductionCommit.hash);
    }
  }

  for (const commit of commits) {
    const year = commit.authoredAt.slice(0, 4);
    for (const change of commit.changes) {
      const file = normalizePath(change.file);
      const bucket = featureBucket(features, file);
      bucket.files.add(file);
      for (const node of nodesByFile.get(file) ?? []) {
        bucket.nodeIds.add(node.id);
      }
      const timeline = bucket.years.get(year) ?? {
        commits: new Set<string>(),
        filesTouched: new Set<string>(),
        filesIntroduced: new Set<string>(),
        churn: 0,
      };
      timeline.commits.add(commit.hash);
      timeline.filesTouched.add(file);
      if (firstFileCommit.get(file) === commit.hash) {
        timeline.filesIntroduced.add(file);
      }
      timeline.churn += change.additions + change.deletions;
      bucket.years.set(year, timeline);
    }
  }

  const featureDrift = [...features.values()].map((feature) => {
    const files = [...feature.files].sort();
    const nodeIds = [...feature.nodeIds].sort();
    const timeline = [...feature.years.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([year, item]) => ({
        year,
        commits: item.commits.size,
        filesTouched: item.filesTouched.size,
        filesIntroduced: item.filesIntroduced.size,
        churn: item.churn,
      }));
    const currentCoupling = nodeIds.reduce((total, nodeId) => total + (edgeDegreeByNode.get(nodeId) ?? 0), 0);
    const first = timeline[0];
    const last = timeline.at(-1);
    const complexityTrend: FeatureDrift["complexityTrend"] = first && last && last.filesTouched > Math.max(first.filesTouched, 1) * 1.5 ? "increasing" : "flat";
    const couplingTrend: FeatureDrift["couplingTrend"] = currentCoupling > Math.max(12, nodeIds.length * 4) ? "increasing" : "flat";
    const cohesion: FeatureDrift["cohesion"] = files.length > 12 && currentCoupling > files.length * 2 ? "decreasing" : "stable";

    return {
      id: feature.id,
      name: feature.name,
      files,
      nodeIds,
      timeline,
      currentCoupling,
      complexityTrend,
      couplingTrend,
      cohesion,
      warning: cohesion === "decreasing" ? "Feature cohesion decreasing." : null,
    };
  }).sort(compareFeatureDrift);
  const artifact = {
    version: HISTORY_ARTIFACT_VERSION,
    graphHash: graph.metadata.deterministicHash,
    repository: graph.repository.name,
    features: featureDrift,
    statistics: {
      features: featureDrift.length,
      warnings: featureDrift.filter((feature) => feature.warning).length,
      driftingFeatures: featureDrift.filter((feature) => feature.cohesion === "decreasing").length,
    },
  };

  return {
    ...artifact,
    deterministicHash: stableHash(stableStringify(artifact)),
  };
}

function validateHistoryGraph(graph: SoftwareGraph): readonly EnhancerValidationIssue[] {
  const issues: EnhancerValidationIssue[] = [];
  if (graph.version !== SOFTWARE_GRAPH_VERSION) {
    issues.push({
      code: "HISTORY_GRAPH_VERSION",
      severity: "error",
      message: `History enhancer supports Software Graph ${SOFTWARE_GRAPH_VERSION}; received ${graph.version}.`,
      enhancerId: HISTORY_ENHANCER_ID,
    });
  }
  return issues;
}

function commitReference(commit: GitHistoryCommit): CommitReference {
  return {
    hash: commit.hash,
    authoredAt: commit.authoredAt,
    author: commit.author,
    subject: commit.subject,
    category: categorizeCommit(commit.subject),
  };
}

function categorizeCommit(subject: string): CommitCategory {
  const text = subject.toLowerCase();
  if (/\b(fix|bug|hotfix|patch|regression)\b/.test(text)) return "bugfix";
  if (/\b(refactor|cleanup|clean|rename|move|simplify)\b/.test(text)) return "refactor";
  if (/\b(feat|feature|add|implement|introduce|support)\b/.test(text)) return "feature";
  return "other";
}

function createFileAccumulator(file: string): FileAccumulator {
  return {
    file,
    commits: [],
    contributorCommits: new Map(),
    contributorChurn: new Map(),
    categories: new Map(),
    additions: 0,
    deletions: 0,
  };
}

function contributorStats(
  commits: ReadonlyMap<string, number>,
  churn: ReadonlyMap<string, number>,
  totalCommits: number,
): readonly ContributorStats[] {
  return [...commits.entries()]
    .map(([name, count]) => ({
      name,
      commits: count,
      churn: churn.get(name) ?? 0,
      ratio: totalCommits > 0 ? round(count / totalCommits) : 0,
    }))
    .sort((left, right) =>
      right.commits - left.commits ||
      right.churn - left.churn ||
      left.name.localeCompare(right.name),
    );
}

function ownershipInfo(contributors: readonly ContributorStats[], totalCommits: number): OwnershipInfo {
  if (contributors.length === 0 || totalCommits === 0) {
    return {
      owner: null,
      confidence: 0,
      contributors: [],
      busFactor: 0,
    };
  }
  let cumulative = 0;
  let busFactor = 0;
  for (const contributor of contributors) {
    cumulative += contributor.commits;
    busFactor += 1;
    if (cumulative / totalCommits >= 0.5) {
      break;
    }
  }
  return {
    owner: contributors[0]?.name ?? null,
    confidence: round((contributors[0]?.commits ?? 0) / totalCommits * 100),
    contributors,
    busFactor,
  };
}

function categoryRatios(categories: ReadonlyMap<CommitCategory, number>, total: number): CategoryRatios {
  if (total <= 0) {
    return {
      bugfix: 0,
      refactor: 0,
      feature: 0,
      other: 0,
    };
  }
  return {
    bugfix: round((categories.get("bugfix") ?? 0) / total),
    refactor: round((categories.get("refactor") ?? 0) / total),
    feature: round((categories.get("feature") ?? 0) / total),
    other: round((categories.get("other") ?? 0) / total),
  };
}

function groupNodesByFile(nodes: readonly SoftwareGraphNode[]): ReadonlyMap<string, readonly SoftwareGraphNode[]> {
  const byFile = new Map<string, SoftwareGraphNode[]>();
  for (const node of nodes) {
    if (!node.file) {
      continue;
    }
    const file = normalizePath(node.file);
    const current = byFile.get(file) ?? [];
    current.push(node);
    byFile.set(file, current);
  }
  return new Map([...byFile.entries()].map(([file, fileNodes]) => [file, fileNodes.sort((left, right) => left.id.localeCompare(right.id))]));
}

function graphEdgeDegrees(graph: SoftwareGraph): ReadonlyMap<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of graph.edges) {
    incrementMap(degrees, edge.from, 1);
    incrementMap(degrees, edge.to, 1);
  }
  return degrees;
}

function featureBucket(
  features: Map<string, {
    id: string;
    name: string;
    files: Set<string>;
    nodeIds: Set<string>;
    years: Map<string, {
      commits: Set<string>;
      filesTouched: Set<string>;
      filesIntroduced: Set<string>;
      churn: number;
    }>;
  }>,
  file: string,
) {
  const terms = featureTermsFromFile(file);
  const id = `feature:${terms.join("-") || "repository"}`;
  const current = features.get(id) ?? {
    id,
    name: titleCase(terms.join(" ") || "Repository"),
    files: new Set<string>(),
    nodeIds: new Set<string>(),
    years: new Map(),
  };
  features.set(id, current);
  return current;
}

function featureTermsFromFile(file: string): readonly string[] {
  const segmentTerms = normalizePath(file)
    .split("/")
    .map((part) => part.replace(/\.[^.]+$/, ""))
    .map((part) =>
      part
        .split(/[-_.]+/g)
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length > 1)
        .filter((term) => !GENERIC_PATH_SEGMENTS.has(term)),
    )
    .filter((terms) => terms.length > 0);
  return segmentTerms[0]?.slice(0, 1) ?? ["repository"];
}

function normalizeGitChangePath(value: string): string {
  const normalized = normalizePath(value.trim());
  if (!normalized.includes(" => ")) {
    return stripRenameBraces(normalized);
  }
  const afterArrow = normalized.split(" => ").at(-1) ?? normalized;
  return stripRenameBraces(afterArrow);
}

function stripRenameBraces(value: string): string {
  return value.replace(/[{}]/g, "").replace(/^"+|"+$/g, "");
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
}

function parseGitNumber(value: string | undefined): number {
  if (!value || value === "-") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function incrementMap<K>(map: Map<K, number>, key: K, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compareCommitReferences(left: CommitReference, right: CommitReference): number {
  return left.authoredAt.localeCompare(right.authoredAt) || left.hash.localeCompare(right.hash);
}

function compareNodeHistory(left: NodeHistory, right: NodeHistory): number {
  return left.nodeId.localeCompare(right.nodeId);
}

function compareFileHistory(left: FileHistory, right: FileHistory): number {
  return left.file.localeCompare(right.file);
}

function compareHotspotNodes(left: NodeHistory, right: NodeHistory): number {
  return right.hotspotScore - left.hotspotScore ||
    right.modificationCount - left.modificationCount ||
    left.nodeId.localeCompare(right.nodeId);
}

function compareHotspotFiles(left: FileHistory, right: FileHistory): number {
  return right.stability.hotspotScore - left.stability.hotspotScore ||
    right.modificationCount - left.modificationCount ||
    left.file.localeCompare(right.file);
}

function compareCochangeRelationship(left: CoChangeRelationship, right: CoChangeRelationship): number {
  return right.count - left.count ||
    right.score - left.score ||
    left.leftFile.localeCompare(right.leftFile) ||
    left.rightFile.localeCompare(right.rightFile);
}

function compareFeatureDrift(left: FeatureDrift, right: FeatureDrift): number {
  const leftWarning = left.warning ? 1 : 0;
  const rightWarning = right.warning ? 1 : 0;
  return rightWarning - leftWarning ||
    right.currentCoupling - left.currentCoupling ||
    left.id.localeCompare(right.id);
}

function compareIssues(left: EnhancerValidationIssue, right: EnhancerValidationIssue): number {
  return left.code.localeCompare(right.code) || left.message.localeCompare(right.message);
}
