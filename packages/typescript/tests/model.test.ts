import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeTypeScriptProject,
  deserializeTypeScriptProject,
  serializeTypeScriptProject,
  validateTypeScriptSemanticModel,
} from "../src/index";

describe("typescript semantic model", () => {
  it("captures language semantics without framework graph concepts", async () => {
    const root = await createFixture();
    const project = analyzeTypeScriptProject({
      root,
      files: ["src/types.ts", "src/service.ts"],
    });

    expect(project.files.map((file) => file.file)).toEqual(["src/service.ts", "src/types.ts"]);
    expect(project.classes.map((item) => item.name)).toContain("UserService");
    expect(project.interfaces.map((item) => item.name)).toContain("Loadable");
    expect(project.functions.map((item) => item.name)).toContain("helper");
    expect(project.methods.map((item) => item.name)).toContain("UserService.load");
    expect(project.imports[0]).toMatchObject({
      specifier: "@src/types",
      targetFile: "src/types.ts",
    });
    expect(project.decorators.map((decorator) => decorator.name)).toContain("Trace");
    expect(project.calls.map((call) => call.calleeName)).toContain("helper");
    expect(project.types.map((type) => type.name)).toContain("User");
    expect(project.symbols.map((symbol) => symbol.kind)).not.toContain("Route");
  });

  it("serializes, deserializes, and validates deterministically", async () => {
    const root = await createFixture();
    const project = analyzeTypeScriptProject({
      root,
      files: ["src/types.ts", "src/service.ts"],
    });
    const serialized = serializeTypeScriptProject(project);
    const roundTrip = deserializeTypeScriptProject(serialized);

    expect(roundTrip.metadata.deterministicHash).toBe(project.metadata.deterministicHash);
    expect(validateTypeScriptSemanticModel(roundTrip).ok).toBe(true);
  });

  it("ignores generated artifact and dev-server directories during automatic discovery", async () => {
    const root = await createFixture();
    await mkdir(join(root, ".artifacts", "prototype"), { recursive: true });
    await writeFile(join(root, ".artifacts", "prototype", "Generated.ts"), "export const generated = true;\n", "utf8");
    await mkdir(join(root, "downloads", "chat-1"), { recursive: true });
    await writeFile(join(root, "downloads", "chat-1", "App.tsx"), "export const downloaded = true;\n", "utf8");
    await mkdir(join(root, ".next", "server"), { recursive: true });
    await writeFile(join(root, ".next", "server", "page.tsx"), "export const generatedPage = true;\n", "utf8");

    const project = analyzeTypeScriptProject({ root });

    expect(project.files.map((file) => file.file)).toEqual(["src/service.ts", "src/types.ts"]);
  });
});

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-typescript-model-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@src/*": ["src/*"],
        },
        experimentalDecorators: true,
      },
    }),
    "utf8",
  );
  await writeFile(
    join(root, "src", "types.ts"),
    [
      "export interface User { id: string }",
      "export interface Loadable<T> { load(): T }",
      "export function helper(): User { return { id: '1' }; }",
      "export function Trace(): MethodDecorator { return () => undefined; }",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "service.ts"),
    [
      "import { Trace, helper, type Loadable, type User } from '@src/types';",
      "",
      "export class UserService implements Loadable<User> {",
      "  @Trace()",
      "  load(): User {",
      "    return helper();",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}
