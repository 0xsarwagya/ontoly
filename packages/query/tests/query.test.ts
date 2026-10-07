import { describe, expect, it } from "vitest";
import { createEdgeId, createSoftwareGraph, type SoftwareGraph, type SoftwareGraphNode } from "@0xsarwagya/ontoly-core";
import { createQueryEngine, exportGraph } from "../src/index";

const HARNESS = "qa/harness/sleepiz-daily-backfill/run.mjs";
const SERVICE = "src/sleepiz-backfill/sleepiz-backfill.service.ts";
const BACKFILL_LAST_NIGHT = `method:${SERVICE}:SleepizBackfillService.backfillLastNight`;
const CONTROLLER_BACKFILL = "method:src/sleepiz-backfill/sleepiz-backfill.controller.ts:SleepizBackfillController.backfill";

describe("query engine", () => {
  it("uses indexes for deterministic node lookup", () => {
    const query = createQueryEngine(fixtureGraph());

    expect(query.findNode("fn:src/index.ts:main")?.name).toBe("main");
    expect(query.findFunction("main")?.id).toBe("fn:src/index.ts:main");
    expect(query.findClass("UserService")?.id).toBe("class:src/service.ts:UserService");
    expect(query.findModule("src/service.ts")?.id).toBe("mod:src/service.ts");
    expect(query.findByFile("src/service.ts").map((node) => node.id)).toEqual([
      "class:src/service.ts:UserService",
      "method:src/service.ts:UserService.load",
      "mod:src/service.ts",
    ]);
  });

  it("finds nodes from human concept phrases without spelling fan-out", () => {
    const query = createQueryEngine(fixtureGraph());

    expect(query.findNodes("Plan Definition Resource").map((node) => node.id)).toEqual([
      "res:fhir:PlanDefinition",
    ]);
    expect(query.findNodes("plan-definition-resource").map((node) => node.id)).toEqual([
      "res:fhir:PlanDefinition",
    ]);
    expect(query.findNodes("planDefinition").map((node) => node.id)).toEqual([
      "res:fhir:PlanDefinition",
    ]);
    expect(query.findNodes("threshold dto").map((node) => node.id)).toEqual([
      "model:src/threshold.ts:ThresholdDto",
    ]);
  });

  it("finds callees, callers, dependencies, and dependents deterministically", () => {
    const query = createQueryEngine(fixtureGraph());

    expect(query.callees("fn:src/index.ts:main").map((node) => node.id)).toEqual([
      "method:src/service.ts:UserService.load",
    ]);
    expect(query.callers("fn:src/auth.ts:requireUser").map((node) => node.id)).toEqual([
      "method:src/service.ts:UserService.load",
    ]);
    expect(query.dependencies("mod:src/index.ts", 2).order).toEqual([
      "mod:src/index.ts",
      "mod:src/service.ts",
      "mod:src/auth.ts",
    ]);
    expect(query.dependents("mod:src/auth.ts", 2).order).toEqual([
      "mod:src/auth.ts",
      "mod:src/service.ts",
      "mod:src/index.ts",
    ]);
  });

  it("walks with traversal constraints and computes shortest paths", () => {
    const query = createQueryEngine(fixtureGraph());
    const depthFirst = query.walk("fn:src/index.ts:main", {
      strategy: "depth-first",
      relationships: ["CALLS"],
      depth: 2,
    });
    const shortest = query.shortestPath("fn:src/index.ts:main", "fn:src/auth.ts:requireUser", {
      relationships: ["CALLS"],
    });

    expect(depthFirst.order).toEqual([
      "fn:src/index.ts:main",
      "method:src/service.ts:UserService.load",
      "fn:src/auth.ts:requireUser",
    ]);
    expect(shortest?.nodes.map((node) => node.id)).toEqual([
      "fn:src/index.ts:main",
      "method:src/service.ts:UserService.load",
      "fn:src/auth.ts:requireUser",
    ]);
  });

  it("detects cycles, components, topological order, and statistics", () => {
    const acyclic = createQueryEngine(fixtureGraph());
    const cyclic = createQueryEngine(cyclicGraph());

    expect(acyclic.hasCycle(["IMPORTS"])).toBe(false);
    expect(cyclic.hasCycle(["IMPORTS"])).toBe(true);
    expect(cyclic.detectCycles(["IMPORTS"])).toEqual([
      ["mod:a.ts", "mod:b.ts"],
    ]);
    expect(acyclic.connectedComponents()).toHaveLength(4);
    expect(acyclic.topologicalSort(["CALLS"]).map((node) => node.id)).toContain("fn:src/index.ts:main");

    const stats = acyclic.stats();
    expect(stats.nodeCount).toBe(9);
    expect(stats.edgeCount).toBe(5);
    expect(stats.relationshipCounts).toMatchObject({ CALLS: 2, IMPORTS: 2, CONTAINS: 1 });
    expect(stats.longestCallChain).toEqual([
      "fn:src/index.ts:main",
      "method:src/service.ts:UserService.load",
      "fn:src/auth.ts:requireUser",
    ]);
    expect(stats.mostImportedModule).toEqual({ nodeId: "mod:src/auth.ts", count: 1 });
  });

  it("memoizes traversals with deterministic cache statistics", () => {
    const query = createQueryEngine(fixtureGraph());

    expect(query.cache.stats()).toMatchObject({ hits: 0, misses: 0, entries: 0 });
    query.walk("mod:src/index.ts", { relationships: ["IMPORTS"], depth: 2 });
    expect(query.cache.stats()).toMatchObject({ hits: 0, misses: 1, entries: 1 });
    query.walk("mod:src/index.ts", { relationships: ["IMPORTS"], depth: 2 });
    expect(query.cache.stats()).toMatchObject({ hits: 1, misses: 1, entries: 1 });
    query.cache.clear();
    expect(query.cache.stats()).toMatchObject({ hits: 0, misses: 0, entries: 0 });
  });

  it("exports graph formats deterministically", () => {
    const graph = fixtureGraph();

    expect(exportGraph(graph, { format: "mermaid" })).toContain("graph TD");
    expect(exportGraph(graph, { format: "dot" })).toContain("digraph SoftwareGraph");
    expect(exportGraph(graph, { format: "graphml" })).toContain("<graphml");
    expect(exportGraph(graph, { format: "call-tree", rootId: "fn:src/index.ts:main" })).toContain(
      "Function fn:src/index.ts:main",
    );
  });

  it("resolves exact ids and names before free text", () => {
    const query = createQueryEngine(resolutionGraph());

    expect(ids(query.findNodes("backfillLastNight"))).toEqual([`fn:${HARNESS}:lastNight`, BACKFILL_LAST_NIGHT]);
    expect(ids(query.resolve("backfillLastNight"))).toEqual([BACKFILL_LAST_NIGHT]);
    expect(ids(query.resolve("SleepizBackfillService.backfillLastNight"))).toEqual([BACKFILL_LAST_NIGHT]);
    expect(ids(query.resolve(BACKFILL_LAST_NIGHT))).toEqual([BACKFILL_LAST_NIGHT]);
    expect(ids(query.resolve(HARNESS))).toEqual([`mod:${HARNESS}`]);
  });

  it("returns every node that matches at the best tier", () => {
    const query = createQueryEngine(resolutionGraph());

    expect(ids(query.resolve("processInScope"))).toEqual([
      "method:src/job/billing.processor.ts:BillingProcessor.processInScope",
      "method:src/sleepiz-backfill/sleepiz-backfill.processor.ts:SleepizBackfillProcessor.processInScope",
    ]);
    expect(ids(query.resolve("backfill"))).toEqual([`fn:${HARNESS}:backfill`, CONTROLLER_BACKFILL]);
    expect(ids(query.resolve("backfill last night"))).toEqual([`fn:${HARNESS}:lastNight`, BACKFILL_LAST_NIGHT]);
    expect(query.resolve("backfill last night", { fuzzy: false })).toEqual([]);
  });

  it("prefers a declaration over its export statement and role facets", () => {
    const query = createQueryEngine(resolutionGraph());

    expect(ids(query.resolve("SleepizBackfillService"))).toEqual([`class:${SERVICE}:SleepizBackfillService`]);
  });

  it("resolves routes from METHOD /path, METHOD:/path, or /path", () => {
    const query = createQueryEngine(resolutionGraph());

    for (const target of ["POST /sleepiz/backfill", "POST:/sleepiz/backfill", "post /sleepiz/backfill", "/sleepiz/backfill"]) {
      expect(ids(query.resolve(target, { types: ["Route"] })), target).toEqual(["route:POST:/sleepiz/backfill"]);
    }
    expect(ids(query.resolve("/sleepiz/status"))).toEqual(["route:GET:/sleepiz/status", "route:POST:/sleepiz/status"]);
    expect(query.resolve("GET /sleepiz/backfill")).toEqual([]);
  });
});

