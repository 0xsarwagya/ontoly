import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getGraphArtifactPaths } from "@0xsarwagya/ontoly-cache";
import { createEdgeId, createSoftwareGraph } from "@0xsarwagya/ontoly-core";
import { describe, expect, it } from "vitest";
import { createOntolyOutputBundle } from "../src/output";

describe("ontoly output bundle", () => {
  it("respects absolute artifact output directories", () => {
    const paths = getGraphArtifactPaths({
      root: "/repo",
      directory: "/tmp/ontoly-output",
    });

    expect(paths.directory).toBe("/tmp/ontoly-output");
    expect(paths.graph).toBe("/tmp/ontoly-output/SoftwareGraph.json");
  });

  it("writes deterministic JSON, community, and HTML artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-output-test-"));
    const graph = createSoftwareGraph({
      repository: {
        root,
        name: "bundle-fixture",
        packageName: "bundle-fixture",
      },
      fileCount: 2,
      nodes: [
        { id: "workspace:bundle-fixture", type: "Workspace", name: "bundle-fixture" },
        { id: "mod:src/index.ts", type: "Module", name: "src/index.ts", file: "src/index.ts" },
        { id: "fn:src/index.ts:main", type: "Function", name: "main", file: "src/index.ts" },
        { id: "mod:src/isolated.ts", type: "Module", name: "src/isolated.ts", file: "src/isolated.ts" },
      ],
      edges: [
        {
          id: createEdgeId("CONTAINS", "workspace:bundle-fixture", "mod:src/index.ts"),
          type: "CONTAINS",
          from: "workspace:bundle-fixture",
          to: "mod:src/index.ts",
        },
        {
          id: createEdgeId("CONTAINS", "mod:src/index.ts", "fn:src/index.ts:main"),
          type: "CONTAINS",
          from: "mod:src/index.ts",
          to: "fn:src/index.ts:main",
        },
      ],
    });

    const bundle = await createOntolyOutputBundle({
      root,
      directory: "ontoly-output",
      graph,
      source: {
        kind: "remote",
        remote: "https://github.com/example/bundle-fixture.git",
      },
      includeHtml: true,
    });

    expect(bundle.directory).toBe(join(root, "ontoly-output"));
    expect(bundle.files).toContain("SoftwareGraph.json");
    expect(bundle.files).toContain("reports/architecture.json");
    expect(bundle.files).toContain("communities/communities.json");
    expect(bundle.files).toContain("communities/community-000.json");
    expect(bundle.files).toContain("html/graph.html");
    expect(bundle.files).toContain("html/architecture.html");
    expect(bundle.communities).toHaveLength(2);

    const manifest = JSON.parse(await readFile(join(bundle.directory, "manifest.json"), "utf8")) as {
      readonly repository: { readonly source: string; readonly remote?: string };
      readonly graph: { readonly hash: string };
      readonly artifacts: { readonly html: readonly string[]; readonly communities: readonly string[] };
    };
    expect(manifest.repository.source).toBe("remote");
    expect(manifest.repository.remote).toBe("https://github.com/example/bundle-fixture.git");
    expect(manifest.graph.hash).toBe(graph.metadata.deterministicHash);
    expect(manifest.artifacts.html).toEqual(["html/architecture.html", "html/graph.html"]);
    expect(manifest.artifacts.communities).toContain("communities/community-000.json");

    const community = JSON.parse(await readFile(join(bundle.directory, "communities/community-000.json"), "utf8")) as {
      readonly nodeCount: number;
      readonly nodes: readonly unknown[];
      readonly edges: readonly unknown[];
    };
    expect(community.nodeCount).toBe(3);
    expect(community.nodes).toHaveLength(3);
    expect(community.edges).toHaveLength(2);
  });
});
