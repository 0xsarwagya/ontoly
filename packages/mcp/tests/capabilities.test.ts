import { describe, expect, it } from "vitest";
import { createEdgeId, createSoftwareGraph } from "@0xsarwagya/ontoly-core";
import { createHistoryArtifact } from "@0xsarwagya/ontoly-enhancer-history";
import { createMcpRuntime } from "../src/index";

describe("MCP semantic capabilities", () => {
  it("advertises high-level Semantic Capability Engine capabilities", () => {
    const runtime = createMcpRuntime(graph());
    const names = runtime.capabilities.map((capability) => capability.name);

    expect(names).toEqual(expect.arrayContaining([
      "ArchitectureSummary",
      "FeatureOwnership",
      "ImplementationPlan",
      "ImpactAnalysis",
      "IntentExpansion",
      "History",
      "Hotspots",
      "RepositoryHealth",
      "RequestTrace",
      "SemanticContext",
      "SemanticNeighborhood",
      "Ownership",
      "Cochanges",
      "Stability",
    ]));
  });

  it("executes semantic capability results through the shared schema", () => {
    const runtime = createMcpRuntime(graph());
    const response = runtime.execute({
      capability: "ImpactAnalysis",
      input: { id: "service:AuthService", depth: 4 },
    });

    expect(response.result).toMatchObject({
      summary: expect.stringContaining("AuthService"),
      affectedNodes: {
        Services: [expect.objectContaining({ id: "service:AuthService" })],
      },
      confidence: expect.objectContaining({ level: "high" }),
      graph: expect.objectContaining({ source: "Ontoly Software Graph" }),
    });
    expect(response.provenance.source).toBe("Ontoly Software Graph");
    expect(response.confidence.level).toBe("high");
  });

  it("executes semantic intelligence capabilities from derived graph artifacts", () => {
    const runtime = createMcpRuntime(graph());

    expect(runtime.execute({
      capability: "IntentExpansion",
      input: { query: "login authentication jwt" },
    }).result).toMatchObject({
      expandedTerms: expect.arrayContaining(["authentication", "jwt", "login"]),
      candidates: expect.arrayContaining([
        expect.objectContaining({ name: "AuthService" }),
      ]),
    });
    expect(runtime.execute({
      capability: "FeatureOwnership",
      input: { query: "authentication" },
    }).result).toMatchObject({
      features: expect.any(Array),
    });
    expect(runtime.execute({
      capability: "SemanticNeighborhood",
      input: { query: "AuthService" },
    }).result).toMatchObject({
      status: "PASS",
      node: expect.objectContaining({ name: "AuthService" }),
    });
    expect(runtime.execute({
      capability: "SemanticContext",
      input: { query: "JWT secret authentication" },
    }).result).toMatchObject({
      status: expect.stringMatching(/PASS|PARTIAL/),
      expansion: expect.any(Object),
      evidence: expect.any(Object),
    });
  });

  it("executes temporal intelligence capabilities from history artifacts", () => {
    const repositoryGraph = graph();
    const runtime = createMcpRuntime(repositoryGraph, {
      history: createHistoryArtifact(repositoryGraph, {
        commits: [
          {
            hash: "0001",
            authoredAt: "2026-01-01T00:00:00.000Z",
            author: "Alice",
            subject: "feat: add authentication",
            changes: [
              { file: "src/auth.service.ts", additions: 60, deletions: 0 },
              { file: "src/auth.controller.ts", additions: 25, deletions: 0 },
            ],
          },
          {
            hash: "0002",
            authoredAt: "2026-02-01T00:00:00.000Z",
            author: "Bob",
            subject: "fix: patch authentication",
            changes: [
              { file: "src/auth.service.ts", additions: 4, deletions: 2 },
            ],
          },
        ],
      }),
    });

    expect(runtime.execute({
      capability: "History",
      input: { query: "AuthService" },
    }).result).toMatchObject({
      status: "PASS",
      history: expect.objectContaining({
        name: "AuthService",
        modificationCount: 2,
      }),
    });
    expect(runtime.execute({
      capability: "Ownership",
      input: { query: "AuthService" },
    }).result).toMatchObject({
      ownership: expect.objectContaining({ owner: "Alice" }),
    });
    expect(runtime.execute({
      capability: "Hotspots",
      input: { limit: 2 },
    }).result).toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ name: "AuthService" }),
      ]),
    });
    expect(runtime.execute({
      capability: "Cochanges",
      input: { query: "AuthService" },
    }).result).toMatchObject({
      status: "PASS",
      relationships: expect.any(Array),
    });
    expect(runtime.execute({
      capability: "Stability",
      input: { query: "AuthService" },
    }).result).toMatchObject({
      stability: expect.objectContaining({
        classification: expect.stringMatching(/hotspot|watch|stable/),
      }),
    });
  });
});

function graph() {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: "route:POST:/login", type: "Route", name: "POST /login", metadata: { method: "POST", path: "/login" } },
      { id: "controller:AuthController", type: "Controller", name: "AuthController", file: "src/auth.controller.ts" },
      { id: "service:AuthService", type: "Service", name: "AuthService", file: "src/auth.service.ts" },
      { id: "repo:UserRepository", type: "Repository", name: "UserRepository", file: "src/user.repository.ts" },
      { id: "env:JWT_SECRET", type: "EnvironmentVariable", name: "JWT_SECRET" },
      { id: "pkg:auth", type: "Package", name: "@repo/auth" },
    ],
    edges: [
      edge("route:POST:/login", "HANDLES", "controller:AuthController"),
      edge("controller:AuthController", "CALLS", "service:AuthService"),
      edge("service:AuthService", "CALLS", "repo:UserRepository"),
      edge("service:AuthService", "READS", "env:JWT_SECRET"),
      edge("pkg:auth", "CONTAINS", "service:AuthService"),
    ],
  });
}

function edge(from: string, type: Parameters<typeof createEdgeId>[1], to: string) {
  return {
    id: createEdgeId(from, type, to),
    from,
    type,
    to,
    evidence: [{ kind: "semantic", confidence: "exact", description: `${from} ${type} ${to}` }],
  };
}
