import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createCompilerContext,
  createCompilerInvocation,
  initializeOntolyProject,
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

  it("loads ontoly.config.ts from the repository root when no path is given", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-context-config-ts-"));
    await writeFile(
      join(root, "ontoly.config.ts"),
      'const exclude: string[] = ["Pods", "apps/agent/.eve"];\nexport default { exclude };\n',
      "utf8",
    );

    const config = await loadOntolyConfig(root);

    expect(config.exclude).toEqual(["Pods", "apps/agent/.eve"]);
  });

  it("loads the config `ontoly init` writes, though the CLI is not installed in the repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-context-config-init-"));
    await initializeOntolyProject(root);

    const config = await loadOntolyConfig(root);

    expect(config.outputDir).toBe(".ontoly");
    expect(config.exclude).toEqual([]);
  });

  it("warns and builds with the defaults when a config found in the root cannot be loaded", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-context-config-broken-"));
    await writeFile(join(root, "ontoly.config.mjs"), 'import "./missing.mjs";\nexport default { exclude: ["x"] };\n', "utf8");
    const emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);

    try {
      const config = await loadOntolyConfig(root);

      expect(config.exclude).toEqual([]);
      expect(emitWarning).toHaveBeenCalledWith(
        expect.stringContaining("Could not load"),
        expect.objectContaining({ code: "ONTOLY_CONFIG_NOT_LOADED" }),
      );
    } finally {
      emitWarning.mockRestore();
    }
  });

  it("throws when a config given by path cannot be loaded", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-context-config-explicit-"));
    await writeFile(join(root, "custom.config.mjs"), 'import "./missing.mjs";\nexport default {};\n', "utf8");

    await expect(loadOntolyConfig(root, "custom.config.mjs")).rejects.toThrow("Could not load");
  });
});
