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

  it("emits external Task stubs for cross-file turbo dependsOn references and links DEPENDS_ON edges to them", async () => {
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

    // The build must succeed with no MISSING_EDGE_TARGET diagnostics —
    // every DEPENDS_ON edge points at a declared Task node (real or stub).
    const missingTargets = graph?.diagnostics.filter((diag) =>
      diag.code === "GRAPH_VALIDATION_MISSING_EDGE_TARGET",
    ) ?? [];
    expect(missingTargets).toHaveLength(0);

    const turboDependsOn = (graph?.edges ?? []).filter(
      (edge) => edge.type === "DEPENDS_ON" && edge.from.startsWith("task:turbo.json:"),
    );
    // Four turbo tasks with dependsOn → four DEPENDS_ON edges.
    expect(turboDependsOn).toHaveLength(4);

    // Same-file reference: no external marker on the edge.
    const typecheckEdge = turboDependsOn.find((edge) => edge.from === "task:turbo.json:turbo:typecheck");
    expect(typecheckEdge).toMatchObject({
      to: "task:turbo.json:turbo:build",
      metadata: { dependency: "build" },
    });
    expect(typecheckEdge?.metadata).not.toHaveProperty("external");

    // Upstream (`^task`) reference → stub Task with kind: 'upstream'.
    const upstreamStub = graph?.nodes.find((node) => node.id === "task:turbo.json:turbo-external:^build");
    expect(upstreamStub?.metadata).toMatchObject({
      external: true,
      kind: "upstream",
      task: "build",
    });
    const upstreamEdge = turboDependsOn.find((edge) => edge.from === "task:turbo.json:turbo:build");
    expect(upstreamEdge).toMatchObject({
      to: "task:turbo.json:turbo-external:^build",
      metadata: { dependency: "^build", external: true, kind: "upstream" },
    });

    // Cross-package (`pkg#task`) reference → stub with kind: 'cross-package' + package name.
    const crossPkgStub = graph?.nodes.find(
      (node) => node.id === "task:turbo.json:turbo-external:@example/shared#build",
    );
    expect(crossPkgStub?.metadata).toMatchObject({
      external: true,
      kind: "cross-package",
      package: "@example/shared",
      task: "build",
    });
    const crossPkgEdge = turboDependsOn.find((edge) => edge.from === "task:turbo.json:turbo:lint:drift");
    expect(crossPkgEdge).toMatchObject({
      to: "task:turbo.json:turbo-external:@example/shared#build",
      metadata: { dependency: "@example/shared#build", external: true, kind: "cross-package" },
    });

    // Root (`//#task`) reference → stub with kind: 'root'.
    const rootStub = graph?.nodes.find((node) => node.id === "task:turbo.json:turbo-external://#format");
    expect(rootStub?.metadata).toMatchObject({
      external: true,
      kind: "root",
      task: "format",
    });
    const rootEdge = turboDependsOn.find((edge) => edge.from === "task:turbo.json:turbo:rootcheck");
    expect(rootEdge).toMatchObject({
      to: "task:turbo.json:turbo-external://#format",
      metadata: { dependency: "//#format", external: true, kind: "root" },
    });

    // The raw dependsOn list is still preserved on the source Task node.
    const lintDriftTask = graph?.nodes.find((node) => node.id === "task:turbo.json:turbo:lint:drift");
    expect(lintDriftTask?.metadata).toMatchObject({
      dependsOn: ["@example/shared#build"],
    });
  });
});
