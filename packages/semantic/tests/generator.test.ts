import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeTypeScriptProject } from "@0xsarwagya/ontoly-typescript";
import {
  createDefaultFrameworkRegistry,
  generateCompilerArtifacts,
} from "../src/index";

describe("semantic generator", () => {
  it("detects frameworks through the registry", async () => {
    const root = await createNestFixture();
    const project = analyzeTypeScriptProject({
      root,
      files: ["src/app.controller.ts", "src/app.module.ts"],
    });
    const detections = createDefaultFrameworkRegistry().detect(project);

    expect(detections.find((detection) => detection.framework === "NestJS")).toMatchObject({
      detected: true,
      analyzerVersion: "1.0.0",
    });
  });

  it("turns NestJS semantic facts into compiler artifacts", async () => {
    const root = await createNestFixture();
    const project = analyzeTypeScriptProject({
      root,
      files: ["src/app.controller.ts", "src/app.module.ts"],
    });
    const artifacts = generateCompilerArtifacts({ project });
    const symbols = artifacts.symbols.map((symbol) => symbol.id);
    const relationships = artifacts.relationships.map((relationship) => ({
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
    }));

    expect(artifacts.facts.map((fact) => fact.kind)).toEqual(expect.arrayContaining([
      "ControllerDeclared",
      "RouteDeclared",
      "ModuleDeclared",
    ]));
    expect(symbols).toEqual(expect.arrayContaining([
      "framework:NestJS",
      "controller:src/app.controller.ts:AppController",
      "route:GET:/app/health",
      "mod:src/app.module.ts:AppModule",
    ]));
    expect(relationships).toEqual(expect.arrayContaining([
      {
        type: "HANDLES",
        from: "route:GET:/app/health",
        to: "method:src/app.controller.ts:AppController.health",
      },
      {
        type: "DECLARES",
        from: "mod:src/app.module.ts:AppModule",
        to: "controller:src/app.controller.ts:AppController",
      },
    ]));
  });

  it("emits nodes for every framework semantic relationship target", async () => {
    const root = await createNestFixture();
    const project = analyzeTypeScriptProject({
      root,
      files: [
        "src/array.controller.ts",
        "src/app.controller.ts",
        "src/app.module.ts",
        "src/app.service.ts",
        "src/custom.decorators.ts",
        "src/external.service.ts",
        "src/other.module.ts",
        "src/simplified.controller.ts",
        "src/simplified.decorators.ts",
        "src/tokens.ts",
      ],
    });
    const artifacts = generateCompilerArtifacts({ project });
    const symbolIds = new Set(artifacts.symbols.map((symbol) => symbol.id));
    const routeIds = artifacts.symbols.filter((symbol) => symbol.kind === "Route").map((symbol) => symbol.id);
    const relationships = artifacts.relationships.map((relationship) => ({
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
    }));
    const dangling = artifacts.relationships
      .filter((relationship) => !symbolIds.has(relationship.from) || !symbolIds.has(relationship.to))
      .map((relationship) => `${relationship.type}:${relationship.from}->${relationship.to}`);

    expect(dangling).toEqual([]);
    expect([...symbolIds]).toEqual(expect.arrayContaining([
      "mod:src/other.module.ts:OtherModule",
      "provider:KEY",
      "service:src/app.service.ts:AppService",
    ]));
    expect(routeIds).toEqual(expect.arrayContaining([
      "route:GET:/one/items",
      "route:GET:/two/items",
      "route:GET:/simplified/fhir/Patient",
      "route:GET:/simplified/fhir/Patient/:id",
      "route:POST:/simplified/fhir/Patient",
      "route:PUT:/simplified/fhir/Patient/:id",
      "route:DELETE:/simplified/fhir/Patient/:id",
    ]));
    expect(relationships).not.toContainEqual({
      type: "INJECTS",
      from: "class:src/external.service.ts:ExternalService",
      to: "pkg:external-lib",
    });
  });

  it("emits deterministic NestJS runtime topology", async () => {
    const root = await createNestRuntimeFixture();
    const project = analyzeTypeScriptProject({
      root,
      files: [
        "src/alert.entity.ts",
        "src/signals.gateway.ts",
        "src/signals.module.ts",
        "src/signals.processor.ts",
        "src/signals.scheduler.ts",
        "src/signals.service.ts",
      ],
    });
    const artifacts = generateCompilerArtifacts({ project });
    const symbolIds = new Set(artifacts.symbols.map((symbol) => symbol.id));
    const relationships = artifacts.relationships.map((relationship) => ({
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
    }));

    expect([...symbolIds]).toEqual(expect.arrayContaining([
      "provider:src/signals.processor.ts:SignalsProcessor",
      "provider:src/signals.gateway.ts:SignalsGateway",
      "provider:src/signals.scheduler.ts:SignalsScheduler",
      "service:src/signals.service.ts:SignalsService",
      "repo:AlertEntityRepository",
      "provider:Queue:signals",
      "model:AlertModel",
      "event:bullmq:signals:webhook",
      "event:cron:EVERY_5_MINUTES",
      "event:event:signals.alert",
      "event:websocket:signals.message",
    ]));
    expect(artifacts.facts.map((fact) => fact.kind)).toEqual(expect.arrayContaining([
      "RuntimeHandlerDeclared",
      "DependencyInjected",
      "ProviderDeclared",
    ]));
    expect(relationships).toEqual(expect.arrayContaining([
      {
        type: "HANDLES",
        from: "event:bullmq:signals:webhook",
        to: "method:src/signals.processor.ts:SignalsProcessor.process",
      },
      {
        type: "EXECUTES",
        from: "event:bullmq:signals:webhook",
        to: "provider:src/signals.processor.ts:SignalsProcessor",
      },
      {
        type: "CONTAINS",
        from: "provider:src/signals.processor.ts:SignalsProcessor",
        to: "method:src/signals.processor.ts:SignalsProcessor.process",
      },
      {
        type: "SUBSCRIBES",
        from: "provider:src/signals.processor.ts:SignalsProcessor",
        to: "event:bullmq:signals:webhook",
      },
      {
        type: "INJECTS",
        from: "provider:src/signals.processor.ts:SignalsProcessor",
        to: "service:src/signals.service.ts:SignalsService",
      },
      {
        type: "CALLS",
        from: "method:src/signals.processor.ts:SignalsProcessor.process",
        to: "method:src/signals.service.ts:SignalsService.handleSignalsAlert",
      },
      {
        type: "CALLS",
        from: "method:src/signals.service.ts:SignalsService.handleSignalsAlert",
        to: "method:src/signals.service.ts:SignalsService.clearDeviceDisconnectAlerts",
      },
      {
        type: "INJECTS",
        from: "service:src/signals.service.ts:SignalsService",
        to: "repo:AlertEntityRepository",
      },
      {
        type: "INJECTS",
        from: "service:src/signals.service.ts:SignalsService",
        to: "provider:Queue:signals",
      },
      {
        type: "INJECTS",
        from: "service:src/signals.service.ts:SignalsService",
        to: "model:AlertModel",
      },
      {
        type: "HANDLES",
        from: "event:cron:EVERY_5_MINUTES",
        to: "method:src/signals.scheduler.ts:SignalsScheduler.tick",
      },
      {
        type: "HANDLES",
        from: "event:event:signals.alert",
        to: "method:src/signals.scheduler.ts:SignalsScheduler.onAlert",
      },
      {
        type: "HANDLES",
        from: "event:websocket:signals.message",
        to: "method:src/signals.gateway.ts:SignalsGateway.onMessage",
      },
      {
        type: "PROVIDES",
        from: "mod:src/signals.module.ts:SignalsModule",
        to: "provider:src/signals.processor.ts:SignalsProcessor",
      },
    ]));
  });
});

