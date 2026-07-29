import { describe, expect, it } from "vitest";
import { createGoFrontendPass, GO_FRONTEND_PASS_ID } from "@0xsarwagya/ontoly-parser-go";

function createMockContext(root: string, files: Record<string, string>) {
  return {
    invocation: {
      root,
      mode: "full" as const,
      configPath: undefined,
      outputDir: "dist",
      write: false,
      cacheEnabled: false,
      cacheDir: ".cache",
      workers: 1,
      sourceProvider: {
        listFiles: () => Object.keys(files),
        readFile: (path: string) => files[path],
        hasFile: (path: string) => path in files,
      },
    },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  };
}

function createMockState(files: string[]) {
  return {
    sources: {
      sources: files.map((path) => ({
        path,
        language: path.endsWith(".go") ? "go" : "unknown",
        size: 100,
      })),
    },
  };
}

describe("createGoFrontendPass", () => {
  it("creates a pass with correct metadata", () => {
    const pass = createGoFrontendPass();
    expect(pass.id).toBe(GO_FRONTEND_PASS_ID);
    expect(pass.kind).toBe("parser");
    expect(pass.stage).toBe("frontend-parsing");
    expect(pass.semantic).toBe(true);
  });

  it("filters to .go files only", async () => {
    const pass = createGoFrontendPass();
    const files: Record<string, string> = {
      "main.go": "package main\nfunc main() {}",
      "main.ts": "export const x = 1;",
      "utils.go": "package main\nfunc helper() {}",
    };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["main.go", "main.ts", "utils.go"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.output!.files).toBe(2);
  });

  it("produces symbols with language=go", async () => {
    const pass = createGoFrontendPass();
    const files: Record<string, string> = {
      "main.go": `package main

type Server struct {
	port int
}

func Start() {}
`,
    };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["main.go"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.symbols!.length).toBeGreaterThan(0);
    for (const symbol of result.symbols!) {
      expect(symbol.language).toBe("go");
    }
  });

  it("stamps passId in provenance", async () => {
    const pass = createGoFrontendPass();
    const files: Record<string, string> = { "main.go": "package main\nvar x int" };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["main.go"]);

    const result = await pass.run!(ctx as any, state as any);
    for (const symbol of result.symbols!) {
      expect(symbol.provenance?.passId).toBe(GO_FRONTEND_PASS_ID);
    }
  });

  it("returns empty result when no .go files exist", async () => {
    const pass = createGoFrontendPass();
    const files: Record<string, string> = { "index.ts": "export const x = 1;" };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["index.ts"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.symbols!).toHaveLength(0);
    expect(result.relationships!).toHaveLength(0);
    expect(result.output!.skipped).toBe(true);
  });

  it("extracts relationships", async () => {
    const pass = createGoFrontendPass();
    const files: Record<string, string> = {
      "models.go": `package main

type Base struct {
	ID int
}

type User struct {
	Base
	Name string
}

func (u *User) Save() {}
`,
    };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["models.go"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.relationships!.length).toBeGreaterThan(0);
    const extends_ = result.relationships!.filter((r) => r.type === "EXTENDS");
    expect(extends_.length).toBeGreaterThanOrEqual(1);
    const contains = result.relationships!.filter((r) => r.type === "CONTAINS");
    expect(contains.length).toBeGreaterThanOrEqual(1);
  });

  it("supports custom pass id", () => {
    const pass = createGoFrontendPass({ id: "custom:go" });
    expect(pass.id).toBe("custom:go");
  });

  it("produces go-semantic-model product", async () => {
    const pass = createGoFrontendPass();
    const files: Record<string, string> = { "main.go": "package main\nvar x int" };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["main.go"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.products?.["go-semantic-model"]).toBeDefined();
  });
});