function ids(nodes: readonly SoftwareGraphNode[]): readonly string[] {
  return nodes.map((node) => node.id);
}

// A QA harness whose path and helpers match "backfillLastNight" as free text
// but never call it, beside the service method of that name.
function resolutionGraph(): SoftwareGraph {
  const route = (method: string, path: string): SoftwareGraphNode => ({
    id: `route:${method}:${path}`,
    type: "Route",
    name: `${method}:${path}`,
    metadata: { method, path },
  });

  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: `mod:${HARNESS}`, type: "Module", name: HARNESS, file: HARNESS },
      { id: `fn:${HARNESS}:lastNight`, type: "Function", name: "lastNight", file: HARNESS },
      { id: `fn:${HARNESS}:backfill`, type: "Function", name: "backfill", file: HARNESS },
      { id: `class:${SERVICE}:SleepizBackfillService`, type: "Class", name: "SleepizBackfillService", file: SERVICE },
      { id: `service:${SERVICE}:SleepizBackfillService`, type: "Service", name: "SleepizBackfillService", file: SERVICE },
      { id: `export:${SERVICE}:SleepizBackfillService`, type: "Export", name: "SleepizBackfillService", file: SERVICE },
      { id: BACKFILL_LAST_NIGHT, type: "Method", name: "SleepizBackfillService.backfillLastNight", file: SERVICE },
      { id: CONTROLLER_BACKFILL, type: "Method", name: "SleepizBackfillController.backfill" },
      { id: "method:src/job/billing.processor.ts:BillingProcessor.processInScope", type: "Method", name: "BillingProcessor.processInScope" },
      {
        id: "method:src/sleepiz-backfill/sleepiz-backfill.processor.ts:SleepizBackfillProcessor.processInScope",
        type: "Method",
        name: "SleepizBackfillProcessor.processInScope",
      },
      route("POST", "/sleepiz/backfill"),
      route("GET", "/sleepiz/status"),
      route("POST", "/sleepiz/status"),
    ],
    edges: [],
    fileCount: 2,
  });
}

function fixtureGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
      { id: "mod:src/service.ts", type: "Module", name: "src/service.ts", file: "src/service.ts" },
      { id: "mod:src/auth.ts", type: "Module", name: "src/auth.ts", file: "src/auth.ts" },
      { id: "fn:src/index.ts:main", type: "Function", name: "main", file: "src/index.ts" },
      {
        id: "class:src/service.ts:UserService",
        type: "Class",
        name: "UserService",
        file: "src/service.ts",
      },
      {
        id: "method:src/service.ts:UserService.load",
        type: "Method",
        name: "UserService.load",
        file: "src/service.ts",
      },
      { id: "fn:src/auth.ts:requireUser", type: "Function", name: "requireUser", file: "src/auth.ts" },
      {
        id: "res:fhir:PlanDefinition",
        type: "Resource",
        name: "PlanDefinition",
        metadata: { externalContract: "FHIR PlanDefinition" },
      },
      {
        id: "model:src/threshold.ts:ThresholdDto",
        type: "Model",
        name: "ThresholdDto",
        file: "src/threshold.ts",
      },
    ],
    edges: [
      edge("CALLS", "fn:src/index.ts:main", "method:src/service.ts:UserService.load"),
      edge("CALLS", "method:src/service.ts:UserService.load", "fn:src/auth.ts:requireUser"),
      edge("IMPORTS", "mod:src/index.ts", "mod:src/service.ts"),
      edge("IMPORTS", "mod:src/service.ts", "mod:src/auth.ts"),
      edge("CONTAINS", "class:src/service.ts:UserService", "method:src/service.ts:UserService.load"),
    ],
    fileCount: 3,
  });
}

function cyclicGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: "mod:a.ts", type: "Module", name: "a.ts", file: "a.ts" },
      { id: "mod:b.ts", type: "Module", name: "b.ts", file: "b.ts" },
    ],
    edges: [
      edge("IMPORTS", "mod:a.ts", "mod:b.ts"),
      edge("IMPORTS", "mod:b.ts", "mod:a.ts"),
    ],
    fileCount: 2,
  });
}

function edge(type: Parameters<typeof createEdgeId>[0], from: string, to: string) {
  return {
    id: createEdgeId(type, from, to),
    type,
    from,
    to,
  };
}
