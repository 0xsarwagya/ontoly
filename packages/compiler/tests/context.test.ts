import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCompilerContext, createCompilerInvocation } from "../src/index";

describe("compiler context", () => {
  it("creates invocation and immutable context services", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-context-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
    const invocation = await createCompilerInvocation({ root, mode: "dry-run" });
    const context = await createCompilerContext({ invocation });

    expect(invocation.root).toBe(root);
    expect(invocation.mode).toBe("dry-run");
    expect(context.repository.name).toBe("fixture");
    expect(context.diagnostics.list()).toEqual([]);
    expect(context.passManager.passesForStage("core-compiler-passes")).toEqual([]);
  });
});
