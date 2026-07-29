import { describe, expect, it } from "vitest";
import {
  generatePythonCompilerArtifacts,
  type GeneratePythonCompilerArtifactsResult,
} from "@0xsarwagya/ontoly-semantic-python";
import type { PythonProject } from "@0xsarwagya/ontoly-python";

function makeProject(overrides: Partial<PythonProject> = {}): PythonProject {
  return {
    version: "1.0.0",
    root: "/test",
    files: [{
      id: "script:main.py",
      file: "main.py",
      absoluteFile: "/test/main.py",
      span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 10, endColumn: 0 },
    }],
    classes: [],
    functions: [],
    methods: [],
    imports: [],
    variables: [],
    decorators: [],
    calls: [],
    assignments: [],
    diagnostics: [],
    metadata: { fileCount: 1, parseErrors: 0 },
    ...overrides,
  };
}

function generate(overrides: Partial<PythonProject> = {}): GeneratePythonCompilerArtifactsResult {
  return generatePythonCompilerArtifacts({ project: makeProject(overrides) });
}

describe("generatePythonCompilerArtifacts", () => {
  it("creates script symbols for source files", () => {
    const result = generate();
    const scripts = result.symbols.filter((s) => s.kind === "Script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.language).toBe("python");
    expect(scripts[0]!.name).toBe("main.py");
  });

  it("creates class symbols", () => {
    const result = generate({
      classes: [{
        id: "cls:main.py:MyClass",
        name: "MyClass",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 5, endColumn: 0 },
        bases: ["Base"],
        decorators: [],
        exported: true,
      }],
    });
    const classSymbols = result.symbols.filter((s) => s.kind === "Class");
    expect(classSymbols.length).toBeGreaterThanOrEqual(1);
    const myClass = classSymbols.find((s) => s.name === "MyClass");
    expect(myClass).toBeDefined();
    expect(myClass!.language).toBe("python");
  });

  it("creates function symbols", () => {
    const result = generate({
      functions: [{
        id: "fn:main.py:handler",
        name: "handler",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 3, endColumn: 0 },
        async: true,
        parameters: [{ name: "request", annotation: "Request", kind: "positional" }],
        returnAnnotation: "Response",
        decorators: [],
        exported: true,
      }],
    });
    const funcs = result.symbols.filter((s) => s.kind === "Function");
    expect(funcs).toHaveLength(1);
    expect(funcs[0]!.name).toBe("handler");
    expect(funcs[0]!.metadata?.async).toBe(true);
  });

  it("creates method symbols", () => {
    const result = generate({
      classes: [{
        id: "cls:main.py:Service",
        name: "Service",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 10, endColumn: 0 },
        bases: [],
        decorators: [],
        exported: true,
      }],
      methods: [{
        id: "method:main.py:Service.process",
        name: "Service.process",
        classId: "cls:main.py:Service",
        className: "Service",
        methodName: "process",
        file: "main.py",
        span: { file: "main.py", startLine: 3, startColumn: 4, endLine: 5, endColumn: 0 },
        async: false,
        static: false,
        classmethod: false,
        property: false,
        parameters: [{ name: "self", kind: "positional" }],
        decorators: [],
      }],
    });
    const methods = result.symbols.filter((s) => s.kind === "Method");
    expect(methods).toHaveLength(1);
    expect(methods[0]!.name).toBe("Service.process");
  });

  it("creates CONTAINS relationships for module -> class/function", () => {
    const result = generate({
      classes: [{
        id: "cls:main.py:Foo",
        name: "Foo",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 3, endColumn: 0 },
        bases: [],
        decorators: [],
        exported: true,
      }],
      functions: [{
        id: "fn:main.py:bar",
        name: "bar",
        file: "main.py",
        span: { file: "main.py", startLine: 5, startColumn: 0, endLine: 7, endColumn: 0 },
        async: false,
        parameters: [],
        decorators: [],
        exported: true,
      }],
    });
    const contains = result.relationships.filter((r) => r.type === "CONTAINS");
    expect(contains.length).toBeGreaterThanOrEqual(2);
    expect(contains.some((r) => r.to === "cls:main.py:Foo")).toBe(true);
    expect(contains.some((r) => r.to === "fn:main.py:bar")).toBe(true);
  });

  it("creates CONTAINS relationships for class -> method", () => {
    const result = generate({
      classes: [{
        id: "cls:main.py:Svc",
        name: "Svc",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 5, endColumn: 0 },
        bases: [],
        decorators: [],
        exported: true,
      }],
      methods: [{
        id: "method:main.py:Svc.run",
        name: "Svc.run",
        classId: "cls:main.py:Svc",
        className: "Svc",
        methodName: "run",
        file: "main.py",
        span: { file: "main.py", startLine: 2, startColumn: 4, endLine: 4, endColumn: 0 },
        async: false,
        static: false,
        classmethod: false,
        property: false,
        parameters: [],
        decorators: [],
      }],
    });
    const contains = result.relationships.filter(
      (r) => r.type === "CONTAINS" && r.from === "cls:main.py:Svc",
    );
    expect(contains).toHaveLength(1);
    expect(contains[0]!.to).toBe("method:main.py:Svc.run");
  });

  it("creates IMPORTS relationships", () => {
    const result = generate({
      imports: [{
        id: "import:main.py:os",
        file: "main.py",
        module: "os",
        names: [{ name: "os" }],
        relative: false,
        relativeLevel: 0,
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 },
      }],
    });
    const imports = result.relationships.filter((r) => r.type === "IMPORTS");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.from).toBe("script:main.py");
  });

  it("creates EXTENDS relationships for class inheritance", () => {
    const result = generate({
      classes: [{
        id: "cls:main.py:Child",
        name: "Child",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 3, endColumn: 0 },
        bases: ["Parent", "Mixin"],
        decorators: [],
        exported: true,
      }],
    });
    const extends_ = result.relationships.filter((r) => r.type === "EXTENDS");
    expect(extends_).toHaveLength(2);
    expect(extends_.some((r) => r.from === "cls:main.py:Child")).toBe(true);
  });

  it("creates DECORATES relationships", () => {
    const result = generate({
      decorators: [{
        id: "dec:main.py:dataclass",
        name: "dataclass",
        expression: "dataclass",
        arguments: [],
        targetId: "cls:main.py:Config",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 },
      }],
    });
    const decorates = result.relationships.filter((r) => r.type === "DECORATES");
    expect(decorates).toHaveLength(1);
    expect(decorates[0]!.to).toBe("cls:main.py:Config");
  });

  it("creates variable symbols", () => {
    const result = generate({
      variables: [{
        id: "config:main.py:DEBUG",
        name: "DEBUG",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 1, endColumn: 15 },
        annotation: "bool",
      }],
    });
    const vars = result.symbols.filter((s) => s.kind === "Configuration");
    expect(vars).toHaveLength(1);
    expect(vars[0]!.name).toBe("DEBUG");
  });

  it("all symbols have language=python", () => {
    const result = generate({
      classes: [{
        id: "cls:main.py:A",
        name: "A",
        file: "main.py",
        span: { file: "main.py", startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
        bases: [],
        decorators: [],
        exported: true,
      }],
      functions: [{
        id: "fn:main.py:f",
        name: "f",
        file: "main.py",
        span: { file: "main.py", startLine: 3, startColumn: 0, endLine: 4, endColumn: 0 },
        async: false,
        parameters: [],
        decorators: [],
        exported: true,
      }],
    });
    for (const sym of result.symbols) {
      expect(sym.language).toBe("python");
    }
  });

  it("returns empty result for empty project", () => {
    const result = generate({
      files: [],
      classes: [],
      functions: [],
      methods: [],
      imports: [],
      variables: [],
      decorators: [],
      calls: [],
      assignments: [],
      diagnostics: [],
    });
    expect(result.symbols).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
  });
});
