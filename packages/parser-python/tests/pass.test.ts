import { describe, expect, it } from "vitest";
import { createPythonFrontendPass, PYTHON_FRONTEND_PASS_ID } from "@0xsarwagya/ontoly-parser-python";
import type { CompilerPass } from "@0xsarwagya/ontoly-compiler";

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
        language: path.endsWith(".py") ? "python" : "unknown",
        size: 100,
      })),
    },
  };
}

describe("createPythonFrontendPass", () => {
  it("creates a pass with correct metadata", () => {
    const pass = createPythonFrontendPass();
    expect(pass.id).toBe(PYTHON_FRONTEND_PASS_ID);
    expect(pass.kind).toBe("parser");
    expect(pass.stage).toBe("frontend-parsing");
    expect(pass.semantic).toBe(true);
  });

  it("filters to .py files only", async () => {
    const pass = createPythonFrontendPass();
    const files = {
      "app.py": "def hello(): pass",
      "main.ts": "export const x = 1;",
      "utils.py": "import os",
    };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["app.py", "main.ts", "utils.py"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.output.files).toBe(2);
  });

  it("produces symbols with language=python", async () => {
    const pass = createPythonFrontendPass();
    const files = {
      "app.py": `
class MyService:
    def process(self):
        pass

def handler():
    pass
`,
    };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["app.py"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.symbols.length).toBeGreaterThan(0);
    for (const symbol of result.symbols) {
      expect(symbol.language).toBe("python");
    }
  });

  it("stamps passId in provenance", async () => {
    const pass = createPythonFrontendPass();
    const files = { "x.py": "a = 1" };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["x.py"]);

    const result = await pass.run!(ctx as any, state as any);
    for (const symbol of result.symbols) {
      expect(symbol.provenance?.passId).toBe(PYTHON_FRONTEND_PASS_ID);
    }
  });

  it("returns empty result when no .py files exist", async () => {
    const pass = createPythonFrontendPass();
    const files = { "index.ts": "export const x = 1;" };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["index.ts"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.symbols).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
    expect(result.output.skipped).toBe(true);
  });

  it("extracts relationships", async () => {
    const pass = createPythonFrontendPass();
    const files = {
      "models.py": `
class Base:
    pass

class User(Base):
    name: str = ''

    def save(self):
        pass
`,
    };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["models.py"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.relationships.length).toBeGreaterThan(0);
    const extends_ = result.relationships.filter((r) => r.type === "EXTENDS");
    expect(extends_.length).toBeGreaterThanOrEqual(1);
    const contains = result.relationships.filter((r) => r.type === "CONTAINS");
    expect(contains.length).toBeGreaterThanOrEqual(1);
  });

  it("supports custom pass id", () => {
    const pass = createPythonFrontendPass({ id: "custom:python" });
    expect(pass.id).toBe("custom:python");
  });

  it("produces python-semantic-model product", async () => {
    const pass = createPythonFrontendPass();
    const files = { "app.py": "x = 1" };
    const ctx = createMockContext("/project", files);
    const state = createMockState(["app.py"]);

    const result = await pass.run!(ctx as any, state as any);
    expect(result.products?.["python-semantic-model"]).toBeDefined();
  });
});
