import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findGraphArtifactDirectory } from "../src/index";

async function writeGraph(root: string, directory: string, name = "SoftwareGraph.json", modified?: Date): Promise<void> {
  await mkdir(join(root, directory), { recursive: true });
  const path = join(root, directory, name);
  await writeFile(path, "{}", "utf8");
  if (modified) {
    await utimes(path, modified, modified);
  }
}

describe("findGraphArtifactDirectory", () => {
  it("is undefined before any graph is built", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-artifacts-none-"));

    expect(await findGraphArtifactDirectory(root)).toBeUndefined();
  });

  it("finds the graph ontoly build writes to ontoly-output", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-artifacts-build-"));
    await writeGraph(root, "ontoly-output");

    expect(await findGraphArtifactDirectory(root)).toBe("ontoly-output");
  });

  it("finds an older .ontoly graph, under its legacy file name too", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-artifacts-legacy-"));
    await writeGraph(root, ".ontoly", "graph.json");

    expect(await findGraphArtifactDirectory(root)).toBe(".ontoly");
  });

  it("prefers the newer graph when both directories hold one", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-artifacts-both-"));
    await writeGraph(root, "ontoly-output", "SoftwareGraph.json", new Date("2026-10-01T00:00:00Z"));
    await writeGraph(root, ".ontoly", "SoftwareGraph.json", new Date("2026-10-07T00:00:00Z"));

    expect(await findGraphArtifactDirectory(root)).toBe(".ontoly");
  });
});