async function createNestFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-semantic-nest-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        experimentalDecorators: true,
      },
    }),
    "utf8",
  );
  await writeFile(
    join(root, "src", "array.controller.ts"),
    [
      "import { Get } from '@nestjs/common';",
      "import { PublicController } from './custom.decorators';",
      "",
      "@PublicController({ path: ['one', 'two'], tag: 'Array' })",
      "export class ArrayController {",
      "  @Get('items')",
      "  items(): string {",
      "    return 'ok';",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "custom.decorators.ts"),
    [
      "export const PublicController = (_input: { path: string | string[]; tag: string }) => undefined;",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "app.controller.ts"),
    [
      "import { Controller, Get } from '@nestjs/common';",
      "",
      "@Controller('app')",
      "export class AppController {",
      "  @Get('health')",
      "  health(): string {",
      "    return 'ok';",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "app.module.ts"),
    [
      "import { Module } from '@nestjs/common';",
      "import { AppController } from './app.controller';",
      "import { AppService } from './app.service';",
      "import { OtherModule } from './other.module';",
      "import { KEY } from './tokens';",
      "",
      "@Module({",
      "  imports: [OtherModule],",
      "  controllers: [AppController],",
      "  providers: [AppService, { provide: KEY, useValue: 'value' }],",
      "  exports: [OtherModule, KEY, AppService],",
      "})",
      "export class AppModule {}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "external.service.ts"),
    [
      "import { Injectable } from '@nestjs/common';",
      "import { ExternalClient } from 'external-lib';",
      "",
      "@Injectable()",
      "export class ExternalService {",
      "  constructor(private readonly client: ExternalClient) {}",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "simplified.controller.ts"),
    [
      "import {",
      "  SimplifiedController as Controller,",
      "  SimplifiedDelete as Delete,",
      "  SimplifiedGet as Get,",
      "  SimplifiedPost as Post,",
      "  SimplifiedPut as Put,",
      "  SimplifiedSearch as Search,",
      "} from './simplified.decorators';",
      "",
      "@Controller('Patient')",
      "export class SimplifiedPatientController {",
      "  @Get(Object)",
      "  findOne(): string { return 'ok'; }",
      "",
      "  @Search(Array)",
      "  findAll(): string { return 'ok'; }",
      "",
      "  @Post(Object)",
      "  create(): string { return 'ok'; }",
      "",
      "  @Put(Object)",
      "  update(): string { return 'ok'; }",
      "",
      "  @Delete(Object)",
      "  delete(): string { return 'ok'; }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "simplified.decorators.ts"),
    [
      "export const SimplifiedController = (_resourceType: string) => undefined;",
      "export const SimplifiedDelete = (_type: unknown) => undefined;",
      "export const SimplifiedGet = (_type: unknown) => undefined;",
      "export const SimplifiedPost = (_type: unknown) => undefined;",
      "export const SimplifiedPut = (_type: unknown) => undefined;",
      "export const SimplifiedSearch = (_type: unknown) => undefined;",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "app.service.ts"),
    [
      "import { Inject, Injectable } from '@nestjs/common';",
      "import { KEY } from './tokens';",
      "",
      "@Injectable()",
      "export class AppService {",
      "  constructor(@Inject(KEY) private readonly value: string) {}",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "other.module.ts"),
    [
      "import { Module } from '@nestjs/common';",
      "",
      "@Module({})",
      "export class OtherModule {}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "tokens.ts"),
    [
      "export const KEY = 'KEY';",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}

async function createNestRuntimeFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ontoly-semantic-nest-runtime-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        experimentalDecorators: true,
      },
    }),
    "utf8",
  );
  await writeFile(
    join(root, "src", "alert.entity.ts"),
    [
      "export class AlertEntity {}",
      "export class AlertModel {",
      "  static name = 'AlertModel';",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "signals.service.ts"),
    [
      "import { Inject, Injectable } from '@nestjs/common';",
      "import { InjectQueue } from '@nestjs/bull';",
      "import { InjectModel } from '@nestjs/mongoose';",
      "import { InjectRepository } from '@nestjs/typeorm';",
      "import { AlertEntity, AlertModel } from './alert.entity';",
      "",
      "@Injectable()",
      "export class SignalsService {",
      "  constructor(",
      "    @InjectRepository(AlertEntity) private readonly alerts: unknown,",
      "    @InjectQueue('signals') private readonly queue: unknown,",
      "    @InjectModel(AlertModel.name) private readonly model: unknown,",
      "    @Inject('SIGNALS_TOKEN') private readonly token: unknown,",
      "  ) {}",
      "",
      "  handleSignalsAlert(_input: unknown): string {",
      "    return this.clearDeviceDisconnectAlerts();",
      "  }",
      "",
      "  clearDeviceDisconnectAlerts(): string {",
      "    return 'cleared';",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "signals.processor.ts"),
    [
      "import { Process, Processor } from '@nestjs/bull';",
      "import { SignalsService } from './signals.service';",
      "",
      "@Processor('signals')",
      "export class SignalsProcessor {",
      "  constructor(private readonly signals: SignalsService) {}",
      "",
      "  @Process('webhook')",
      "  async process(job: { data: unknown }): Promise<string> {",
      "    return this.signals.handleSignalsAlert(job.data);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "signals.scheduler.ts"),
    [
      "import { Injectable } from '@nestjs/common';",
      "import { OnEvent } from '@nestjs/event-emitter';",
      "import { Cron, CronExpression } from '@nestjs/schedule';",
      "import { SignalsService } from './signals.service';",
      "",
      "@Injectable()",
      "export class SignalsScheduler {",
      "  constructor(private readonly signals: SignalsService) {}",
      "",
      "  @Cron(CronExpression.EVERY_5_MINUTES)",
      "  tick(): string {",
      "    return this.signals.clearDeviceDisconnectAlerts();",
      "  }",
      "",
      "  @OnEvent('signals.alert')",
      "  onAlert(): string {",
      "    return this.signals.handleSignalsAlert({});",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "signals.gateway.ts"),
    [
      "import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';",
      "import { SignalsService } from './signals.service';",
      "",
      "@WebSocketGateway()",
      "export class SignalsGateway {",
      "  constructor(private readonly signals: SignalsService) {}",
      "",
      "  @SubscribeMessage('signals.message')",
      "  onMessage(): string {",
      "    return this.signals.handleSignalsAlert({});",
      "  }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "src", "signals.module.ts"),
    [
      "import { Module } from '@nestjs/common';",
      "import { SignalsGateway } from './signals.gateway';",
      "import { SignalsProcessor } from './signals.processor';",
      "import { SignalsScheduler } from './signals.scheduler';",
      "import { SignalsService } from './signals.service';",
      "",
      "@Module({",
      "  providers: [SignalsService, SignalsProcessor, SignalsScheduler, SignalsGateway],",
      "})",
      "export class SignalsModule {}",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}
