import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildSoftwareGraphWithArtifacts } from "@0xsarwagya/ontoly-compiler";
import type { SoftwareGraph } from "@0xsarwagya/ontoly-core";
import { createTypeScriptFrontendPass } from "../src/index";

describe("software graph snapshots", () => {
  it("produces a deterministic graph for the basic example", async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "examples/basic");
    const first = await buildSoftwareGraphWithArtifacts({
      root,
      passes: [createTypeScriptFrontendPass()],
    });
    const second = await buildSoftwareGraphWithArtifacts({
      root,
      passes: [createTypeScriptFrontendPass()],
    });

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");
    expect(first.graph).toBeDefined();
    expect(second.graph).toBeDefined();

    const firstGraph = normalizeGraph(first.graph as SoftwareGraph);
    const secondGraph = normalizeGraph(second.graph as SoftwareGraph);

    expect(first.graph?.metadata.deterministicHash).toBe(second.graph?.metadata.deterministicHash);
    expect(firstGraph).toEqual(secondGraph);
    expect(firstGraph).toMatchSnapshot();
  });
});

function normalizeGraph(graph: SoftwareGraph): SoftwareGraph {
  return {
    ...graph,
    repository: {
      ...graph.repository,
      root: "<root>",
    },
    metadata: {
      ...graph.metadata,
      deterministicHash: "<deterministicHash>",
    },
  };
}
