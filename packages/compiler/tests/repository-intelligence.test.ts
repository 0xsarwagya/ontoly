import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSoftwareGraphWithArtifacts, createRepositoryIntelligencePass } from "../src/index";

describe("repository intelligence pass", () => {
  it("emits deterministic workspace, package, dependency, config, and environment facts", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-repository-intelligence-"));
    await mkdir(join(root, "apps", "api"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "@0xsarwagya/workspace",
        private: true,
        packageManager: "pnpm@10.15.1",
        scripts: { build: "turbo build" },
        dependencies: { express: "^5.0.0" },
        devDependencies: { turbo: "^2.0.0" },
      }, null, 2),
      "utf8",
    );
    await writeFile(join(root, "pnpm-workspace.yaml"), "packages:\n  - \"apps/*\"\n", "utf8");
    await writeFile(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext" } }, null, 2),
      "utf8",
    );
    await writeFile(join(root, "eslint.config.js"), "export default [];\n", "utf8");
    await writeFile(join(root, "apps", "api", "package.json"), JSON.stringify({ name: "@repo/api" }, null, 2), "utf8");
    await writeFile(join(root, "apps", "api", "eslint.config.js"), "export default [];\n", "utf8");
    await writeFile(join(root, ".env.example"), "DATABASE_URL=\n# ignored\nAPI_KEY=\n", "utf8");

    const result = await buildSoftwareGraphWithArtifacts({
      root,
      passes: [createRepositoryIntelligencePass()],
    });
    const graph = result.graph;

    expect(result.status).toBe("success");
    expect(graph?.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining(["Workspace", "Package", "Script", "Dependency", "Framework", "Configuration", "EnvironmentVariable", "BuildTarget"]),
    );
    expect(graph?.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "workspace:@0xsarwagya/workspace",
        "pkg:@0xsarwagya/workspace",
        "script:package.json:build",
        "dep:express",
        "framework:Express",
        "env:DATABASE_URL",
        "target:tsconfig.json:typescript",
      ]),
    );
    expect(graph?.edges.map((edge) => edge.type)).toEqual(
      expect.arrayContaining(["CONTAINS", "CONFIGURES", "DEPENDS_ON", "EXECUTES", "PROVIDES", "USES"]),
    );
    expect(graph?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CONFIGURES",
          from: "config:eslint.config.js:eslint.config.js",
          to: "pkg:@0xsarwagya/workspace",
        }),
        expect.objectContaining({
          type: "CONFIGURES",
          from: "config:apps/api/eslint.config.js:eslint.config.js",
          to: "pkg:@repo/api",
        }),
      ]),
    );
  });

  it("skips cross-file turbo dependsOn references (^task, pkg#task) instead of emitting dangling DEPENDS_ON edges", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-turbo-crosspkg-"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "@example/workspace",
        private: true,
        packageManager: "pnpm@10.15.1",
        devDependencies: { turbo: "^2.0.0" },
      }, null, 2),
      "utf8",
    );
    await writeFile(
      join(root, "turbo.json"),
      JSON.stringify({
        $schema: "https://turborepo.com/schema.json",
        tasks: {
          build: { dependsOn: ["^build"] },
          "lint:drift": { dependsOn: ["@example/shared#build"] },
          rootcheck: { dependsOn: ["//#format"] },
          typecheck: { dependsOn: ["build"] },
        },
      }, null, 2),
      "utf8",
    );

    const result = await buildSoftwareGraphWithArtifacts({
      root,
      passes: [createRepositoryIntelligencePass()],
    });

    expect(result.status).toBe("success");

    const graph = result.graph;
    const dependsOnEdges = graph?.edges.filter((edge) => edge.type === "DEPENDS_ON") ?? [];

    // Only same-file `typecheck → build` should produce a DEPENDS_ON edge.
    // The three cross-file dependencies (^build, @example/shared#build, //#format)
    // must not produce dangling edges to undeclared Task nodes.
    const turboDependsOn = dependsOnEdges.filter((edge) => edge.from.startsWith("task:turbo.json:"));
    expect(turboDependsOn).toHaveLength(1);
    expect(turboDependsOn[0]).toMatchObject({
      from: "task:turbo.json:turbo:typecheck",
      to: "task:turbo.json:turbo:build",
    });

    // The raw dependsOn list is preserved on the Task node's metadata for
    // downstream analysis, so the information is not lost.
    const lintDriftTask = graph?.nodes.find((node) => node.id === "task:turbo.json:turbo:lint:drift");
    expect(lintDriftTask?.metadata).toMatchObject({
      dependsOn: ["@example/shared#build"],
    });

    // No missing-edge-target diagnostics should be emitted for the cross-file
    // references — that's the specific failure mode being fixed.
    const missingTargets = graph?.diagnostics.filter((diag) =>
      diag.code === "GRAPH_VALIDATION_MISSING_EDGE_TARGET",
    ) ?? [];
    expect(missingTargets).toHaveLength(0);
  });
});
