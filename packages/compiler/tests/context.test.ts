import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCompilerContext,
  createCompilerInvocation,
  loadOntolyConfig,
  resolveOntolyConfig,
} from "../src/index";

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

  it("resolves OntolyConfig array and record fields to their defaults", () => {
    // Missing fields are filled in.
    expect(resolveOntolyConfig({})).toMatchObject({
      include: [],
      exclude: [],
      plugins: [],
      parsers: {},
    });

    // Provided fields are preserved verbatim.
    const custom = resolveOntolyConfig({
      exclude: ["Pods", "apps/companion-app/ios"],
      plugins: ["@example/plugin"],
      parsers: { openapi: false },
    });
    expect(custom.exclude).toEqual(["Pods", "apps/companion-app/ios"]);
    expect(custom.plugins).toEqual(["@example/plugin"]);
    expect(custom.parsers).toEqual({ openapi: false });
    // Fields not provided still get their defaults.
    expect(custom.include).toEqual([]);
  });

  it("loadOntolyConfig returns a resolved config even when no config file is present", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-context-config-"));
    const config = await loadOntolyConfig(root);

    // The returned type is ResolvedOntolyConfig — every array/record field
    // must be present without needing `?? []` at readers.
    expect(config.include).toEqual([]);
    expect(config.exclude).toEqual([]);
    expect(config.plugins).toEqual([]);
    expect(config.parsers).toEqual({});
  });

  it("context.config carries the resolved shape so callsites can drop the `?? []` fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-context-resolved-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
    const invocation = await createCompilerInvocation({ root, mode: "dry-run" });
    const context = await createCompilerContext({
      invocation,
      config: { exclude: ["Pods"] },
    });

    expect(context.config.exclude).toEqual(["Pods"]);
    // The other array/record fields must still be resolved to defaults even
    // though the caller only supplied `exclude`.
    expect(context.config.include).toEqual([]);
    expect(context.config.plugins).toEqual([]);
    expect(context.config.parsers).toEqual({});
  });
});
