import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeId } from "@0xsarwagya/ontoly-core";
import { describe, expect, it } from "vitest";
import {
  buildSoftwareGraphWithArtifacts,
  type CompilerPass,
  type CompilerProgressEvent,
} from "../src/index";

describe("incremental compiler cache", () => {
  it("skips semantic stages when every compiler input is unchanged", async () => {
    const root = await createFixture();
    const cacheDir = join(root, ".ontoly", "cache", "compiler");
    const progress: CompilerProgressEvent[] = [];
    let executions = 0;
    const pass = fixturePass("1.0.0", () => {
      executions += 1;
    });
    const options = {
      root,
      cacheDir,
      cache: true,
      mode: "incremental" as const,
      write: false,
      passes: [pass],
    };

    const cold = await buildSoftwareGraphWithArtifacts(options);
    const warm = await buildSoftwareGraphWithArtifacts({
      ...options,
      onProgress: (event) => {
        progress.push(event);
      },
    });

    expect(cold.status).toBe("success");
    expect(cold.cache).toMatchObject({ hit: false, reason: "missing" });
    expect(warm.cache).toMatchObject({ hit: true, reason: "hit" });
    expect(warm.graph?.metadata.deterministicHash).toBe(cold.graph?.metadata.deterministicHash);
    expect(warm.products.get("fixture-product")).toEqual({ version: "1.0.0" });
    expect(executions).toBe(1);
    expect(warm.profile.stages.filter((stage) => stage.status === "skipped").map((stage) => stage.stage)).toContain(
      "core-compiler-passes",
    );
    expect(progress.some((event) => event.stage === "graph-construction" && event.phase === "skipped")).toBe(true);
  });

  it("reports exact source invalidation and rebuilds changed inputs", async () => {
    const root = await createFixture();
    const cacheDir = join(root, ".ontoly", "cache", "compiler");
    let executions = 0;
    const pass = fixturePass("1.0.0", () => {
      executions += 1;
    });
    const options = {
      root,
      cacheDir,
      cache: true,
      mode: "incremental" as const,
      write: false,
      passes: [pass],
    };

    await buildSoftwareGraphWithArtifacts(options);
    await writeFile(join(root, "src", "index.ts"), "export const answer = 43;\n", "utf8");
    const changed = await buildSoftwareGraphWithArtifacts(options);

    expect(changed.cache).toMatchObject({
      hit: false,
      reason: "sources-changed",
      invalidation: {
        added: [],
        modified: ["src/index.ts"],
        removed: [],
      },
    });
    expect(executions).toBe(2);
  });

  it("invalidates snapshots when a compiler pass version changes", async () => {
    const root = await createFixture();
    const cacheDir = join(root, ".ontoly", "cache", "compiler");
    const options = {
      root,
      cacheDir,
      cache: true,
      mode: "incremental" as const,
      write: false,
    };

    await buildSoftwareGraphWithArtifacts({ ...options, passes: [fixturePass("1.0.0")] });
    const changed = await buildSoftwareGraphWithArtifacts({ ...options, passes: [fixturePass("2.0.0")] });

    expect(changed.cache).toMatchObject({ hit: false, reason: "incompatible" });
  });

  it("rebuilds instead of silently dropping missing frontend products", async () => {
    const root = await createFixture();
    const cacheDir = join(root, ".ontoly", "cache", "compiler");
    let executions = 0;
    const pass = fixturePass("1.0.0", () => {
      executions += 1;
    });
    const options = {
      root,
      cacheDir,
      cache: true,
      mode: "incremental" as const,
      write: false,
      passes: [pass],
    };

    await buildSoftwareGraphWithArtifacts(options);
    await rm(join(cacheDir, "products.json"));
    const rebuilt = await buildSoftwareGraphWithArtifacts(options);

    expect(rebuilt.cache).toMatchObject({ hit: false, reason: "products-missing" });
    expect(executions).toBe(2);
  });
});

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-cache-test-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "cache-fixture" }), "utf8");
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "index.ts"), "export const answer = 42;\n", "utf8");
  return root;
}

function fixturePass(version: string, onRun: () => void = () => {}): CompilerPass {
  return {
    id: "test:cache-fixture",
    version,
    kind: "semantic",
    stage: "core-compiler-passes",
    semantic: true,
    run: () => {
      onRun();
      return {
        products: { "fixture-product": { version } },
        nodes: [{
          id: createNodeId({ type: "Module", name: "src/index.ts" }),
          type: "Module",
          name: "src/index.ts",
          file: "src/index.ts",
        }],
      };
    },
  };
}
