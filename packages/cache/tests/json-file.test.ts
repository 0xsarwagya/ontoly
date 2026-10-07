import { mkdtemp, readFile, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSoftwareGraph } from "@0xsarwagya/ontoly-core";
import { describe, expect, it } from "vitest";
import { loadOrCreateSemanticIndex, writeGraphAlias, writeJsonFile } from "../src/index";

class Point {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}
}

async function roundTrip(value: unknown): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "ontoly-json-file-")), "value.json");
  await writeJsonFile(path, value);
  return readFile(path, "utf8");
}

describe("writeJsonFile", () => {
  it.each([
    ["a nested graph-shaped document", { nodes: [{ id: "a", tags: ["x", "y"], span: { line: 1 } }], edges: [], meta: { n: 1 } }],
    ["members JSON.stringify drops or nulls", { kept: 1, gone: undefined, fn: () => 1, list: [undefined, () => 1, Symbol("s"), 2] }],
    ["values with their own JSON forms", { when: new Date("2026-10-07T00:00:00Z"), map: new Map([["k", 1]]), point: new Point(1, 2), nan: Number.NaN, infinity: Number.POSITIVE_INFINITY }],
    ["strings that need escaping", { quote: 'say "hi"', newline: "a\nb", unicode: "ünï\u2028cødé", backslash: "c:\\path" }],
    ["empty containers and scalars", { emptyArray: [], emptyObject: {}, nested: [[], [{}], [[1]]], nil: null, truth: false, zero: 0 }],
    ["a top-level array", [1, "two", { three: [3] }, null]],
    ["a scalar", "just a string"],
  ])("writes %s exactly as JSON.stringify does", async (_label, value) => {
    expect(await roundTrip(value)).toBe(`${JSON.stringify(value)}\n`);
  });

  it("writes a document several times its 1 MiB write buffer without changing a byte", async () => {
    const value = {
      nodes: Array.from({ length: 80_000 }, (_, index) => ({ id: `node:${index}`, name: `Name${index}`, file: `src/f${index % 97}.ts` })),
    };

    const written = await roundTrip(value);

    expect(written.length).toBeGreaterThan(3 * (1 << 20));
    expect(written).toBe(`${JSON.stringify(value)}\n`);
  });
});

describe("writeGraphAlias", () => {
  it("makes graph.json a hard link to SoftwareGraph.json, and follows a graph renamed into place", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ontoly-graph-alias-"));
    const graph = join(directory, "SoftwareGraph.json");
    const alias = join(directory, "graph.json");
    await writeFile(graph, '{"v":1}\n', "utf8");

    await writeGraphAlias(graph, alias);

    expect((await stat(alias)).ino).toBe((await stat(graph)).ino);
    expect(await readFile(alias, "utf8")).toBe('{"v":1}\n');

    // An atomic write replaces SoftwareGraph.json with a new file; the alias must follow it.
    await writeFile(join(directory, "next.tmp"), '{"v":2}\n', "utf8");
    await rename(join(directory, "next.tmp"), graph);
    await writeGraphAlias(graph, alias);

    expect(await readFile(alias, "utf8")).toBe('{"v":2}\n');
  });
});

describe("loadOrCreateSemanticIndex", () => {
  it("uses the graph it is given instead of reading one from disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-semantic-known-graph-"));
    const graph = createSoftwareGraph({
      repository: { root, name: "fixture" },
      nodes: [{ id: "service:src/a.ts:AuthService", type: "Service", name: "AuthService", file: "src/a.ts" }],
      edges: [],
      fileCount: 1,
    });

    // No SoftwareGraph.json exists, so this only works if the given graph is used.
    const index = await loadOrCreateSemanticIndex({ root }, graph);

    expect(index.graphHash).toBe(graph.metadata.deterministicHash);
    expect(JSON.parse(await readFile(join(root, ".ontoly", "index.json"), "utf8")).graphHash).toBe(index.graphHash);
  });
});
