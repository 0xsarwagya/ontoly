import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSourceInventory, discoverRepository } from "../src/index";

describe("repository discovery", () => {
  it("ignores generated artifact and dev-server directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-repository-discovery-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
    await writeSource(root, "src/service.ts", "export const service = true;\n");
    await writeSource(root, ".artifacts/prototype/App.tsx", "export const generated = true;\n");
    await writeSource(root, "downloads/chat-1/App.tsx", "export const downloaded = true;\n");
    await writeSource(root, ".next/server/app.js", "module.exports = {};\n");
    await writeSource(root, "build/index.js", "module.exports = {};\n");

    const discovery = await discoverRepository(root);
    const inventory = await createSourceInventory(root);

    expect(discovery.files).toContain("src/service.ts");
    expect(discovery.files).not.toContain(".artifacts/prototype/App.tsx");
    expect(discovery.files).not.toContain("downloads/chat-1/App.tsx");
    expect(discovery.files).not.toContain(".next/server/app.js");
    expect(discovery.files).not.toContain("build/index.js");
    expect(inventory.sources.map((source) => source.path)).toEqual(discovery.files);
  });
});

async function writeSource(root: string, relativePath: string, contents: string): Promise<void> {
  const absolute = join(root, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, contents, "utf8");
}
