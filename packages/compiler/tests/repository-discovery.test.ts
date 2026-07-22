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

  it("honors OntolyConfig.exclude entries for bare names and anchored path prefixes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-repository-discovery-exclude-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
    // Source files that should always be kept.
    await writeSource(root, "src/service.ts", "export const service = true;\n");
    await writeSource(root, "apps/api/src/main.ts", "export const api = true;\n");
    // ios/Pods appears twice — bare-name entry should skip both.
    await writeSource(root, "apps/mobile/ios/Pods/Manifest.lock", "PODS: []\n");
    await writeSource(root, "apps/companion/ios/Pods/Manifest.lock", "PODS: []\n");
    // .eve dev-runtime under a specific app — path-prefix entry should skip only this one.
    await writeSource(root, "apps/agent/.eve/dev-runtime/cache.json", "{}\n");
    await writeSource(root, "apps/agent/src/index.ts", "export const agent = true;\n");
    // Also .eve in another app — path-prefix entry should NOT skip this one.
    await writeSource(root, "apps/other/.eve/kept.txt", "kept\n");

    const discoveryWithoutExclude = await discoverRepository(root);
    expect(discoveryWithoutExclude.files).toContain("apps/mobile/ios/Pods/Manifest.lock");
    expect(discoveryWithoutExclude.files).toContain("apps/agent/.eve/dev-runtime/cache.json");

    const discovery = await discoverRepository(root, undefined, ["Pods", "apps/agent/.eve"]);
    const inventory = await createSourceInventory(root, undefined, ["Pods", "apps/agent/.eve"]);

    expect(discovery.files).toContain("src/service.ts");
    expect(discovery.files).toContain("apps/api/src/main.ts");
    expect(discovery.files).toContain("apps/agent/src/index.ts");
    // Bare-name "Pods" matches every Pods segment.
    expect(discovery.files).not.toContain("apps/mobile/ios/Pods/Manifest.lock");
    expect(discovery.files).not.toContain("apps/companion/ios/Pods/Manifest.lock");
    // Path-prefix "apps/agent/.eve" is anchored — only that subtree is skipped.
    expect(discovery.files).not.toContain("apps/agent/.eve/dev-runtime/cache.json");
    expect(discovery.files).toContain("apps/other/.eve/kept.txt");
    expect(inventory.sources.map((source) => source.path)).toEqual(discovery.files);
  });
});

async function writeSource(root: string, relativePath: string, contents: string): Promise<void> {
  const absolute = join(root, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, contents, "utf8");
}
