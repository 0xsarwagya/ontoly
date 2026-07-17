import { createRepositoryIntelligencePass } from "@0xsarwagya/ontoly-compiler";
import { createTypeScriptFrontendPass } from "@0xsarwagya/ontoly-parser-typescript";
import { describe, expect, it } from "vitest";
import {
  buildSoftwareGraphFromMemory,
  createInMemorySourceProvider,
  type CompilerPass,
  type InMemorySources,
} from "../src/index";

const passes = (): CompilerPass[] => [createRepositoryIntelligencePass(), createTypeScriptFrontendPass()];

const SOURCES: InMemorySources = {
  "package.json": JSON.stringify({ name: "in-memory-fixture", version: "0.0.0" }),
  "src/index.ts": [
    "export function greet(name: string): string {",
    "  return `hi ${name}`;",
    "}",
    "",
    "export const greeting = greet(\"world\");",
    "",
  ].join("\n"),
  "src/util.ts": ["export const answer = 42;", ""].join("\n"),
};

function functionNames(nodes: readonly { readonly type: string; readonly name: string }[]): string[] {
  return nodes
    .filter((node) => node.type === "Function")
    .map((node) => node.name)
    .sort();
}

describe("createInMemorySourceProvider", () => {
  it("normalizes paths and serves contents", () => {
    const provider = createInMemorySourceProvider({
      "./src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
    });

    expect(provider.listFiles()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(provider.hasFile("src/a.ts")).toBe(true);
    expect(provider.hasFile("./src/a.ts")).toBe(true);
    expect(provider.readFile("src/a.ts")).toBe("export const a = 1;\n");
    expect(provider.readFile("missing.ts")).toBeUndefined();
  });
});

describe("buildSoftwareGraphFromMemory", () => {
  it("builds a graph via the materialize strategy without leaving files behind", async () => {
    const result = await buildSoftwareGraphFromMemory({ files: SOURCES, strategy: "materialize", passes: passes() });

    expect(result.status).toBe("success");
    expect(result.graph).toBeDefined();
    expect(result.discovery.files).toContain("src/index.ts");
    expect(result.discovery.name).toBe("in-memory-fixture");
    expect(functionNames(result.graph?.nodes ?? [])).toContain("greet");
  });

  it("builds a graph via the zero-disk strategy", async () => {
    const result = await buildSoftwareGraphFromMemory({ files: SOURCES, strategy: "zero-disk", passes: passes() });

    expect(result.status).toBe("success");
    expect(result.graph).toBeDefined();
    expect(result.discovery.files).toContain("src/index.ts");
    expect(functionNames(result.graph?.nodes ?? [])).toContain("greet");
  });

  it("produces identical graph node identity across strategies", async () => {
    const materialized = await buildSoftwareGraphFromMemory({ files: SOURCES, strategy: "materialize", passes: passes() });
    const zeroDisk = await buildSoftwareGraphFromMemory({ files: SOURCES, strategy: "zero-disk", passes: passes() });

    const ids = (result: typeof materialized): string[] =>
      (result.graph?.nodes ?? []).map((node) => node.id).sort();

    expect(zeroDisk.status).toBe("success");
    expect(materialized.status).toBe("success");
    expect(ids(zeroDisk)).toEqual(ids(materialized));
  });
});
