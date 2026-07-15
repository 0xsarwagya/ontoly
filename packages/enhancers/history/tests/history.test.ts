import { createEdgeId, createSoftwareGraph, stableStringify, type SoftwareGraph } from "@0xsarwagya/ontoly-core";
import { createEnhancerTestHarness } from "@0xsarwagya/ontoly-enhancer";
import { describe, expect, it } from "vitest";
import {
  createHistoryArtifact,
  createHistoryEnhancer,
  parseGitLog,
  validateHistoryArtifact,
  type GitHistoryCommit,
} from "../src/index";

describe("history enhancer", () => {
  it("generates deterministic repository history, ownership, hotspots, cochanges, and drift", () => {
    const graph = historyFixtureGraph();
    const first = createHistoryArtifact(graph, { commits: historyFixtureCommits() });
    const second = createHistoryArtifact(graph, { commits: [...historyFixtureCommits()].reverse() });

    expect(first.deterministicHash).toBe(second.deterministicHash);
    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(first.graphHash).toBe(graph.metadata.deterministicHash);
    expect(first.statistics.commits).toBe(4);
    expect(first.statistics.nodesWithHistory).toBeGreaterThan(0);

    const authService = first.nodes.find((node) => node.nodeId === "svc:AuthService");
    expect(authService?.ownership.owner).toBe("Alice");
    expect(authService?.ownershipConfidence).toBeGreaterThan(60);
    expect(authService?.categoryRatios.bugfix).toBeGreaterThan(0);
    expect(authService?.categoryRatios.refactor).toBeGreaterThan(0);

    expect(first.hotspots.nodes[0]?.nodeId).toBe("svc:AuthService");
    expect(first.ownership.nodes.some((node) => node.nodeId === "svc:AuthService" && node.ownership.owner === "Alice")).toBe(true);
    expect(first.cochanges.relationships.some((relationship) =>
      relationship.leftFile === "src/auth/auth.controller.ts" &&
      relationship.rightFile === "src/auth/auth.service.ts",
    )).toBe(true);
    expect(first.drift.features.some((feature) => feature.name === "Auth" && feature.files.length >= 3)).toBe(true);
    expect(validateHistoryArtifact(first, graph)).toEqual([]);
  });

  it("parses deterministic git log output", () => {
    const commits = parseGitLog([
      "--ONTOLY-COMMIT--abc\u001f2026-01-01T00:00:00.000Z\u001fAlice\u001ffeat: add auth",
      "10\t2\tsrc/auth/auth.service.ts",
      "4\t0\tsrc/auth/auth.controller.ts",
      "--ONTOLY-COMMIT--def\u001f2026-01-02T00:00:00.000Z\u001fBob\u001ffix: patch auth",
      "1\t1\tsrc/auth/auth.service.ts",
    ].join("\n"));

    expect(commits).toEqual([
      {
        hash: "abc",
        authoredAt: "2026-01-01T00:00:00.000Z",
        author: "Alice",
        subject: "feat: add auth",
        changes: [
          { file: "src/auth/auth.controller.ts", additions: 4, deletions: 0 },
          { file: "src/auth/auth.service.ts", additions: 10, deletions: 2 },
        ],
      },
      {
        hash: "def",
        authoredAt: "2026-01-02T00:00:00.000Z",
        author: "Bob",
        subject: "fix: patch auth",
        changes: [
          { file: "src/auth/auth.service.ts", additions: 1, deletions: 1 },
        ],
      },
    ]);
  });

  it("runs as a deterministic enhancer over immutable graph artifacts", async () => {
    const graph = historyFixtureGraph();
    const enhancer = createHistoryEnhancer();
    const harness = createEnhancerTestHarness({
      graph,
      configuration: {
        historyRoot: "/missing-history-root",
      },
    });

    const result = await harness.run([enhancer]);
    expect(result.artifacts
      .filter((artifact) => artifact.provenance.producedBy === "history")
      .map((artifact) => artifact.descriptor.id)
      .sort()).toEqual([
      "Cochanges",
      "Drift",
      "History",
      "Hotspots",
      "Ownership",
    ]);
    expect(result.executions[0]?.statistics).toMatchObject({
      commits: 0,
      nodesWithHistory: 0,
    });
    await expect(harness.assertDeterministic([enhancer])).resolves.toBeUndefined();
  });
});

function historyFixtureGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "history-fixture",
      packageName: "history-fixture",
    },
    fileCount: 4,
    nodes: [
      { id: "workspace:history-fixture", type: "Workspace", name: "history-fixture" },
      { id: "mod:src/auth/auth.module.ts", type: "Module", name: "AuthModule", file: "src/auth/auth.module.ts" },
      { id: "ctl:AuthController", type: "Controller", name: "AuthController", file: "src/auth/auth.controller.ts" },
      { id: "svc:AuthService", type: "Service", name: "AuthService", file: "src/auth/auth.service.ts" },
      { id: "repo:UserRepository", type: "Repository", name: "UserRepository", file: "src/auth/user.repository.ts" },
    ],
    edges: [
      edge("CONTAINS", "workspace:history-fixture", "mod:src/auth/auth.module.ts"),
      edge("CONTAINS", "mod:src/auth/auth.module.ts", "ctl:AuthController"),
      edge("CONTAINS", "mod:src/auth/auth.module.ts", "svc:AuthService"),
      edge("CALLS", "ctl:AuthController", "svc:AuthService"),
      edge("USES", "svc:AuthService", "repo:UserRepository"),
    ],
  });
}

function historyFixtureCommits(): readonly GitHistoryCommit[] {
  return [
    {
      hash: "0001",
      authoredAt: "2025-01-01T00:00:00.000Z",
      author: "Alice",
      subject: "feat: introduce authentication module",
      changes: [
        { file: "src/auth/auth.module.ts", additions: 20, deletions: 0 },
        { file: "src/auth/auth.controller.ts", additions: 50, deletions: 0 },
        { file: "src/auth/auth.service.ts", additions: 80, deletions: 0 },
      ],
    },
    {
      hash: "0002",
      authoredAt: "2025-02-01T00:00:00.000Z",
      author: "Bob",
      subject: "fix: patch authentication session handling",
      changes: [
        { file: "src/auth/auth.service.ts", additions: 12, deletions: 4 },
      ],
    },
    {
      hash: "0003",
      authoredAt: "2026-01-01T00:00:00.000Z",
      author: "Alice",
      subject: "refactor: move auth persistence",
      changes: [
        { file: "src/auth/auth.service.ts", additions: 25, deletions: 20 },
        { file: "src/auth/user.repository.ts", additions: 40, deletions: 2 },
      ],
    },
    {
      hash: "0004",
      authoredAt: "2026-02-01T00:00:00.000Z",
      author: "Alice",
      subject: "feat: support auth ownership report",
      changes: [
        { file: "src/auth/auth.service.ts", additions: 8, deletions: 1 },
        { file: "src/auth/auth.controller.ts", additions: 6, deletions: 2 },
      ],
    },
  ];
}

function edge(type: "CONTAINS" | "USES" | "CALLS", from: string, to: string) {
  return {
    id: createEdgeId(type, from, to),
    type,
    from,
    to,
    evidence: [{ kind: "semantic" as const, confidence: "exact" as const, description: "fixture edge" }],
  };
}
