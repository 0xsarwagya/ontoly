import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSoftwareGraphWithArtifacts } from "@0xsarwagya/ontoly-compiler";
import {
  createTypeScriptFrontendPass,
  parseTypeScriptFrontend,
  TYPESCRIPT_FRONTEND_NAME,
} from "../src/index";

describe("typescript frontend", () => {
  it("emits compiler symbols with deterministic IDs and source locations", async () => {
    const root = await createFixture();
    const result = parseTypeScriptFrontend({
      root,
      files: ["src/util.ts", "src/service.ts", "src/index.ts"],
    });
    const ids = result.symbols.map((symbol) => symbol.id);

    expect("nodes" in result).toBe(false);
    expect(result.fileCount).toBe(3);
    expect(ids).toContain("mod:src/util.ts");
    expect(ids).toContain("fn:src/util.ts:helper");
    expect(ids).toContain("iface:src/util.ts:User");
    expect(ids).toContain("class:src/service.ts:UserService");
    expect(ids).toContain("fn:src/index.ts:main");
    expect(ids).toContain("fn:src/index.ts:lazy");
    expect(ids).toContain("fn:src/util.ts:schema");
    expect(ids).toContain("pkg:zod");
    expect(ids).toContain("export:src/util.ts:helper");
    expect(ids).toContain("export:src/service.ts:UserService");
    expect(ids).toContain("method:src/service.ts:UserService.load");

    const helper = result.symbols.find((symbol) => symbol.id === "fn:src/util.ts:helper");
    expect(helper).toMatchObject({
      kind: "Function",
      name: "helper",
      file: "src/util.ts",
      language: "typescript",
      span: {
        file: "src/util.ts",
        startLine: 3,
        startColumn: 1,
      },
    });
    expect(helper?.metadata).toMatchObject({
      exported: true,
      parameters: 0,
    });

    const serviceImport = result.symbols.find(
      (symbol) => symbol.kind === "Import" && symbol.file === "src/service.ts",
    );
    expect(serviceImport).toMatchObject({
      kind: "Import",
      name: "./util",
      metadata: {
        specifier: "./util",
        namedBindings: ["helper", "type User"],
      },
    });

    const userExport = result.symbols.find((symbol) => symbol.id === "export:src/util.ts:User");
    expect(userExport).toMatchObject({
      kind: "Export",
      name: "User",
      metadata: {
        exportKind: "type",
        declarationKind: "interface",
      },
    });
  });

  it("reports TypeScript parse diagnostics as compiler diagnostics", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-parser-diagnostic-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "broken.ts"), "export function broken( {\n", "utf8");

    const result = parseTypeScriptFrontend({
      root,
      files: ["src/broken.ts"],
    });

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
      span: {
        file: "src/broken.ts",
      },
      metadata: {
        parser: TYPESCRIPT_FRONTEND_NAME,
      },
    });
  });

  it("emits compiler relationships for imports, exports, calls, and containment", async () => {
    const root = await createFixture();
    const result = parseTypeScriptFrontend({
      root,
      files: ["src/util.ts", "src/service.ts", "src/index.ts"],
    });
    const relationships = result.relationships.map((relationship) => ({
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
    }));

    expect(relationships).toContainEqual({
      type: "IMPORTS",
      from: "mod:src/service.ts",
      to: "mod:src/util.ts",
    });
    expect(relationships).toContainEqual({
      type: "EXPORTS",
      from: "mod:src/util.ts",
      to: "fn:src/util.ts:helper",
    });
    expect(relationships).toContainEqual({
      type: "CALLS",
      from: "method:src/service.ts:UserService.load",
      to: "fn:src/util.ts:helper",
    });
    expect(relationships).toContainEqual({
      type: "CALLS",
      from: "fn:src/util.ts:schema",
      to: "pkg:zod",
    });
    expect(relationships).toContainEqual({
      type: "CONTAINS",
      from: "class:src/service.ts:UserService",
      to: "method:src/service.ts:UserService.load",
    });
  });

  it("emits deterministic semantic relationships for TypeScript and Express code", async () => {
    const root = await createSemanticFixture();
    const result = parseTypeScriptFrontend({
      root,
      files: ["src/auth.ts", "src/service.ts", "src/api.ts"],
    });
    const ids = result.symbols.map((symbol) => symbol.id);
    const relationships = result.relationships.map((relationship) => ({
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
    }));

    expect(ids).toEqual(expect.arrayContaining([
      "type:src/auth.ts:MaybeUser",
      "enum:src/auth.ts:Role",
      "ns:src/auth.ts:AuthConfig",
      "class:src/service.ts:UserService",
      "repo:src/service.ts:UserRepository",
      "service:src/service.ts:UserService",
      "framework:Express",
      "route:GET:/users",
      "env:DATABASE_URL",
      "exception:Error",
    ]));
    expect(relationships).toEqual(expect.arrayContaining([
      {
        type: "EXTENDS",
        from: "class:src/service.ts:UserService",
        to: "class:src/auth.ts:BaseService",
      },
      {
        type: "IMPLEMENTS",
        from: "class:src/service.ts:UserService",
        to: "iface:src/auth.ts:Loadable",
      },
      {
        type: "INJECTS",
        from: "class:src/service.ts:UserService",
        to: "repo:src/service.ts:UserRepository",
      },
      {
        type: "READS",
        from: "fn:src/auth.ts:handler",
        to: "env:DATABASE_URL",
      },
      {
        type: "THROWS",
        from: "fn:src/auth.ts:handler",
        to: "exception:Error",
      },
      {
        type: "HANDLES",
        from: "route:GET:/users",
        to: "fn:src/auth.ts:handler",
      },
      {
        type: "REGISTERED_IN",
        from: "route:GET:/users",
        to: "framework:Express",
      },
    ]));
    expect(result.relationships.find((relationship) => relationship.type === "AUTHORIZES")).toMatchObject({
      to: "route:GET:/users",
    });
    expect(result.relationships.every((relationship) => relationship.evidence && relationship.evidence.length > 0)).toBe(true);
  });

  it("extracts NestJS controllers, routes, modules, and normalized DI targets", async () => {
    const root = await createNestFixture();
    const result = parseTypeScriptFrontend({
      root,
      files: [
        "src/custom-decorators.ts",
        "src/context/context.service.ts",
        "src/auth.guard.ts",
        "src/users.service.ts",
        "src/users.controller.ts",
        "src/users.module.ts",
      ],
    });
    const ids = result.symbols.map((symbol) => symbol.id);
    const relationships = result.relationships.map((relationship) => ({
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
    }));

    expect(ids).toEqual(expect.arrayContaining([
      "framework:NestJS",
      "app:NestJS Application",
      "controller:src/users.controller.ts:UsersController",
      "provider:src/users.service.ts:UsersService",
      "service:src/users.service.ts:UsersService",
      "mod:src/users.module.ts:UsersModule",
      "route:GET:/users/live",
      "route:POST:/users",
      "provider:TOKEN",
    ]));
    expect(relationships).toEqual(expect.arrayContaining([
      {
        type: "HANDLES",
        from: "route:GET:/users/live",
        to: "method:src/users.controller.ts:UsersController.live",
      },
      {
        type: "MOUNTS",
        from: "controller:src/users.controller.ts:UsersController",
        to: "route:GET:/users/live",
      },
      {
        type: "DECLARES",
        from: "mod:src/users.module.ts:UsersModule",
        to: "controller:src/users.controller.ts:UsersController",
      },
      {
        type: "PROVIDES",
        from: "mod:src/users.module.ts:UsersModule",
        to: "service:src/users.service.ts:UsersService",
      },
      {
        type: "INJECTS",
        from: "class:src/users.controller.ts:UsersController",
        to: "service:src/users.service.ts:UsersService",
      },
      {
        type: "INJECTS",
        from: "class:src/users.controller.ts:UsersController",
        to: "provider:TOKEN",
      },
    ]));
    expect(ids).not.toContain("route:GET:/not-a-route");
  });

  it("participates in the compiler pipeline and emits graph relationships", async () => {
    const root = await createFixture();

    const result = await buildSoftwareGraphWithArtifacts({
      root,
      passes: [createTypeScriptFrontendPass()],
    });

    expect(result.status).toBe("success");
    expect(result.graph?.edges.map((edge) => edge.type)).toEqual(
      expect.arrayContaining(["CALLS", "CONTAINS", "EXPORTS", "IMPORTS"]),
    );
    expect(result.graph?.metadata.parserVersions[TYPESCRIPT_FRONTEND_NAME]).toBeDefined();
    expect(result.graph?.nodes.map((node) => node.id)).toContain("fn:src/util.ts:helper");
    expect(result.graph?.nodes.map((node) => node.type)).toContain("Import");
    expect(result.graph?.nodes.map((node) => node.type)).toContain("Export");
  });
});

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-parser-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "src", "util.ts"),
    [
      "export interface User { id: string }",
      "import * as z from 'zod';",
      "export function helper(): User {",
      '  return { id: "1" };',
      "}",
      "export function schema() {",
      "  return z.object({ id: z.string() });",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "service.ts"),
    [
      'import { helper, type User } from "./util";',
      "",
      "export class UserService {",
      "  load(): User {",
      "    return helper();",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "index.ts"),
    [
      'import { UserService } from "./service";',
      'export { UserService } from "./service";',
      "",
      "const lazy = () => new UserService();",
      "",
      "export function main(): UserService {",
      "  return lazy();",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}

