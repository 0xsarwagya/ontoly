import { describe, expect, it } from "vitest";
import { createEdgeId, createSoftwareGraph } from "@0xsarwagya/ontoly-core";
import { createMcpRuntime, McpCapabilityError, MCP_CAPABILITIES } from "../src/index";

describe("mcp capabilities", () => {
  it("discovers deterministic capabilities with schemas and examples", () => {
    const runtime = createMcpRuntime(graph());

    expect(runtime.capabilities.map((capability) => capability.name).sort()).toEqual([...MCP_CAPABILITIES].sort());
    expect(runtime.capabilities.every((capability) => capability.version && capability.inputSchema && capability.outputSchema)).toBe(true);
    expect(runtime.capabilities.every((capability) => capability.examples.length > 0)).toBe(true);
  });

  it("executes query-backed capabilities without exposing raw graph access", () => {
    const runtime = createMcpRuntime(graph());

    const functions = runtime.execute({
      capability: "FindFunction",
      input: { query: "main" },
    }).result;
    expect(functions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "fn:src/index.ts:main" }),
      expect.objectContaining({ id: "fn:src/other.ts:main" }),
    ]));
    expect(functions).toHaveLength(2);
    expect(runtime.execute({
      capability: "TraceExecution",
      input: { id: "fn:src/index.ts:main" },
    }).result).toMatchObject({
      order: ["fn:src/index.ts:main", "fn:src/service.ts:load"],
    });
    expect(runtime.execute({
      capability: "TraceExecution",
      input: { id: "fn:src/index.ts:main" },
    })).toMatchObject({
      provenance: {
        source: "Ontoly Software Graph",
        capability: "TraceExecution",
        graphHash: expect.any(String),
      },
      confidence: {
        level: "high",
      },
    });
    expect(runtime.execute({
      capability: "GraphStatistics",
      input: {},
    }).result).toMatchObject({
      nodeCount: 4,
      edgeCount: 2,
    });
    expect(runtime.execute({
      capability: "ExplainArchitecture",
      input: {},
    }).result).toMatchObject({
      repository: "repo",
    });
	    expect(runtime.execute({
	      capability: "ImpactAnalysis",
	      input: { id: "fn:src/service.ts:load" },
	    }).result).toMatchObject({
	      summary: expect.stringContaining("load"),
	      affectedNodes: {
	        Language: expect.arrayContaining([
	          expect.objectContaining({ id: "fn:src/index.ts:main" }),
	          expect.objectContaining({ id: "fn:src/service.ts:load" }),
	        ]),
	        Modules: [expect.objectContaining({ id: "pkg:external-sdk" })],
	      },
	      confidence: expect.objectContaining({ level: "high" }),
	      graph: expect.objectContaining({ source: "Ontoly Software Graph" }),
	    });
	  });

  it("rejects missing required input before execution", () => {
    const runtime = createMcpRuntime(graph());

    expect(() => runtime.execute({
      capability: "ImpactAnalysis",
      input: {},
    })).toThrow(McpCapabilityError);
    expect(() => runtime.execute({
      capability: "ImpactAnalysis",
      input: {},
    })).toThrow(/requires a non-empty "id"/);
  });

  it("rejects ambiguous node names instead of silently choosing one", () => {
    const runtime = createMcpRuntime(graph());

    expect(() => runtime.execute({
      capability: "FindDependencies",
      input: { id: "main" },
    })).toThrow(/matched 2 nodes/);
  });

  it("validates capability-specific node types", () => {
    const runtime = createMcpRuntime(graph());

    expect(() => runtime.execute({
      capability: "InspectModule",
      input: { id: "fn:src/index.ts:main" },
    })).toThrow(/expected Module/);
  });

  it("returns NOT_FOUND diagnostics with low confidence for missing routes", () => {
    const runtime = createMcpRuntime(graph());
    const response = runtime.execute({
      capability: "TraceRequestLifecycle",
      input: { query: "GET:/missing" },
    });

    expect(response.result).toMatchObject({
      status: "NOT_FOUND",
      route: null,
      diagnostics: [expect.objectContaining({ code: "MCP_NOT_FOUND" })],
    });
    expect(response.confidence).toMatchObject({ level: "low", score: 0 });
  });
});

function graph() {
  return createSoftwareGraph({
    repository: { root: "/repo", name: "repo" },
    nodes: [
      { id: "fn:src/index.ts:main", type: "Function", name: "main", file: "src/index.ts" },
      { id: "fn:src/other.ts:main", type: "Function", name: "main", file: "src/other.ts" },
      { id: "fn:src/service.ts:load", type: "Function", name: "load", file: "src/service.ts" },
      { id: "pkg:external-sdk", type: "Package", name: "external-sdk", metadata: { external: true } },
    ],
    edges: [
      {
        id: createEdgeId("CALLS", "fn:src/index.ts:main", "fn:src/service.ts:load"),
        type: "CALLS",
        from: "fn:src/index.ts:main",
        to: "fn:src/service.ts:load",
      },
      {
        id: createEdgeId("DEPENDS_ON", "fn:src/service.ts:load", "pkg:external-sdk"),
        type: "DEPENDS_ON",
        from: "fn:src/service.ts:load",
        to: "pkg:external-sdk",
      },
    ],
    fileCount: 2,
  });
}
