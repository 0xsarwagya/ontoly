import { createRepositoryIntelligencePass } from "@0xsarwagya/ontoly-compiler";
import { createTypeScriptFrontendPass } from "@0xsarwagya/ontoly-parser-typescript";
import { describe, expect, it } from "vitest";
import {
  buildSoftwareGraphFromMemory,
  createInMemorySourceProvider,
  InvalidInMemorySourcePathError,
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
  "src/javascript.cjs": [
    "exports.jsHandler = function jsHandler() {",
    "  return 'ready';",
    "};",
    "",
  ].join("\n"),
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
      "src/./a.ts": "export const a = 2;\n",
      "src/b.ts": "export const b = 2;\n",
    });

    expect(provider.listFiles()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(provider.hasFile("src/a.ts")).toBe(true);
    expect(provider.hasFile("./src/a.ts")).toBe(true);
    expect(provider.hasFile("../external/package.json")).toBe(false);
    expect(provider.readFile("src/a.ts")).toBe("export const a = 2;\n");
    expect(provider.readFile("/external/package.json")).toBeUndefined();
    expect(provider.readFile("missing.ts")).toBeUndefined();
  });

  it.each([
    "",
    ".",
    "../escape.ts",
    "src/../../escape.ts",
    "/absolute.ts",
    "C:\\absolute.ts",
    "\\\\server\\share\\file.ts",
    "src/invalid\0name.ts",
  ])("rejects unsafe source path %j", (sourcePath) => {
    expect(() => createInMemorySourceProvider({ [sourcePath]: "" })).toThrow(
      expect.objectContaining({
        code: "INVALID_IN_MEMORY_SOURCE_PATH",
        sourcePath,
      }) as InvalidInMemorySourcePathError,
    );
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
    expect(functionNames(result.graph?.nodes ?? [])).toContain("jsHandler");
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

  it.each(["materialize", "zero-disk"] as const)(
    "rejects traversal paths with the %s strategy",
    async (strategy) => {
      await expect(buildSoftwareGraphFromMemory({
        files: { "../escape.ts": "export const escaped = true;\n" },
        strategy,
        passes: passes(),
      })).rejects.toMatchObject({
        code: "INVALID_IN_MEMORY_SOURCE_PATH",
        sourcePath: "../escape.ts",
      });
    },
  );
});