async function createSemanticFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-parser-semantic-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "src", "auth.ts"),
    [
      "export interface User { id: string }",
      "export interface Loadable { load(): User }",
      "export type MaybeUser = User | undefined;",
      "export enum Role { Admin = 'admin' }",
      "export namespace AuthConfig { export const enabled = true }",
      "export class BaseService { load(): User { return { id: 'base' }; } }",
      "export function requireUser(user: MaybeUser): User {",
      "  if (!user) throw new Error('missing');",
      "  return user;",
      "}",
      "export function requireAuth(_request: unknown, _response: unknown, next: () => void) {",
      "  next();",
      "}",
      "export function handler(): User {",
      "  if (!process.env.DATABASE_URL) {",
      "    throw new Error('missing database');",
      "  }",
      "  return requireUser({ id: '1' });",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "service.ts"),
    [
      "import { BaseService, type Loadable, type User, requireUser } from './auth';",
      "",
      "export class UserService extends BaseService implements Loadable {",
      "  constructor(private readonly repository: UserRepository) {",
      "    super();",
      "  }",
      "",
      "  load(): User {",
      "    return requireUser(this.repository.find());",
      "  }",
      "}",
      "",
      "export class UserRepository {",
      "  find(): User | undefined {",
      "    return { id: '1' };",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "api.ts"),
    [
      "import express from 'express';",
      "import { handler, requireAuth } from './auth';",
      "",
      "const app = express();",
      "app.get('/users', requireAuth, handler);",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}

