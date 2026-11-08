import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CompilerRelationship, CompilerSymbol } from "@0xsarwagya/ontoly-compiler";
import { analyzePythonProject } from "@0xsarwagya/ontoly-python";
import { generatePythonCompilerArtifacts } from "@0xsarwagya/ontoly-semantic-python";

const FIXTURE_ROOT = fileURLToPath(new URL("./fixtures", import.meta.url));
const FIXTURE_FILES = ["shop/__init__.py", "shop/models.py", "shop/service.py"];

const project = analyzePythonProject({ root: FIXTURE_ROOT, files: FIXTURE_FILES });
const { symbols, relationships } = generatePythonCompilerArtifacts({ project });
const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));

function label(symbol: CompilerSymbol | undefined): string {
  if (!symbol?.file) return `${symbol?.kind}:${symbol?.name}`;
  return symbol.kind === "Script" ? symbol.file : `${symbol.file}:${symbol.name}`;
}

function edgesOf(type: CompilerRelationship["type"], targetKind: CompilerSymbol["kind"]): string[] {
  return relationships
    .filter((edge) => edge.type === type && symbolsById.get(edge.to)?.kind === targetKind)
    .map((edge) => `${label(symbolsById.get(edge.from))} -> ${label(symbolsById.get(edge.to))}`)
    .sort();
}

describe("Python name resolution on a three-file package", () => {
  it("links files that import each other, including imports nested in try and if blocks", () => {
    expect(edgesOf("IMPORTS", "Script")).toEqual([
      "shop/__init__.py -> shop/models.py",
      "shop/__init__.py -> shop/service.py",
      "shop/models.py -> shop/service.py",
      "shop/service.py -> shop/models.py",
    ]);
  });

  it("keeps package nodes for third-party imports only", () => {
    expect(edgesOf("IMPORTS", "Package")).toEqual([
      "shop/models.py -> Package:typing",
      "shop/service.py -> Package:json",
      "shop/service.py -> Package:ujson",
    ]);
  });

  it("resolves same-file, self, module-attribute and function-body-imported calls", () => {
    expect(edgesOf("CALLS", "Function").concat(edgesOf("CALLS", "Method"))).toEqual([
      "shop/__init__.py:describe -> shop/models.py:format_name",
      "shop/models.py:format_name -> shop/models.py:_clean",
      "shop/service.py:checkout -> shop/models.py:format_name",
      "shop/service.py:Order.total -> shop/service.py:Order.subtotal",
    ]);
  });

  it("extends the imported class declaration instead of a phantom node", () => {
    expect(edgesOf("EXTENDS", "Class")).toEqual(["shop/service.py:Order -> shop/models.py:Base"]);
  });

  it("only emits edges whose endpoints are graph nodes", () => {
    const dangling = relationships.filter((edge) => !symbolsById.has(edge.from) || !symbolsById.has(edge.to));
    expect(dangling).toEqual([]);
  });
});
