import { createSoftwareGraph, type SoftwareGraph } from "@0xsarwagya/ontoly-core";
import {
  createInteractiveHtmlArtifact,
  createInteractiveHtmlGraph,
  createInteractiveHtmlPlugin,
} from "../src/index";
import { describe, expect, it } from "vitest";

describe("interactive HTML graph plugin", () => {
  it("creates a deterministic self-contained HTML artifact", () => {
    const graph = fixtureGraph();
    const artifact = createInteractiveHtmlArtifact(graph, { title: "Example Graph" });

    expect(artifact).toMatchObject({
      path: "graph.html",
      mediaType: "text/html",
    });
    expect(artifact.contents).toContain("<!doctype html>");
    expect(artifact.contents).toContain('id="graph-data"');
    expect(artifact.contents).toContain("Interactive Software Graph");
    expect(createInteractiveHtmlArtifact(graph, { title: "Example Graph" }).contents).toBe(artifact.contents);
  });

  it("filters node and edge payloads before rendering", () => {
    const html = createInteractiveHtmlGraph(fixtureGraph(), {
      nodeTypes: ["Function", "Module"],
      relationships: ["CALLS"],
      includeIsolatedNodes: false,
    });
    const payload = readPayload(html);

    expect(payload.nodes.map((node) => node.type)).toEqual(["Function", "Function"]);
    expect(payload.edges.map((edge) => edge.type)).toEqual(["CALLS"]);
  });

  it("escapes graph data inside the JSON script payload", () => {
    const graph = createSoftwareGraph({
      repository: { root: "/repo", name: "repo" },
      nodes: [
        {
          id: "fn:src/index.ts:danger",
          type: "Function",
          name: "danger </script>",
          file: "src/index.ts",
        },
      ],
      edges: [],
    });
    const html = createInteractiveHtmlGraph(graph);

    expect(html).not.toContain("danger </script>");
    expect(readPayload(html).nodes[0]?.name).toBe("danger </script>");
  });

  it("exposes the Ontoly plugin contract", () => {
    const plugin = createInteractiveHtmlPlugin();
    const result = plugin.run({ graph: fixtureGraph() });

    expect(plugin.name).toBe("@0xsarwagya/ontoly-plugin-html");
    expect(result).toMatchObject({
      artifacts: [
        {
          path: "graph.html",
          mediaType: "text/html",
        },
      ],
    });
  });
});

function readPayload(html: string): {
  readonly nodes: readonly { readonly id: string; readonly type: string; readonly name: string }[];
  readonly edges: readonly { readonly id: string; readonly type: string; readonly from: string; readonly to: string }[];
} {
  const match = html.match(/<script id="graph-data" type="application\/json">(?<json>.*?)<\/script>/s);
  expect(match?.groups?.json).toBeDefined();
  return JSON.parse(
    match?.groups?.json
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&") ?? "{}",
  ) as {
    readonly nodes: readonly { readonly id: string; readonly type: string; readonly name: string }[];
    readonly edges: readonly { readonly id: string; readonly type: string; readonly from: string; readonly to: string }[];
  };
}

function fixtureGraph(): SoftwareGraph {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
      { id: "fn:src/index.ts:main", type: "Function", name: "main", file: "src/index.ts" },
      { id: "fn:src/auth.ts:login", type: "Function", name: "login", file: "src/auth.ts" },
      { id: "class:AuthService", type: "Class", name: "AuthService", file: "src/auth.ts" },
    ],
    edges: [
      {
        id: "edge:contains:index-main",
        type: "CONTAINS",
        from: "mod:src/index.ts",
        to: "fn:src/index.ts:main",
      },
      {
        id: "edge:calls:main-login",
        type: "CALLS",
        from: "fn:src/index.ts:main",
        to: "fn:src/auth.ts:login",
      },
      {
        id: "edge:uses:login-service",
        type: "USES",
        from: "fn:src/auth.ts:login",
        to: "class:AuthService",
      },
    ],
  });
}
