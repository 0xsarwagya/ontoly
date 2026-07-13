import { describe, expect, it } from "vitest";
import {
  createEdgeId,
  createSoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
} from "@0xsarwagya/ontoly-core";
import { analyzeSemanticCoverage, formatCoverageHuman } from "../src/index";

describe("semantic coverage analyzer", () => {
  it("reports complete coverage for connected semantic graph regions", () => {
    const graph = graphFrom({
      nodes: [
        node("class:src/users.service.ts:UsersService", "Class", "UsersService"),
        node("service:src/users.service.ts:UsersService", "Service", "UsersService"),
        node("class:src/users.controller.ts:UsersController", "Class", "UsersController"),
        node("controller:src/users.controller.ts:UsersController", "Controller", "UsersController"),
        node("method:src/users.controller.ts:UsersController.live", "Method", "UsersController.live"),
        node("route:GET:/users/live", "Route", "GET:/users/live", { method: "GET", path: "/users/live" }),
        node("mod:src/users.module.ts:UsersModule", "Module", "UsersModule", { framework: "NestJS", moduleKind: "nestjs" }),
      ],
      edges: [
        edge("REFERENCES", "service:src/users.service.ts:UsersService", "class:src/users.service.ts:UsersService"),
        edge("REFERENCES", "controller:src/users.controller.ts:UsersController", "class:src/users.controller.ts:UsersController"),
        edge("MOUNTS", "controller:src/users.controller.ts:UsersController", "route:GET:/users/live"),
        edge("HANDLES", "route:GET:/users/live", "method:src/users.controller.ts:UsersController.live"),
        edge("DECLARES", "mod:src/users.module.ts:UsersModule", "controller:src/users.controller.ts:UsersController"),
        edge("PROVIDES", "mod:src/users.module.ts:UsersModule", "service:src/users.service.ts:UsersService"),
        edge("INJECTS", "class:src/users.controller.ts:UsersController", "service:src/users.service.ts:UsersService"),
      ],
    });

    const report = analyzeSemanticCoverage(graph);
    const services = report.metrics.find((metric) => metric.id === "services");
    const controllers = report.metrics.find((metric) => metric.id === "controllers");
    const routes = report.metrics.find((metric) => metric.id === "routes");
    const di = report.metrics.find((metric) => metric.id === "dependencyInjection");

    expect(services?.coverage).toBe(100);
    expect(controllers?.coverage).toBe(100);
    expect(routes?.coverage).toBe(100);
    expect(di?.coverage).toBe(100);
    expect(formatCoverageHuman(report)).toContain("Software Graph Coverage");
  });

  it("diagnoses routes without handlers and package DI targets", () => {
    const graph = graphFrom({
      nodes: [
        node("pkg:@src/context", "Package", "@src/context", { external: true }),
        node("class:src/users.controller.ts:UsersController", "Class", "UsersController"),
        node("controller:src/users.controller.ts:UsersController", "Controller", "UsersController"),
        node("route:GET:/users", "Route", "GET:/users", { method: "GET", path: "/users" }),
      ],
      edges: [
        edge("REFERENCES", "controller:src/users.controller.ts:UsersController", "class:src/users.controller.ts:UsersController"),
        edge("INJECTS", "class:src/users.controller.ts:UsersController", "pkg:@src/context"),
      ],
    });

    const report = analyzeSemanticCoverage(graph);

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "SEMANTIC_ROUTE_WITHOUT_HANDLER",
      "SEMANTIC_INVALID_DI_TARGET",
    ]));
  });
});

function graphFrom(input: {
  readonly nodes: readonly SoftwareGraphNode[];
  readonly edges: readonly SoftwareGraphEdge[];
}) {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: input.nodes,
    edges: input.edges,
    diagnostics: [],
    fileCount: 1,
  });
}

function node(
  id: string,
  type: SoftwareGraphNode["type"],
  name: string,
  metadata?: SoftwareGraphNode["metadata"],
): SoftwareGraphNode {
  return {
    id,
    type,
    name,
    metadata,
  };
}

function edge(
  type: SoftwareGraphEdge["type"],
  from: string,
  to: string,
): SoftwareGraphEdge {
  return {
    id: createEdgeId(type, from, to),
    type,
    from,
    to,
  };
}
