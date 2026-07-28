import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeTypeScriptProject,
  clearTypeScriptProgramCache,
  deserializeTypeScriptProject,
  serializeTypeScriptProject,
  sourceLanguageForPath,
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

  it("resolves method calls with TypeScript symbols", async () => {
    const root = await createCallResolutionFixture();
    const project = analyzeTypeScriptProject({
      root,
      files: ["src/base.ts", "src/repository.ts", "src/service.ts"],
    });
    const callsByExpression = new Map(project.calls.map((call) => [call.expression, call.targetId]));

    expect(callsByExpression.get("this.validate")).toBe("method:src/service.ts:UserService.validate");
    expect(callsByExpression.get("this.repository.save")).toBe("method:src/repository.ts:UserRepository.save");
    expect(callsByExpression.get("super.audit")).toBe("method:src/base.ts:BaseWorkflow.audit");
    expect(callsByExpression.get("this.finalize")).toBe("method:src/service.ts:UserService.finalize");
    expect(callsByExpression.get("this.repository.find")).toBe("method:src/repository.ts:UserRepository.find");
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

  it("reuses the incremental builder while observing changed source", async () => {
    clearTypeScriptProgramCache();
    const root = await createFixture();
    const files = ["src/types.ts", "src/service.ts"];
    const first = analyzeTypeScriptProject({ root, files });

    await writeFile(
      join(root, "src", "service.ts"),
      "export class UpdatedService { status(): string { return 'ready'; } }\n",
      "utf8",
    );
    const second = analyzeTypeScriptProject({ root, files });

    expect(first.classes.map((item) => item.name)).toContain("UserService");
    expect(second.classes.map((item) => item.name)).toContain("UpdatedService");
    expect(second.classes.map((item) => item.name)).not.toContain("UserService");
    clearTypeScriptProgramCache();
  });

  it("analyzes JavaScript, JSX, ESM, and CommonJS as one semantic project", async () => {
    const root = await createJavaScriptFixture();
    const project = analyzeTypeScriptProject({ root });
    const calls = new Map(project.calls.map((call) => [`${call.ownerId}:${call.expression}`, call.targetId]));

    expect(project.files.map((file) => file.file)).toEqual([
      "src/app.jsx",
      "src/consumer.cjs",
      "src/facade.cjs",
      "src/formatter.cjs",
      "src/math.js",
      "src/service.mjs",
    ]);
    expect(project.functions.map((item) => item.name)).toEqual(expect.arrayContaining([
      "App",
      "average",
      "consume",
      "format",
      "loadFormatter",
      "parse",
      "summarize",
    ]));
    expect(project.imports.map((item) => [item.file, item.specifier])).toEqual(expect.arrayContaining([
      ["src/app.jsx", "./service.mjs"],
      ["src/app.jsx", "./formatter.cjs"],
      ["src/consumer.cjs", "./facade"],
      ["src/facade.cjs", "./math"],
      ["src/service.mjs", "./formatter.cjs"],
      ["src/service.mjs", "@lib/math.js"],
    ]));
    expect(project.exports.map((item) => [item.file, item.name, item.targetId])).toEqual(expect.arrayContaining([
      ["src/math.js", "default", "fn:src/math.js:average"],
      ["src/facade.cjs", "default", "fn:src/math.js:average"],
      ["src/formatter.cjs", "format", "fn:src/formatter.cjs:format"],
      ["src/formatter.cjs", "parse", "fn:src/formatter.cjs:parse"],
    ]));
    expect(calls.get("fn:src/service.mjs:summarize:average")).toBe("fn:src/math.js:average");
    expect(calls.get("fn:src/service.mjs:summarize:format")).toBe("fn:src/formatter.cjs:format");
    expect(calls.get("fn:src/formatter.cjs:parse:format")).toBe("fn:src/formatter.cjs:format");
    expect(calls.get("fn:src/consumer.cjs:consume:calculate")).toBe("fn:src/math.js:average");
    expect(sourceLanguageForPath("src/app.jsx")).toBe("javascript");
    expect(sourceLanguageForPath("src/service.ts")).toBe("typescript");
    expect(validateTypeScriptSemanticModel(project).ok).toBe(true);
  });

  it("allows callers to explicitly exclude JavaScript sources", async () => {
    const root = await createJavaScriptFixture();
    const project = analyzeTypeScriptProject({
      root,
      compilerOptions: { allowJs: false },
    });

    expect(project.files).toEqual([]);
  });

  it("resolves JavaScript class and instance method calls with compiler symbols", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-javascript-methods-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "calculator.js"),
      [
        "module.exports = class Calculator {",
        "  summarize(values) { return this.average(values); }",
        "  average(values) { return values.length; }",
        "};",
        "",
      ].join("\n"),
      "utf8",
    );

    const project = analyzeTypeScriptProject({ root });
    const call = project.calls.find((item) => item.expression === "this.average");

    expect(call?.ownerId).toBe("method:src/calculator.js:Calculator.summarize");
    expect(call?.targetId).toBe("method:src/calculator.js:Calculator.average");
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

async function createCallResolutionFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-typescript-calls-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "src", "base.ts"),
    [
      "export class BaseWorkflow {",
      "  protected audit(): string {",
      "    return 'audit';",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "repository.ts"),
    [
      "export class UserRepository {",
      "  save(): string { return 'saved'; }",
      "  find(): string { return 'found'; }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "service.ts"),
    [
      "import { BaseWorkflow } from './base';",
      "import { UserRepository } from './repository';",
      "",
      "export class UserService extends BaseWorkflow {",
      "  constructor(private readonly repository: UserRepository) {",
      "    super();",
      "  }",
      "",
      "  async update(): Promise<string> {",
      "    await this.validate();",
      "    return this.repository.save();",
      "  }",
      "",
      "  protected validate(): string {",
      "    super.audit();",
      "    return this.finalize();",
      "  }",
      "",
      "  private finalize(): string {",
      "    return this.repository.find();",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}

async function createJavaScriptFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-javascript-model-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "jsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@lib/*": ["src/*"],
        },
      },
    }),
    "utf8",
  );
  await writeFile(
    join(root, "src", "math.js"),
    [
      "function average(values) {",
      "  return values.reduce((total, value) => total + value, 0) / values.length;",
      "}",
      "module.exports = average;",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "formatter.cjs"),
    [
      "function format(value) { return String(value); }",
      "exports.format = format;",
      "module.exports.parse = (value) => format(Number(value));",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "facade.cjs"),
    "module.exports = require('./math');\n",
    "utf8",
  );
  await writeFile(
    join(root, "src", "consumer.cjs"),
    [
      "const calculate = require('./facade');",
      "function consume(values) { return calculate(values); }",
      "exports.consume = consume;",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "service.mjs"),
    [
      "import average from '@lib/math.js';",
      "import { format } from './formatter.cjs';",
      "export function summarize(values) {",
      "  return format(average(values));",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "app.jsx"),
    [
      "import { summarize } from './service.mjs';",
      "export const App = () => <output>{summarize([1, 2, 3])}</output>;",
      "export const loadFormatter = () => import('./formatter.cjs');",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}