async function createNestFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-parser-nest-"));
  await mkdir(join(root, "src", "context"), { recursive: true });
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
    join(root, "src", "custom-decorators.ts"),
    [
      "export function InternalController(_metadata: { path: string }): ClassDecorator {",
      "  return () => undefined;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "context", "context.service.ts"),
    [
      "export class ContextService {",
      "  get(_key: string): string {",
      "    return 'value';",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "auth.guard.ts"),
    [
      "export class AuthGuard {",
      "  canActivate(): boolean { return true; }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "users.service.ts"),
    [
      "import { Injectable } from '@nestjs/common';",
      "",
      "@Injectable()",
      "export class UsersService {",
      "  load(): string { return 'ok'; }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "users.controller.ts"),
    [
      "import { Get, Inject, Post, UseGuards } from '@nestjs/common';",
      "import { InternalController } from './custom-decorators';",
      "import { AuthGuard } from './auth.guard';",
      "import { ContextService } from '@src/context/context.service';",
      "import { UsersService } from '@src/users.service';",
      "",
      "@InternalController({ path: 'users' })",
      "export class UsersController {",
      "  constructor(",
      "    private readonly users: UsersService,",
      "    private readonly context: ContextService,",
      "    @Inject('TOKEN') private readonly token: unknown,",
      "  ) {}",
      "",
      "  @Get('live')",
      "  @UseGuards(AuthGuard)",
      "  live(): string {",
      "    this.context.get('/not-a-route');",
      "    return this.users.load();",
      "  }",
      "",
      "  @Post()",
      "  create(): string {",
      "    return 'created';",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "users.module.ts"),
    [
      "import { Module } from '@nestjs/common';",
      "import { UsersController } from './users.controller';",
      "import { UsersService } from './users.service';",
      "",
      "@Module({",
      "  controllers: [UsersController],",
      "  providers: [UsersService, { provide: 'TOKEN', useValue: 1 }],",
      "  exports: [UsersService],",
      "})",
      "export class UsersModule {}",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}
