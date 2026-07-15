import {
  createEdgeId,
  createNodeId,
  createSyntaxEvidence,
  stableHash,
  type EdgeEvidence,
  type JsonObject,
  type NodeType,
  type SoftwareGraphDiagnostic,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";
import type {
  CompilerRelationship,
  CompilerSymbol,
  CompilerSymbolKind,
} from "@0xsarwagya/ontoly-compiler";
import type {
  TypeScriptCall,
  TypeScriptClass,
  TypeScriptConstructorParameter,
  TypeScriptDecorator,
  TypeScriptExpression,
  TypeScriptImport,
  TypeScriptImportBinding,
  TypeScriptMethod,
  TypeScriptProject,
  TypeScriptSymbol,
} from "@0xsarwagya/ontoly-typescript";
import { TYPESCRIPT_ANALYZER_VERSION } from "@0xsarwagya/ontoly-typescript";

export const SEMANTIC_GENERATOR_VERSION = "1.0.0";

export interface DetectionResult {
  readonly framework: string;
  readonly detected: boolean;
  readonly confidence: "exact" | "inferred" | "low";
  readonly evidence: readonly string[];
  readonly analyzerId: string;
  readonly analyzerVersion: string;
  readonly coverage?: number | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface FrameworkAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly compatibleModelVersions: readonly string[];
  readonly detect: (project: TypeScriptProject) => DetectionResult;
  readonly analyze: (project: TypeScriptProject) => readonly SemanticFact[];
}

export interface FrameworkRegistry {
  readonly analyzers: readonly FrameworkAnalyzer[];
  readonly register: (analyzer: FrameworkAnalyzer) => FrameworkRegistry;
  readonly detect: (project: TypeScriptProject) => readonly DetectionResult[];
  readonly analyze: (project: TypeScriptProject) => readonly SemanticFact[];
}

export type SemanticFact =
  | ControllerDeclaredFact
  | RouteDeclaredFact
  | ModuleDeclaredFact
  | ProviderDeclaredFact
  | DependencyInjectedFact
  | RuntimeHandlerDeclaredFact
  | GuardRegisteredFact
  | MiddlewareRegisteredFact;

export interface BaseSemanticFact {
  readonly kind: string;
  readonly analyzerId: string;
  readonly framework: string;
  readonly confidence: EdgeEvidence["confidence"];
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface ControllerDeclaredFact extends BaseSemanticFact {
  readonly kind: "ControllerDeclared";
  readonly controllerId: string;
  readonly classId: string;
  readonly name: string;
  readonly file: string;
  readonly paths: readonly string[];
  readonly decorator: string;
}

export interface RouteDeclaredFact extends BaseSemanticFact {
  readonly kind: "RouteDeclared";
  readonly routeId: string;
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly file: string;
  readonly controllerId?: string | undefined;
  readonly classId?: string | undefined;
  readonly handlerId?: string | undefined;
  readonly mountedById: string;
  readonly controllerPath?: string | undefined;
  readonly methodPath?: string | undefined;
  readonly decorator?: string | undefined;
}

export interface ModuleDeclaredFact extends BaseSemanticFact {
  readonly kind: "ModuleDeclared";
  readonly moduleId: string;
  readonly classId: string;
  readonly name: string;
  readonly file: string;
  readonly imports: readonly SemanticTarget[];
  readonly controllers: readonly SemanticTarget[];
  readonly providers: readonly SemanticTarget[];
  readonly exports: readonly SemanticTarget[];
  readonly global: boolean;
}

export interface ProviderDeclaredFact extends BaseSemanticFact {
  readonly kind: "ProviderDeclared";
  readonly providerId: string;
  readonly name: string;
  readonly file?: string | undefined;
  readonly classId?: string | undefined;
  readonly providerKind: "alias" | "class" | "exception-filter" | "factory" | "resolver" | "token" | "value";
  readonly implementationId?: string | undefined;
  readonly factoryId?: string | undefined;
}

export interface DependencyInjectedFact extends BaseSemanticFact {
  readonly kind: "DependencyInjected";
  readonly fromClassId: string;
  readonly toId: string;
  readonly target?: SemanticTarget | undefined;
  readonly parameter: string;
  readonly token?: string | undefined;
}

export interface RuntimeHandlerDeclaredFact extends BaseSemanticFact {
  readonly kind: "RuntimeHandlerDeclared";
  readonly eventId: string;
  readonly eventName: string;
  readonly eventKind: "bullmq" | "cron" | "event" | "websocket";
  readonly file: string;
  readonly handlerId: string;
  readonly providerId?: string | undefined;
  readonly classId?: string | undefined;
  readonly decorator: string;
  readonly trigger?: string | undefined;
  readonly queue?: string | undefined;
}

export interface GuardRegisteredFact extends BaseSemanticFact {
  readonly kind: "GuardRegistered";
  readonly guardId: string;
  readonly name: string;
  readonly file: string;
  readonly targetId: string;
}

export interface MiddlewareRegisteredFact extends BaseSemanticFact {
  readonly kind: "MiddlewareRegistered";
  readonly middlewareId: string;
  readonly name: string;
  readonly file: string;
  readonly routeId: string;
  readonly authorization: boolean;
}

export interface SemanticTarget {
  readonly id: string;
  readonly name: string;
  readonly kind?: NodeType | undefined;
  readonly providerKind?: ProviderDeclaredFact["providerKind"] | undefined;
  readonly file?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}

interface NestRouteDefinition {
  readonly method: string;
  readonly paths: readonly string[];
}

export interface GenerateCompilerArtifactsInput {
  readonly project: TypeScriptProject;
  readonly registry?: FrameworkRegistry | undefined;
}

export interface GenerateCompilerArtifactsResult {
  readonly symbols: readonly CompilerSymbol[];
  readonly relationships: readonly CompilerRelationship[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly detections: readonly DetectionResult[];
  readonly facts: readonly SemanticFact[];
}

const HTTP_METHODS = new Set(["all", "delete", "get", "head", "options", "patch", "post", "put"]);
const NEST_ROUTE_DECORATORS: ReadonlyMap<string, string> = new Map([
  ["All", "ALL"],
  ["Delete", "DELETE"],
  ["Get", "GET"],
  ["Head", "HEAD"],
  ["Options", "OPTIONS"],
  ["Patch", "PATCH"],
  ["Post", "POST"],
  ["Put", "PUT"],
] as const);

export function createFrameworkRegistry(analyzers: readonly FrameworkAnalyzer[] = []): FrameworkRegistry {
  const registered = [...analyzers].sort(compareAnalyzers);

  return {
    analyzers: registered,
    register: (analyzer) => createFrameworkRegistry([...registered, analyzer]),
    detect: (project) => registered.map((analyzer) => analyzer.detect(project)).sort(compareDetections),
    analyze: (project) => registered
      .flatMap((analyzer) => analyzer.detect(project).detected ? analyzer.analyze(project) : [])
      .sort(compareFacts),
  };
}

export function createDefaultFrameworkRegistry(): FrameworkRegistry {
  return createFrameworkRegistry([
    createNestJsAnalyzer(),
    createHttpCallAnalyzer("express", "Express", "express"),
    createHttpCallAnalyzer("fastify", "Fastify", "fastify"),
    createHttpCallAnalyzer("hono", "Hono", "hono"),
    createPlaceholderAnalyzer("next", "Next.js", "frontend"),
    createPlaceholderAnalyzer("react", "React", "frontend"),
    createPlaceholderAnalyzer("@prisma/client", "Prisma", "database"),
  ]);
}

export function generateCompilerArtifacts(input: GenerateCompilerArtifactsInput): GenerateCompilerArtifactsResult {
  const registry = input.registry ?? createDefaultFrameworkRegistry();
  const detections = registry.detect(input.project);
  const facts = registry.analyze(input.project);
  const symbols = new Map<string, CompilerSymbol>();
  const relationships = new Map<string, CompilerRelationship>();

  addTypeScriptSymbols(input.project, symbols);
  addTypeScriptRelationships(input.project, symbols, relationships);
  addFrameworkDetections(detections, symbols);
  addSemanticFacts(input.project, facts, symbols, relationships);

  return {
    symbols: [...symbols.values()].sort(compareSymbols),
    relationships: [...relationships.values()].sort(compareRelationships),
    diagnostics: input.project.diagnostics,
    detections,
    facts,
  };
}

export function createNestJsAnalyzer(): FrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic:nestjs",
    name: "NestJS",
    version: "1.0.0",
    capabilities: [
      "controllers",
      "routes",
      "modules",
      "providers",
      "dependency-injection",
      "guards",
      "runtime-topology",
    ],
    compatibleModelVersions: ["1.0.0"],
    detect: (project) => {
      const packageEvidence = project.imports
        .filter((item) => ["@nestjs/common", "@nestjs/core"].includes(packageNameFromSpecifier(item.specifier)))
        .map((item) => item.specifier);
      const decoratorEvidence = project.decorators
        .filter((decorator) => ["Module", "Injectable", "Controller"].includes(decorator.name) || decorator.name.endsWith("Controller"))
        .map((decorator) => `@${decorator.name}`);
      const evidence = [...new Set([...packageEvidence, ...decoratorEvidence])].sort();

      return {
        framework: "NestJS",
        detected: evidence.length > 0,
        confidence: packageEvidence.length > 0 ? "exact" : "inferred",
        evidence,
        analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
        analyzerVersion: "1.0.0",
        coverage: evidence.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeNestJs(project),
  };
}

function createHttpCallAnalyzer(packageName: string, frameworkName: string, factoryName: string): FrameworkAnalyzer {
  const analyzerId = `@0xsarwagya/ontoly-semantic:${frameworkName.toLowerCase().replace(/\W+/g, "-")}`;

  return {
    id: analyzerId,
    name: frameworkName,
    version: "1.0.0",
    capabilities: ["framework-detection", "call-style-routes"],
    compatibleModelVersions: ["1.0.0"],
    detect: (project) => {
      const evidence = project.imports
        .filter((item) => packageNameFromSpecifier(item.specifier) === packageName)
        .map((item) => item.specifier)
        .sort();

      return {
        framework: frameworkName,
        detected: evidence.length > 0,
        confidence: "exact",
        evidence,
        analyzerId,
        analyzerVersion: "1.0.0",
        coverage: evidence.length > 0 ? 60 : 0,
        metadata: { packageName },
      };
    },
    analyze: (project) => analyzeHttpCallFramework(project, {
      analyzerId,
      frameworkName,
      packageName,
      factoryName,
    }),
  };
}

function createPlaceholderAnalyzer(packageName: string, frameworkName: string, category: string): FrameworkAnalyzer {
  const analyzerId = `@0xsarwagya/ontoly-semantic:${frameworkName.toLowerCase().replace(/\W+/g, "-")}`;

  return {
    id: analyzerId,
    name: frameworkName,
    version: "1.0.0",
    capabilities: ["framework-detection"],
    compatibleModelVersions: ["1.0.0"],
    detect: (project) => {
      const evidence = project.imports
        .filter((item) => packageNameFromSpecifier(item.specifier) === packageName)
        .map((item) => item.specifier)
        .sort();

      return {
        framework: frameworkName,
        detected: evidence.length > 0,
        confidence: "exact",
        evidence,
        analyzerId,
        analyzerVersion: "1.0.0",
        coverage: evidence.length > 0 ? 10 : 0,
        metadata: { packageName, category, placeholder: true },
      };
    },
    analyze: () => [],
  };
}

function addTypeScriptSymbols(project: TypeScriptProject, symbols: Map<string, CompilerSymbol>): void {
  for (const symbol of project.symbols) {
    addSymbol(symbols, compilerSymbolFromTypeScript(symbol));
  }

  for (const item of project.imports) {
    ensureImportTargetSymbol(symbols, item);
  }
}

function addTypeScriptRelationships(
  project: TypeScriptProject,
  symbols: Map<string, CompilerSymbol>,
  relationships: Map<string, CompilerRelationship>,
): void {
  const symbolById = new Map(project.symbols.map((symbol) => [symbol.id, symbol] as const));

  for (const symbol of project.symbols) {
    if (!symbol.file || symbol.kind === "Module") {
      continue;
    }

    const sourceFile = project.files.find((file) => file.file === symbol.file);

    if (!sourceFile) {
      continue;
    }

    if (symbol.kind === "Method") {
      continue;
    }

    const isImportOrExport = symbol.kind === "Import" || symbol.kind === "Export";
    addRelationship(relationships, withOptionalProperties({
      type: "CONTAINS" as const,
      from: sourceFile.id,
      to: symbol.id,
      evidence: evidence(symbol.span, isImportOrExport ? `module contains ${symbol.kind.toLowerCase()}` : `module contains ${symbol.kind}`),
    }, {
      metadata: isImportOrExport ? undefined : { ownerKind: "Module" },
    }));
  }

  for (const method of project.methods) {
    addRelationship(relationships, {
      type: "CONTAINS",
      from: method.classId,
      to: method.id,
      evidence: evidence(method.span, "class contains method"),
      metadata: { ownerKind: "Class" },
    });
  }

  for (const item of project.imports) {
    addRelationship(relationships, {
      type: "IMPORTS",
      from: item.moduleId,
      to: item.targetId,
      evidence: evidence(item.span, `imports ${item.specifier}`),
      metadata: {
        specifier: item.specifier,
        importNodeId: item.id,
      },
    });
  }

  for (const item of project.exports) {
    addRelationship(relationships, {
      type: "EXPORTS",
      from: item.moduleId,
      to: item.targetId ?? item.id,
      evidence: evidence(item.span, `exports ${item.name}`),
      metadata: {
        exportNodeId: item.id,
        name: item.name,
      },
    });
  }

  for (const decorator of project.decorators) {
    const decoratorId = createNodeId({ type: "Decorator", name: decorator.name });
    addSymbol(symbols, {
      id: decoratorId,
      kind: "Decorator",
      name: decorator.name,
      span: decorator.span,
      language: "typescript",
      metadata: {
        expression: decorator.expression,
      },
      provenance: provenance(),
    });
    addRelationship(relationships, {
      type: "DECORATES",
      from: decoratorId,
      to: decorator.targetId,
      evidence: evidence(decorator.span, `@${decorator.name} decorates target`),
    });
  }

  for (const item of project.heritage) {
    addRelationship(relationships, {
      type: item.relationship,
      from: item.from,
      to: item.to,
      evidence: evidence(item.span, `${item.relationship.toLowerCase()} heritage type`),
    });
  }

  for (const item of project.types) {
    addRelationship(relationships, {
      type: item.relationship,
      from: item.from,
      to: item.to,
      evidence: evidence(item.span, `${item.usage} references type`),
      metadata: { usage: item.usage },
    });
  }

  for (const call of project.calls) {
    if (!call.targetId || call.targetId === call.ownerId) {
      continue;
    }

    addRelationship(relationships, {
      type: "CALLS",
      from: call.ownerId,
      to: call.targetId,
      evidence: evidence(call.span, "calls target"),
    });
  }

  for (const item of project.creates) {
    addRelationship(relationships, {
      type: "CREATES",
      from: item.ownerId,
      to: item.targetId,
      evidence: evidence(item.span, "creates instance"),
    });
  }

  for (const item of project.throws) {
    const targetId = item.targetId ?? addExceptionSymbol(symbols, item.exceptionName, item.expressionSpan);
    addRelationship(relationships, {
      type: "THROWS",
      from: item.ownerId,
      to: targetId,
      evidence: evidence(item.span, "throws exception"),
    });
  }

  for (const access of project.environmentAccesses) {
    const envId = createNodeId({ type: "EnvironmentVariable", name: access.name });
    addSymbol(symbols, {
      id: envId,
      kind: "EnvironmentVariable",
      name: access.name,
      span: access.span,
      language: "typescript",
      metadata: {
        consumedIn: access.file,
      },
      provenance: provenance(),
    });
    addRelationship(relationships, {
      type: access.access === "write" ? "WRITES" : "READS",
      from: access.ownerId,
      to: envId,
      evidence: evidence(access.span, `accesses environment variable ${access.name}`),
    });
  }

  addArchitecturalRoles(project, symbolById, symbols, relationships);
  addConstructorDependencyRelationships(project, symbolById, symbols, relationships);
}

function addArchitecturalRoles(
  project: TypeScriptProject,
  symbolById: ReadonlyMap<string, TypeScriptSymbol>,
  symbols: Map<string, CompilerSymbol>,
  relationships: Map<string, CompilerRelationship>,
): void {
  for (const item of project.classes) {
    const roleKind = semanticRoleKind(item.name);

    if (!roleKind) {
      continue;
    }

    const roleId = createNodeId({ type: roleKind, file: item.file, name: item.name });
    const sourceFile = project.files.find((file) => file.file === item.file);
    addSymbol(symbols, {
      id: roleId,
      kind: roleKind,
      name: item.name,
      file: item.file,
      span: item.span,
      language: "typescript",
      metadata: {
        classId: item.id,
        deterministicSignature: `class-name-suffix:${roleKind}`,
      },
      provenance: provenance(),
    });
    addRelationship(relationships, {
      type: "REFERENCES",
      from: roleId,
      to: item.id,
      evidence: evidence(item.span, `${roleKind} role is implemented by class name suffix`, "inferred"),
      metadata: { roleKind },
    });

    if (sourceFile && symbolById.has(sourceFile.id)) {
      addRelationship(relationships, {
        type: "PROVIDES",
        from: sourceFile.id,
        to: roleId,
        evidence: evidence(item.span, `module provides ${roleKind}`, "inferred"),
        metadata: { roleKind },
      });
    }
  }
}

function addConstructorDependencyRelationships(
  project: TypeScriptProject,
  symbolById: ReadonlyMap<string, TypeScriptSymbol>,
  symbols: Map<string, CompilerSymbol>,
  relationships: Map<string, CompilerRelationship>,
): void {
  for (const constructor of project.constructors) {
    for (const parameter of constructor.parameters) {
      for (const targetId of parameter.targetIds) {
        if (targetId === constructor.classId) {
          continue;
        }

        if (targetId.startsWith("pkg:")) {
          continue;
        }

        const target = symbolById.get(targetId);

        if (target?.kind === "Package") {
          continue;
        }

        const normalizedTarget = target ? semanticRoleIdForSymbol(target, symbols) ?? targetId : targetId;
        addRelationship(relationships, {
          type: "INJECTS",
          from: constructor.classId,
          to: normalizedTarget,
          evidence: evidence(parameter.span, "constructor parameter type injects dependency"),
          metadata: {
            parameter: parameter.name,
          },
        });
      }
    }
  }
}

function addFrameworkDetections(detections: readonly DetectionResult[], symbols: Map<string, CompilerSymbol>): void {
  for (const detection of detections) {
    if (!detection.detected) {
      continue;
    }

    const frameworkId = createNodeId({ type: "Framework", name: detection.framework });
    addSymbol(symbols, {
      id: frameworkId,
      kind: "Framework",
      name: detection.framework,
      language: "typescript",
      metadata: {
        detectedBy: detection.analyzerId,
        analyzerVersion: detection.analyzerVersion,
        evidence: [...detection.evidence],
        confidence: detection.confidence,
        ...(detection.metadata ?? {}),
      },
      provenance: provenance(),
    });
  }
}

function addSemanticFacts(
  project: TypeScriptProject,
  facts: readonly SemanticFact[],
  symbols: Map<string, CompilerSymbol>,
  relationships: Map<string, CompilerRelationship>,
): void {
  const semanticRoleIdByClassId = semanticRoleIdsByClassId(project, facts);

  for (const fact of facts) {
    const frameworkId = createNodeId({ type: "Framework", name: fact.framework });

    if (fact.kind === "ControllerDeclared") {
      addSymbol(symbols, {
        id: fact.controllerId,
        kind: "Controller",
        name: fact.name,
        file: fact.file,
        span: fact.span,
        language: "typescript",
        metadata: {
          classId: fact.classId,
          framework: fact.framework,
          decorator: fact.decorator,
          path: fact.paths[0] ?? "/",
          paths: [...fact.paths],
          semanticFact: fact.kind,
          ...(fact.metadata ?? {}),
        },
        provenance: provenance(fact.analyzerId),
      });
      addRelationship(relationships, {
        type: "REFERENCES",
        from: fact.controllerId,
        to: fact.classId,
        evidence: evidence(fact.span, `${fact.decorator} decorator marks controller class`, fact.confidence),
      });
      continue;
    }

    if (fact.kind === "RouteDeclared") {
      addSymbol(symbols, {
        id: fact.routeId,
        kind: "Route",
        name: fact.name,
        file: fact.file,
        span: fact.span,
        language: "typescript",
        metadata: withOptionalProperties<JsonObject, JsonObject>({
          method: fact.method,
          path: fact.path,
          framework: fact.framework,
          controllerId: fact.controllerId,
          classId: fact.classId,
          methodId: fact.handlerId,
          semanticFact: fact.kind,
        }, {
          controllerPath: fact.controllerPath,
          methodPath: fact.methodPath,
          decorator: fact.decorator,
        }),
        provenance: provenance(fact.analyzerId),
      });
      addRelationship(relationships, {
        type: "EXPOSES",
        from: sourceModuleIdForFile(project, fact.file),
        to: fact.routeId,
        evidence: evidence(fact.span, "source module exposes HTTP route", fact.confidence),
        metadata: { method: fact.method, path: fact.path, framework: fact.framework },
      });
      addRelationship(relationships, {
        type: "MOUNTS",
        from: fact.mountedById,
        to: fact.routeId,
        evidence: evidence(fact.span, "semantic route mount"),
        metadata: { method: fact.method, path: fact.path },
      });

      if (fact.controllerId && fact.handlerId) {
        addRelationship(relationships, {
          type: "CONTAINS",
          from: fact.controllerId,
          to: fact.handlerId,
          evidence: evidence(fact.span, "controller contains route handler method"),
          metadata: { ownerKind: "Controller" },
        });
      }

      if (fact.controllerId) {
        addRelationship(relationships, {
          type: "BELONGS_TO",
          from: fact.routeId,
          to: fact.controllerId,
          evidence: evidence(fact.span, "route belongs to controller"),
          metadata: { method: fact.method, path: fact.path },
        });
      }

      if (fact.handlerId) {
        addRelationship(relationships, {
          type: "HANDLES",
          from: fact.routeId,
          to: fact.handlerId,
          evidence: evidence(fact.span, "route binds to handler"),
          metadata: { method: fact.method, path: fact.path },
        });
      }

      addRelationship(relationships, {
        type: "REGISTERED_IN",
        from: fact.routeId,
        to: frameworkId,
        evidence: evidence(fact.span, `route registered in ${fact.framework}`),
      });
      continue;
    }

    if (fact.kind === "ModuleDeclared") {
      const applicationId = createNodeId({ type: "Application", name: `${fact.framework} Application` });
      addSymbol(symbols, {
        id: applicationId,
        kind: "Application",
        name: `${fact.framework} Application`,
        span: fact.span,
        language: "typescript",
        metadata: { framework: fact.framework, semanticFact: "ApplicationDeclared" },
        provenance: provenance(fact.analyzerId),
      });
      addSymbol(symbols, {
        id: fact.moduleId,
        kind: "Module",
        name: fact.name,
        file: fact.file,
        span: fact.span,
        language: "typescript",
        metadata: {
          framework: fact.framework,
          moduleKind: "nestjs",
          classId: fact.classId,
          semanticFact: fact.kind,
          global: fact.global,
        },
        provenance: provenance(fact.analyzerId),
      });
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceModuleIdForFile(project, fact.file),
        to: fact.moduleId,
        evidence: evidence(fact.span, "source module contains framework module"),
        metadata: { ownerKind: "SourceModule" },
      });
      addRelationship(relationships, {
        type: "REFERENCES",
        from: fact.moduleId,
        to: fact.classId,
        evidence: evidence(fact.span, "framework module references module class"),
      });
      addRelationship(relationships, {
        type: "REGISTERED_IN",
        from: fact.moduleId,
        to: frameworkId,
        evidence: evidence(fact.span, "framework module registered in framework"),
      });
      addRelationship(relationships, {
        type: "CONTAINS",
        from: applicationId,
        to: fact.moduleId,
        evidence: evidence(fact.span, "application contains framework module", "inferred"),
        metadata: { ownerKind: "Application" },
      });

      for (const item of fact.imports) {
        ensureSemanticTargetSymbol(symbols, item);
        addRelationship(relationships, {
          type: "IMPORTS",
          from: fact.moduleId,
          to: item.id,
          evidence: evidence(item.span ?? fact.span, "framework module imports module"),
          metadata: { semanticFact: "ModuleImported" },
        });
      }

      for (const item of fact.controllers) {
        ensureSemanticTargetSymbol(symbols, item);
        addRelationship(relationships, {
          type: "DECLARES",
          from: fact.moduleId,
          to: item.id,
          evidence: evidence(item.span ?? fact.span, "framework module declares controller"),
          metadata: { semanticFact: "ControllerDeclared" },
        });
        addRelationship(relationships, {
          type: "REGISTERS",
          from: fact.moduleId,
          to: item.id,
          evidence: evidence(item.span ?? fact.span, "framework module registers controller"),
          metadata: { semanticFact: "ControllerRegistered" },
        });
      }

      for (const item of fact.providers) {
        ensureSemanticTargetSymbol(symbols, item);
        addRelationship(relationships, {
          type: "PROVIDES",
          from: fact.moduleId,
          to: item.id,
          evidence: evidence(item.span ?? fact.span, "framework module provides provider"),
          metadata: { semanticFact: "ProviderDeclared" },
        });
        addRelationship(relationships, {
          type: "REGISTERS",
          from: fact.moduleId,
          to: item.id,
          evidence: evidence(item.span ?? fact.span, "framework module registers provider"),
          metadata: { semanticFact: "ProviderRegistered" },
        });
      }

      for (const item of fact.exports) {
        ensureSemanticTargetSymbol(symbols, item);
        addRelationship(relationships, {
          type: "EXPORTS",
          from: fact.moduleId,
          to: item.id,
          evidence: evidence(item.span ?? fact.span, "framework module exports symbol"),
          metadata: { semanticFact: "ModuleExported" },
        });
      }

      if (fact.global) {
        addRelationship(relationships, {
          type: "PROVIDES",
          from: frameworkId,
          to: fact.moduleId,
          evidence: evidence(fact.span, "global framework module is provided by framework"),
          metadata: { global: true },
        });
      }

      continue;
    }

    if (fact.kind === "ProviderDeclared") {
      addSymbol(symbols, {
        id: fact.providerId,
        kind: fact.providerKind === "factory" ? "Factory" : "Provider",
        name: fact.name,
        file: fact.file,
        span: fact.span,
        language: "typescript",
        metadata: {
          framework: fact.framework,
          classId: fact.classId,
          providerKind: fact.providerKind,
          semanticFact: fact.kind,
          ...(fact.metadata ?? {}),
        },
        provenance: provenance(fact.analyzerId),
      });

      if (fact.classId) {
        addRelationship(relationships, {
          type: "REFERENCES",
          from: fact.providerId,
          to: fact.classId,
          evidence: evidence(fact.span, "framework provider references class"),
        });

        const roleId = semanticRoleIdByClassId.get(fact.classId);

        if (roleId && roleId !== fact.providerId) {
          addRelationship(relationships, {
            type: "PROVIDES",
            from: fact.providerId,
            to: roleId,
            evidence: evidence(fact.span, "framework provider exposes semantic role"),
            metadata: { semanticFact: fact.kind },
          });
        }
      }

      if (fact.implementationId && fact.implementationId !== fact.providerId) {
        addRelationship(relationships, {
          type: "REFERENCES",
          from: fact.providerId,
          to: fact.implementationId,
          evidence: evidence(fact.span, "provider references implementation"),
        });
      }

      continue;
    }

    if (fact.kind === "DependencyInjected") {
      if (fact.target) {
        ensureSemanticTargetSymbol(symbols, fact.target);
      } else {
        ensureSemanticTargetIdSymbol(symbols, fact.toId, fact.token, fact.span);
      }

      addRelationship(relationships, {
        type: "INJECTS",
        from: fact.fromClassId,
        to: fact.toId,
        evidence: evidence(fact.span, "framework dependency injection"),
        metadata: withOptionalProperties<JsonObject, JsonObject>({
          parameter: fact.parameter,
          semanticFact: fact.kind,
        }, {
          token: fact.token,
        }),
      });

      const roleId = semanticRoleIdByClassId.get(fact.fromClassId);

      if (roleId && roleId !== fact.fromClassId) {
        addRelationship(relationships, {
          type: "INJECTS",
          from: roleId,
          to: fact.toId,
          evidence: evidence(fact.span, "semantic role injects dependency"),
          metadata: withOptionalProperties<JsonObject, JsonObject>({
            parameter: fact.parameter,
            semanticFact: fact.kind,
          }, {
            token: fact.token,
          }),
        });
      }
      continue;
    }

    if (fact.kind === "RuntimeHandlerDeclared") {
      addSymbol(symbols, {
        id: fact.eventId,
        kind: "Event",
        name: fact.eventName,
        file: fact.file,
        span: fact.span,
        language: "typescript",
        metadata: withOptionalProperties<JsonObject, JsonObject>({
          framework: fact.framework,
          eventKind: fact.eventKind,
          handlerId: fact.handlerId,
          semanticFact: fact.kind,
          decorator: fact.decorator,
        }, {
          providerId: fact.providerId,
          classId: fact.classId,
          trigger: fact.trigger,
          queue: fact.queue,
        }),
        provenance: provenance(fact.analyzerId),
      });
      addRelationship(relationships, {
        type: "REGISTERED_IN",
        from: fact.eventId,
        to: frameworkId,
        evidence: evidence(fact.span, `${fact.eventKind} handler registered in ${fact.framework}`, fact.confidence),
      });
      addRelationship(relationships, {
        type: "HANDLES",
        from: fact.eventId,
        to: fact.handlerId,
        evidence: evidence(fact.span, `${fact.decorator} binds runtime event to handler`, fact.confidence),
        metadata: withOptionalProperties<JsonObject, JsonObject>({
          eventKind: fact.eventKind,
        }, {
          trigger: fact.trigger,
          queue: fact.queue,
        }),
      });
      addRelationship(relationships, {
        type: "EXECUTES",
        from: fact.eventId,
        to: fact.handlerId,
        evidence: evidence(fact.span, "runtime event executes handler", fact.confidence),
        metadata: { eventKind: fact.eventKind },
      });

      if (fact.providerId) {
        addRelationship(relationships, {
          type: "CONTAINS",
          from: fact.providerId,
          to: fact.handlerId,
          evidence: evidence(fact.span, "provider contains runtime handler method", fact.confidence),
          metadata: { ownerKind: "Provider", eventKind: fact.eventKind },
        });
        addRelationship(relationships, {
          type: "EXECUTES",
          from: fact.eventId,
          to: fact.providerId,
          evidence: evidence(fact.span, "runtime event executes provider", fact.confidence),
          metadata: { eventKind: fact.eventKind },
        });
        addRelationship(relationships, {
          type: "SUBSCRIBES",
          from: fact.providerId,
          to: fact.eventId,
          evidence: evidence(fact.span, "provider subscribes to runtime event", fact.confidence),
          metadata: { eventKind: fact.eventKind },
        });
        addRelationship(relationships, {
          type: "MOUNTS",
          from: fact.providerId,
          to: fact.eventId,
          evidence: evidence(fact.span, "provider mounts runtime handler", fact.confidence),
          metadata: { eventKind: fact.eventKind },
        });
      }

      continue;
    }

    if (fact.kind === "GuardRegistered") {
      addSymbol(symbols, {
        id: fact.guardId,
        kind: "Guard",
        name: fact.name,
        file: fact.file,
        span: fact.span,
        language: "typescript",
        metadata: {
          targetId: fact.targetId,
          framework: fact.framework,
          semanticFact: fact.kind,
        },
        provenance: provenance(fact.analyzerId),
      });
      addRelationship(relationships, {
        type: "AUTHORIZES",
        from: fact.guardId,
        to: fact.targetId,
        evidence: evidence(fact.span, "guard authorizes target"),
      });
      continue;
    }

    if (fact.kind === "MiddlewareRegistered") {
      addSymbol(symbols, {
        id: fact.middlewareId,
        kind: "Middleware",
        name: fact.name,
        file: fact.file,
        span: fact.span,
        language: "typescript",
        metadata: {
          framework: fact.framework,
          authorization: fact.authorization,
          semanticFact: fact.kind,
        },
        provenance: provenance(fact.analyzerId),
      });
      addRelationship(relationships, {
        type: "USES",
        from: fact.routeId,
        to: fact.middlewareId,
        evidence: evidence(fact.span, "route uses middleware"),
      });

      if (fact.authorization) {
        addRelationship(relationships, {
          type: "AUTHORIZES",
          from: fact.middlewareId,
          to: fact.routeId,
          evidence: evidence(fact.span, "middleware authorizes route", "inferred"),
        });
      }
    }
  }
}

function analyzeNestJs(project: TypeScriptProject): readonly SemanticFact[] {
  const indexes = createProjectIndexes(project);
  const facts: SemanticFact[] = [];
  const controllers = new Map<string, ControllerDeclaredFact>();
  const providers = new Map<string, ProviderDeclaredFact>();

  for (const item of project.classes) {
    const controllerDecorator = item.decorators.find((decorator) => isNestControllerDecoratorName(decorator.name));

    if (controllerDecorator) {
      const controllerId = createNodeId({ type: "Controller", file: item.file, name: item.name });
      const fact: ControllerDeclaredFact = {
        kind: "ControllerDeclared",
        analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
        framework: "NestJS",
        confidence: "exact",
        span: controllerDecorator.span,
        controllerId,
        classId: item.id,
        name: item.name,
        file: item.file,
        paths: controllerPathValues(indexes, item.file, controllerDecorator),
        decorator: controllerDecorator.name,
      };
      controllers.set(item.id, fact);
      facts.push(fact);
    }

    const providerDecorator = item.decorators.find((decorator) => isNestProviderDecoratorName(decorator.name));

    if (providerDecorator) {
      const fact = providerFactForClass(item, providerDecorator);
      providers.set(item.id, fact);
      facts.push(fact);
    }
  }

  for (const item of project.methods) {
    const controller = controllers.get(item.classId);
    const provider = providers.get(item.classId);

    if (provider) {
      facts.push(...runtimeHandlerFactsForMethod(item, provider));
    }

    if (controller) {
      for (const decorator of item.decorators) {
        const route = nestRouteDefinition(indexes, item.file, decorator);

        if (!route) {
          continue;
        }

        for (const controllerPath of controller.paths) {
          for (const methodPath of route.paths) {
            const path = joinRoutePaths(controllerPath, methodPath);
            const name = `${route.method}:${path}`;
            facts.push({
              kind: "RouteDeclared",
              analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
              framework: "NestJS",
              confidence: "exact",
              span: decorator.span,
              routeId: createNodeId({ type: "Route", name }),
              name,
              method: route.method,
              path,
              file: item.file,
              controllerId: controller.controllerId,
              classId: item.classId,
              handlerId: item.id,
              mountedById: controller.controllerId,
              controllerPath,
              methodPath: normalizeRoutePath(methodPath) ?? "/",
              decorator: decorator.name,
              metadata: { semanticFact: "RouteDeclared" },
            });
          }
        }
      }

      facts.push(...guardFactsForDecoratedTarget(item.decorators, item.id, item.file, "NestJS"));
      facts.push(...guardFactsForDecoratedTarget(item.decorators, controller.controllerId, item.file, "NestJS"));
    }
  }

  for (const controller of controllers.values()) {
    const classItem = indexes.classesById.get(controller.classId);

    if (classItem) {
      facts.push(...guardFactsForDecoratedTarget(classItem.decorators, controller.controllerId, classItem.file, "NestJS"));
    }
  }

  for (const constructor of project.constructors) {
    for (const parameter of constructor.parameters) {
      const explicit = parameter.decorators.find((decorator) => isNestInjectionDecoratorName(decorator.name));

      if (explicit) {
        const token = providerTokenName(explicit.arguments[0]) ?? parameter.typeName;
        const target = token ? resolveInjectedTarget(indexes, providers, explicit, token) : undefined;

        if (target) {
          facts.push({
            kind: "DependencyInjected",
            analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
            framework: "NestJS",
            confidence: "exact",
            span: explicit.span,
            fromClassId: constructor.classId,
            toId: target.id,
            target,
            parameter: parameter.name,
            token,
          });
        }

        continue;
      }

      for (const targetId of parameter.targetIds) {
        const target = resolveSemanticTargetById(indexes, targetId, providers);

        if (target) {
          facts.push({
            kind: "DependencyInjected",
            analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
            framework: "NestJS",
            confidence: "exact",
            span: parameter.span,
            fromClassId: constructor.classId,
            toId: target.id,
            target,
            parameter: parameter.name,
          });
        }
      }
    }
  }

  for (const item of project.classes) {
    const moduleDecorator = item.decorators.find((decorator) => decorator.name === "Module");

    if (!moduleDecorator) {
      continue;
    }

    const metadata = moduleMetadata(moduleDecorator);
    const moduleId = createNodeId({ type: "Module", file: item.file, name: item.name });
    facts.push({
      kind: "ModuleDeclared",
      analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
      framework: "NestJS",
      confidence: "exact",
      span: moduleDecorator.span,
      moduleId,
      classId: item.id,
      name: item.name,
      file: item.file,
      imports: metadata.imports.map((name) => resolveNestModuleTarget(indexes, name, moduleDecorator.span)),
      controllers: metadata.controllers
        .map((name) => resolveControllerTarget(indexes, name, controllers, moduleDecorator.span))
        .filter(isSemanticTarget),
      providers: metadata.providers
        .map((entry) => resolveProviderEntry(indexes, entry, providers, moduleDecorator.span))
        .filter(isSemanticTarget),
      exports: metadata.exports
        .map((entry) => resolveExportEntry(indexes, entry, controllers, providers, moduleDecorator.span))
        .filter(isSemanticTarget),
      global: item.decorators.some((decorator) => decorator.name === "Global"),
    });
  }

  return facts.sort(compareFacts);
}

function analyzeHttpCallFramework(
  project: TypeScriptProject,
  options: {
    readonly analyzerId: string;
    readonly frameworkName: string;
    readonly packageName: string;
    readonly factoryName: string;
  },
): readonly SemanticFact[] {
  const indexes = createProjectIndexes(project);
  const bindings = new Map<string, string>();
  const receivers = new Set<string>();
  const facts: SemanticFact[] = [];

  for (const item of project.imports.filter((item) => packageNameFromSpecifier(item.specifier) === options.packageName)) {
    if (item.defaultBinding) {
      bindings.set(item.defaultBinding, options.frameworkName);
    }

    if (item.namespaceBinding) {
      bindings.set(item.namespaceBinding, options.frameworkName);
    }

    for (const binding of item.namedBindings) {
      bindings.set(binding.localName, options.frameworkName);
    }
  }

  for (const variable of project.variables) {
    const callee = variable.initializerCalleeName;

    if (!callee) {
      continue;
    }

    const root = rootName(callee);
    const short = unqualifiedName(callee);

    if (
      bindings.has(root) ||
      bindings.has(short) ||
      short === options.factoryName ||
      short === "Router" ||
      callee.endsWith(".Router")
    ) {
      receivers.add(variable.name);
    }
  }

  for (const call of project.calls) {
    const methodName = call.methodName?.toLowerCase();

    if (!methodName || !HTTP_METHODS.has(methodName) || !call.receiverName || !receivers.has(call.receiverName)) {
      continue;
    }

    const path = normalizeRoutePath(call.arguments[0]?.literal);

    if (!path) {
      continue;
    }

    const method = methodName.toUpperCase();
    const routeName = `${method}:${path}`;
    const routeId = createNodeId({ type: "Route", name: routeName });
    const handler = routeHandlerTarget(indexes, call);
    facts.push({
      kind: "RouteDeclared",
      analyzerId: options.analyzerId,
      framework: options.frameworkName,
      confidence: "exact",
      span: call.span,
      routeId,
      name: routeName,
      method,
      path,
      file: call.file,
      handlerId: handler,
      mountedById: call.ownerId,
      metadata: { registeredBy: call.receiverName },
    });

    for (const middleware of call.arguments.slice(1, -1)) {
      const middlewareName = middleware.name;

      if (!middlewareName) {
        continue;
      }

      facts.push({
        kind: "MiddlewareRegistered",
        analyzerId: options.analyzerId,
        framework: options.frameworkName,
        confidence: "exact",
        span: call.span,
        middlewareId: createNodeId({ type: "Middleware", file: call.file, name: middlewareName }),
        name: middlewareName,
        file: call.file,
        routeId,
        authorization: isAuthorizationName(middlewareName),
      });
    }
  }

  return facts.sort(compareFacts);
}

function semanticRoleIdsByClassId(
  project: TypeScriptProject,
  facts: readonly SemanticFact[],
): ReadonlyMap<string, string> {
  const classById = new Map(project.classes.map((item) => [item.id, item] as const));
  const roles = new Map<string, string>();

  for (const fact of facts) {
    if (fact.kind === "ControllerDeclared") {
      roles.set(fact.classId, fact.controllerId);
      continue;
    }

    if (fact.kind !== "ProviderDeclared" || !fact.classId) {
      continue;
    }

    const classItem = classById.get(fact.classId);
    const roleKind = classItem ? semanticRoleKind(classItem.name) : undefined;
    const roleId = roleKind && classItem
      ? createNodeId({ type: roleKind, file: classItem.file, name: classItem.name })
      : fact.providerId;
    roles.set(fact.classId, roleId);
  }

  return roles;
}

function createProjectIndexes(project: TypeScriptProject) {
  const symbolsById = new Map(project.symbols.map((symbol) => [symbol.id, symbol] as const));
  const classesById = new Map(project.classes.map((item) => [item.id, item] as const));
  const classesByName = mapByName(project.classes);
  const methodsById = new Map(project.methods.map((item) => [item.id, item] as const));
  const importsByFile = groupBy(project.imports, (item) => item.file);

  return {
    project,
    symbolsById,
    classesById,
    classesByName,
    methodsById,
    importsByFile,
  };
}

function providerFactForClass(item: TypeScriptClass, decorator: TypeScriptDecorator): ProviderDeclaredFact {
  const providerKind = decorator.name === "Catch"
    ? "exception-filter"
    : decorator.name === "Resolver"
      ? "resolver"
      : "class";
  const queue = decorator.name === "Processor" ? providerTokenName(decorator.arguments[0]) : undefined;
  return {
    kind: "ProviderDeclared",
    analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
    framework: "NestJS",
    confidence: "exact",
    span: decorator.span,
    providerId: createNodeId({ type: "Provider", file: item.file, name: item.name }),
    name: item.name,
    file: item.file,
    classId: item.id,
    providerKind,
    metadata: withOptionalProperties<JsonObject, JsonObject>({
      decorator: decorator.name,
    }, {
      runtimeRole: providerRuntimeRole(decorator.name),
      queue,
    }),
  };
}

function runtimeHandlerFactsForMethod(
  item: TypeScriptMethod,
  provider: ProviderDeclaredFact,
): readonly RuntimeHandlerDeclaredFact[] {
  const facts: RuntimeHandlerDeclaredFact[] = [];
  const queue = typeof provider.metadata?.queue === "string" ? provider.metadata.queue : undefined;

  for (const decorator of item.decorators) {
    const runtime = runtimeHandlerDefinition(decorator, queue);

    if (!runtime) {
      continue;
    }

    facts.push({
      kind: "RuntimeHandlerDeclared",
      analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
      framework: "NestJS",
      confidence: "exact",
      span: decorator.span,
      eventId: runtime.eventId,
      eventName: runtime.eventName,
      eventKind: runtime.eventKind,
      file: item.file,
      handlerId: item.id,
      providerId: provider.providerId,
      classId: item.classId,
      decorator: decorator.name,
      trigger: runtime.trigger,
      queue,
      metadata: { semanticFact: "RuntimeHandlerDeclared" },
    });
  }

  return facts;
}

interface RuntimeHandlerDefinition {
  readonly eventId: string;
  readonly eventName: string;
  readonly eventKind: RuntimeHandlerDeclaredFact["eventKind"];
  readonly trigger?: string | undefined;
}

function providerRuntimeRole(decoratorName: string): string | undefined {
  switch (decoratorName) {
    case "Processor":
      return "bullmq-processor";
    case "Resolver":
      return "graphql-resolver";
    case "WebSocketGateway":
      return "websocket-gateway";
    case "Catch":
      return "exception-filter";
    default:
      return undefined;
  }
}

function runtimeHandlerDefinition(
  decorator: TypeScriptDecorator,
  queue: string | undefined,
): RuntimeHandlerDefinition | undefined {
  const trigger = runtimeTriggerName(decorator.arguments[0]) ?? "default";

  switch (decorator.name) {
    case "Process":
      return {
        eventId: createNodeId({ type: "Event", name: `bullmq:${queue ?? "default"}:${trigger}` }),
        eventName: queue ? `BullMQ ${queue}:${trigger}` : `BullMQ ${trigger}`,
        eventKind: "bullmq",
        trigger,
      };
    case "Cron":
      return {
        eventId: createNodeId({ type: "Event", name: `cron:${trigger}` }),
        eventName: `Cron ${trigger}`,
        eventKind: "cron",
        trigger,
      };
    case "OnEvent":
      return {
        eventId: createNodeId({ type: "Event", name: `event:${trigger}` }),
        eventName: `Event ${trigger}`,
        eventKind: "event",
        trigger,
      };
    case "SubscribeMessage":
      return {
        eventId: createNodeId({ type: "Event", name: `websocket:${trigger}` }),
        eventName: `WebSocket ${trigger}`,
        eventKind: "websocket",
        trigger,
      };
    default:
      return undefined;
  }
}

function resolveInjectedTarget(
  indexes: ReturnType<typeof createProjectIndexes>,
  providers: ReadonlyMap<string, ProviderDeclaredFact>,
  decorator: TypeScriptDecorator,
  token: string,
): SemanticTarget | undefined {
  switch (decorator.name) {
    case "InjectRepository":
      return repositoryTargetForToken(token, decorator.span);
    case "InjectQueue":
      return queueProviderTargetForToken(token, decorator.span);
    case "InjectModel":
      return modelTargetForToken(token, decorator.span);
    case "Inject":
      return resolveSemanticTargetByName(indexes, token, providers) ?? providerTargetForToken(token, decorator.span);
    default:
      return resolveSemanticTargetByName(indexes, token, providers) ?? providerTargetForToken(token, decorator.span);
  }
}

function guardFactsForDecoratedTarget(
  decorators: readonly TypeScriptDecorator[],
  targetId: string,
  file: string,
  framework: string,
): readonly GuardRegisteredFact[] {
  const facts: GuardRegisteredFact[] = [];

  for (const decorator of decorators.filter((item) => item.name === "UseGuards")) {
    for (const argument of decorator.arguments) {
      const guardName = argument.name ?? argument.literal;

      if (!guardName) {
        continue;
      }

      facts.push({
        kind: "GuardRegistered",
        analyzerId: "@0xsarwagya/ontoly-semantic:nestjs",
        framework,
        confidence: "exact",
        span: decorator.span,
        guardId: createNodeId({ type: "Guard", file, name: `${guardName}:${targetId}` }),
        name: unqualifiedName(guardName),
        file,
        targetId,
      });
    }
  }

  return facts;
}

function moduleMetadata(decorator: TypeScriptDecorator): {
  readonly imports: readonly string[];
  readonly controllers: readonly string[];
  readonly providers: readonly string[];
  readonly exports: readonly string[];
} {
  const text = decorator.arguments[0]?.text ?? "";

  return {
    imports: extractArrayProperty(text, "imports").map(unwrapForwardRefName).filter(Boolean),
    controllers: extractArrayProperty(text, "controllers").map(unwrapForwardRefName).filter(Boolean),
    providers: extractArrayProperty(text, "providers"),
    exports: extractArrayProperty(text, "exports"),
  };
}

function resolveNestModuleTarget(indexes: ReturnType<typeof createProjectIndexes>, name: string, span: SourceSpan | undefined): SemanticTarget {
  const className = unqualifiedName(name);
  const classItem = indexes.classesByName.get(className)?.[0];

  if (!classItem) {
    return { id: createNodeId({ type: "Module", name: className }), name: className, kind: "Module", span };
  }

  return {
    id: createNodeId({ type: "Module", file: classItem.file, name: classItem.name }),
    name: classItem.name,
    kind: "Module",
    file: classItem.file,
    span,
  };
}

function resolveControllerTarget(
  indexes: ReturnType<typeof createProjectIndexes>,
  name: string,
  controllers: ReadonlyMap<string, ControllerDeclaredFact>,
  span: SourceSpan | undefined,
): SemanticTarget | undefined {
  const className = unqualifiedName(name);
  const classItem = indexes.classesByName.get(className)?.[0];

  if (!classItem) {
    return undefined;
  }

  const controller = controllers.get(classItem.id);
  const controllerId = controller?.controllerId ?? createNodeId({ type: "Controller", file: classItem.file, name: classItem.name });

  return {
    id: controllerId,
    name: classItem.name,
    kind: "Controller",
    file: classItem.file,
    span,
  };
}

function resolveProviderEntry(
  indexes: ReturnType<typeof createProjectIndexes>,
  entry: string,
  providers: ReadonlyMap<string, ProviderDeclaredFact>,
  span: SourceSpan | undefined,
): SemanticTarget | undefined {
  const objectProvider = parseObjectProvider(entry);

  if (objectProvider) {
    return objectProviderTarget(indexes, objectProvider, span);
  }

  const className = unqualifiedName(unwrapForwardRefName(entry));
  const classItem = indexes.classesByName.get(className)?.[0];

  if (!classItem) {
    return providerTargetForToken(className, span);
  }

  return resolveSemanticTargetById(indexes, classItem.id, providers) ?? {
    id: createNodeId({ type: "Provider", file: classItem.file, name: classItem.name }),
    name: classItem.name,
    kind: "Provider",
    file: classItem.file,
    providerKind: "class",
    span,
    metadata: { classId: classItem.id },
  };
}

function resolveExportEntry(
  indexes: ReturnType<typeof createProjectIndexes>,
  entry: string,
  controllers: ReadonlyMap<string, ControllerDeclaredFact>,
  providers: ReadonlyMap<string, ProviderDeclaredFact>,
  span: SourceSpan | undefined,
): SemanticTarget | undefined {
  return resolveProviderEntry(indexes, entry, providers, span)
    ?? resolveControllerTarget(indexes, entry, controllers, span)
    ?? resolveNestModuleTarget(indexes, entry, span);
}

function objectProviderTarget(
  indexes: ReturnType<typeof createProjectIndexes>,
  provider: ParsedObjectProvider,
  span: SourceSpan | undefined,
): SemanticTarget {
  const token = provider.provide;
  const providerKind = provider.useFactory
    ? "factory"
    : provider.useClass
      ? "class"
      : provider.useExisting
        ? "alias"
        : provider.useValue
          ? "value"
          : "token";
  const implementationName = provider.useClass ?? provider.useExisting;
  const implementationClass = implementationName
    ? indexes.classesByName.get(unqualifiedName(implementationName))?.[0]
    : undefined;

  return {
    id: createNodeId({ type: "Provider", name: token }),
    name: token,
    kind: "Provider",
    providerKind,
    span,
    metadata: withOptionalProperties<JsonObject, JsonObject>({
      providerKind,
      semanticFact: "ProviderDeclared",
    }, {
      implementationId: implementationClass?.id,
    }),
  };
}

function resolveSemanticTargetById(
  indexes: ReturnType<typeof createProjectIndexes>,
  targetId: string,
  providers: ReadonlyMap<string, ProviderDeclaredFact>,
): SemanticTarget | undefined {
  if (targetId.startsWith("pkg:")) {
    return undefined;
  }

  const classItem = indexes.classesById.get(targetId);

  if (!classItem) {
    const symbol = indexes.symbolsById.get(targetId);

    if (symbol?.kind === "Package") {
      return undefined;
    }

    return symbol ? { id: symbol.id, name: symbol.name, kind: symbol.kind, file: symbol.file, span: symbol.span } : undefined;
  }

  const roleKind = semanticRoleKind(classItem.name);

  if (roleKind) {
    return {
      id: createNodeId({ type: roleKind, file: classItem.file, name: classItem.name }),
      name: classItem.name,
      kind: roleKind,
      file: classItem.file,
      span: classItem.span,
    };
  }

  const provider = providers.get(classItem.id);

  if (provider) {
    return {
      id: provider.providerId,
      name: provider.name,
      kind: "Provider",
      file: provider.file,
      providerKind: provider.providerKind,
      span: provider.span,
    };
  }

  return {
    id: createNodeId({ type: "Provider", file: classItem.file, name: classItem.name }),
    name: classItem.name,
    kind: "Provider",
    file: classItem.file,
    providerKind: "class",
    span: classItem.span,
    metadata: { classId: classItem.id },
  };
}

function resolveSemanticTargetByName(
  indexes: ReturnType<typeof createProjectIndexes>,
  name: string,
  providers: ReadonlyMap<string, ProviderDeclaredFact>,
): SemanticTarget | undefined {
  const classItem = indexes.classesByName.get(unqualifiedName(name))?.[0];
  return classItem ? resolveSemanticTargetById(indexes, classItem.id, providers) : undefined;
}

function providerTargetForToken(token: string, span: SourceSpan | undefined): SemanticTarget {
  return {
    id: createNodeId({ type: "Provider", name: token }),
    name: token,
    kind: "Provider",
    providerKind: "token",
    span,
  };
}

function repositoryTargetForToken(token: string, span: SourceSpan | undefined): SemanticTarget {
  const name = repositoryNameForToken(token);
  return {
    id: createNodeId({ type: "Repository", name }),
    name,
    kind: "Repository",
    span,
    metadata: {
      injectionDecorator: "InjectRepository",
      token,
    },
  };
}

function queueProviderTargetForToken(token: string, span: SourceSpan | undefined): SemanticTarget {
  const name = `Queue:${cleanTokenName(token)}`;
  return {
    id: createNodeId({ type: "Provider", name }),
    name,
    kind: "Provider",
    providerKind: "token",
    span,
    metadata: {
      injectionDecorator: "InjectQueue",
      queue: cleanTokenName(token),
    },
  };
}

function modelTargetForToken(token: string, span: SourceSpan | undefined): SemanticTarget {
  const name = cleanTokenName(token);
  return {
    id: createNodeId({ type: "Model", name }),
    name,
    kind: "Model",
    span,
    metadata: {
      injectionDecorator: "InjectModel",
      token,
    },
  };
}

function repositoryNameForToken(token: string): string {
  const name = cleanTokenName(token);
  return name.endsWith("Repository") ? name : `${name}Repository`;
}

function cleanTokenName(token: string): string {
  const cleaned = token
    .replace(/^['"`]|['"`]$/g, "")
    .replace(/<.*>$/g, "")
    .trim();

  if (cleaned.endsWith(".name")) {
    return unqualifiedName(cleaned.slice(0, -".name".length));
  }

  return unqualifiedName(cleaned);
}

function routeHandlerTarget(indexes: ReturnType<typeof createProjectIndexes>, call: TypeScriptCall): string | undefined {
  const candidates = call.arguments.slice(1).filter((argument) => !isAuthorizationName(argument.name ?? argument.literal ?? ""));
  const handler = candidates.at(-1) ?? call.arguments.at(-1);
  const name = handler?.name;

  if (!name) {
    return undefined;
  }

  return resolveNameInFile(indexes, call.file, name);
}

function resolveNameInFile(indexes: ReturnType<typeof createProjectIndexes>, file: string, name: string): string | undefined {
  const shortName = unqualifiedName(name);
  const local = indexes.project.symbols.find((symbol) => symbol.file === file && symbol.name === shortName);

  if (local) {
    return local.id;
  }

  for (const item of indexes.importsByFile.get(file) ?? []) {
    for (const binding of item.namedBindings) {
      if (binding.localName === shortName) {
        return binding.targetId ?? item.targetId;
      }
    }

    if (item.defaultBinding === shortName || item.namespaceBinding === shortName) {
      return item.targetId;
    }
  }

  return undefined;
}

function compilerSymbolFromTypeScript(symbol: TypeScriptSymbol): CompilerSymbol {
  return {
    id: symbol.id,
    kind: symbol.kind as CompilerSymbolKind,
    name: symbol.name,
    file: symbol.file,
    span: symbol.span,
    language: "typescript",
    metadata: symbol.metadata,
    provenance: provenance(),
  };
}

function ensureImportTargetSymbol(symbols: Map<string, CompilerSymbol>, item: TypeScriptImport): void {
  if (symbols.has(item.targetId)) {
    return;
  }

  addSymbol(symbols, {
    id: item.targetId,
    kind: item.targetKind as CompilerSymbolKind,
    name: item.targetName,
    file: item.targetKind === "Module" ? item.targetFile : undefined,
    span: item.span,
    language: "typescript",
    metadata: withOptionalProperties<JsonObject, JsonObject>({
      external: item.targetKind === "Package",
    }, {
      unresolved: item.unresolved,
    }),
    provenance: provenance(),
  });
}

function ensureSemanticTargetSymbol(symbols: Map<string, CompilerSymbol>, target: SemanticTarget): void {
  if (symbols.has(target.id)) {
    return;
  }

  addSymbol(symbols, {
    id: target.id,
    kind: (target.kind ?? "Provider") as CompilerSymbolKind,
    name: target.name,
    file: target.file,
    span: target.span,
    language: "typescript",
    metadata: target.metadata,
    provenance: provenance(),
  });
}

function ensureSemanticTargetIdSymbol(
  symbols: Map<string, CompilerSymbol>,
  id: string,
  name: string | undefined,
  span: SourceSpan | undefined,
): void {
  if (symbols.has(id)) {
    return;
  }

  const parsed = semanticTargetFromId(id, name, span);
  ensureSemanticTargetSymbol(symbols, parsed);
}

function semanticTargetFromId(id: string, name: string | undefined, span: SourceSpan | undefined): SemanticTarget {
  const [prefix = "", ...rest] = id.split(":");
  const fallbackName = name ?? rest.join(":") ?? id;

  switch (prefix) {
    case "controller":
      return { id, name: fallbackName, kind: "Controller", span };
    case "factory":
      return { id, name: fallbackName, kind: "Factory", span };
    case "mod":
      return { id, name: fallbackName, kind: "Module", span };
    case "repository":
      return { id, name: fallbackName, kind: "Repository", span };
    case "service":
      return { id, name: fallbackName, kind: "Service", span };
    default:
      return { id, name: fallbackName, kind: "Provider", providerKind: "token", span };
  }
}

function semanticRoleIdForSymbol(symbol: TypeScriptSymbol, symbols: ReadonlyMap<string, CompilerSymbol>): string | undefined {
  const roleKind = semanticRoleKind(symbol.name);

  if (!roleKind || !symbol.file) {
    return undefined;
  }

  const roleId = createNodeId({ type: roleKind, file: symbol.file, name: symbol.name });
  return symbols.has(roleId) ? roleId : undefined;
}

function semanticRoleKind(name: string): Extract<NodeType, "Repository" | "Service"> | undefined {
  return name.endsWith("Service")
    ? "Service"
    : name.endsWith("Repository")
      ? "Repository"
      : undefined;
}

function addExceptionSymbol(symbols: Map<string, CompilerSymbol>, exceptionName: string, span: SourceSpan): string {
  const id = createNodeId({ type: "Exception", name: exceptionName });
  addSymbol(symbols, {
    id,
    kind: "Exception",
    name: exceptionName,
    span,
    language: "typescript",
    metadata: {
      thrownConstructor: exceptionName,
    },
    provenance: provenance(),
  });
  return id;
}

function sourceModuleIdForFile(project: TypeScriptProject, file: string): string {
  return project.files.find((item) => item.file === file)?.id ?? createNodeId({ type: "Module", name: file });
}

function decoratorPathValues(decorator: TypeScriptDecorator): readonly string[] {
  const first = decorator.arguments[0];

  if (!first) {
    return ["/"];
  }

  const values = pathValuesFromExpressionText(first.text, first.literal);
  return values.length > 0 ? values.map((item) => normalizeRoutePath(item) ?? "/").sort() : ["/"];
}

function controllerPathValues(
  indexes: ReturnType<typeof createProjectIndexes>,
  file: string,
  decorator: TypeScriptDecorator,
): readonly string[] {
  const imported = importedDecoratorBinding(indexes, file, decorator.name);

  if (imported?.importedName === "SimplifiedController") {
    const resourceType = decorator.arguments[0]?.literal ?? decorator.arguments[0]?.name ?? decorator.arguments[0]?.text;
    const normalized = resourceType?.replace(/^['"`]|['"`]$/g, "");
    return normalized ? [normalizeRoutePath(`simplified/fhir/${normalized}`) ?? "/"] : ["/"];
  }

  return decoratorPathValues(decorator);
}

function nestRouteDefinition(
  indexes: ReturnType<typeof createProjectIndexes>,
  file: string,
  decorator: TypeScriptDecorator,
): NestRouteDefinition | undefined {
  const imported = importedDecoratorBinding(indexes, file, decorator.name);

  switch (imported?.importedName) {
    case "SimplifiedDelete":
      return { method: "DELETE", paths: ["/:id"] };
    case "SimplifiedGet":
      return { method: "GET", paths: ["/:id"] };
    case "SimplifiedPost":
      return { method: "POST", paths: ["/"] };
    case "SimplifiedPut":
      return { method: "PUT", paths: ["/:id"] };
    case "SimplifiedSearch":
      return { method: "GET", paths: ["/"] };
    default:
      break;
  }

  if (decorator.name === "Search" && imported?.targetId?.includes("SimplifiedSearch")) {
    return { method: "GET", paths: ["/"] };
  }

  const method = NEST_ROUTE_DECORATORS.get(decorator.name);
  return method ? { method, paths: decoratorPathValues(decorator) } : undefined;
}

function pathValuesFromExpressionText(text: string, literal: string | undefined): readonly string[] {
  if (literal && !literal.trim().startsWith("{") && !literal.trim().startsWith("[")) {
    return [literal];
  }

  const pathMatch = text.match(/\b(?:path|prefix)\s*:\s*(['"`])([^'"`]+)\1/);

  if (pathMatch?.[2]) {
    return [pathMatch[2]];
  }

  const propertyArray = [
    ...extractArrayProperty(text, "path"),
    ...extractArrayProperty(text, "prefix"),
  ].map((item) => item.replace(/^['"`]|['"`]$/g, ""));

  if (propertyArray.length > 0) {
    return propertyArray;
  }

  if (text.trim().startsWith("[")) {
    return splitTopLevel(text.trim().replace(/^\[|\]$/g, ""))
      .map((item) => item.trim().replace(/^['"`]|['"`]$/g, ""))
      .filter(Boolean);
  }

  return [];
}

function importedDecoratorBinding(
  indexes: ReturnType<typeof createProjectIndexes>,
  file: string,
  localName: string,
): TypeScriptImportBinding | undefined {
  for (const item of indexes.importsByFile.get(file) ?? []) {
    const binding = item.namedBindings.find((candidate) => candidate.localName === localName);

    if (binding) {
      return binding;
    }
  }

  return undefined;
}

function extractArrayProperty(text: string, property: string): readonly string[] {
  const start = text.search(new RegExp(`\\b${property}\\s*:`));

  if (start < 0) {
    return [];
  }

  const bracketStart = text.indexOf("[", start);

  if (bracketStart < 0) {
    return [];
  }

  let depth = 0;

  for (let index = bracketStart; index < text.length; index += 1) {
    const char = text[index];

    if (char === "[") {
      depth += 1;
    }

    if (char === "]") {
      depth -= 1;

      if (depth === 0) {
        return splitTopLevel(text.slice(bracketStart + 1, index)).map((item) => item.trim()).filter(Boolean);
      }
    }
  }

  return [];
}

function splitTopLevel(input: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";

  for (const char of input) {
    if (quote) {
      current += char;

      if (char === quote) {
        quote = "";
      }

      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "[" || char === "{" || char === "(") {
      depth += 1;
    }

    if (char === "]" || char === "}" || char === ")") {
      depth -= 1;
    }

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

interface ParsedObjectProvider {
  readonly provide: string;
  readonly useClass?: string | undefined;
  readonly useExisting?: string | undefined;
  readonly useFactory?: string | undefined;
  readonly useValue?: string | undefined;
}

function parseObjectProvider(text: string): ParsedObjectProvider | undefined {
  if (!text.trim().startsWith("{")) {
    return undefined;
  }

  const provide = propertyValue(text, "provide");

  if (!provide) {
    return undefined;
  }

  return withOptionalProperties({
    provide,
  }, {
    useClass: propertyValue(text, "useClass"),
    useExisting: propertyValue(text, "useExisting"),
    useFactory: propertyValue(text, "useFactory"),
    useValue: propertyValue(text, "useValue"),
  });
}

function propertyValue(text: string, property: string): string | undefined {
  const match = text.match(new RegExp(`\\b${property}\\s*:\\s*([^,}]+)`));
  const raw = match?.[1]?.trim();

  if (!raw) {
    return undefined;
  }

  return raw.replace(/^['"`]|['"`]$/g, "");
}

function providerTokenName(expression: TypeScriptExpression | undefined): string | undefined {
  if (!expression) {
    return undefined;
  }

  return expression.literal ?? expression.name ?? expression.text.replace(/^['"`]|['"`]$/g, "");
}

function runtimeTriggerName(expression: TypeScriptExpression | undefined): string | undefined {
  const token = providerTokenName(expression);

  if (!token) {
    return undefined;
  }

  if (expression?.literal !== undefined && expression.kind !== "Identifier") {
    return token;
  }

  return unqualifiedName(token);
}

function unwrapForwardRefName(value: string): string {
  const match = value.match(/forwardRef\s*\(\s*\(\s*\)\s*=>\s*([^)]+)\)/);
  return (match?.[1] ?? value).trim();
}

function joinRoutePaths(controllerPath: string, methodPath: string): string {
  const controller = normalizeRoutePath(controllerPath) ?? "/";
  const method = normalizeRoutePath(methodPath) ?? "/";

  if (controller === "/") {
    return method;
  }

  if (method === "/") {
    return controller;
  }

  return normalizeRoutePath(`${controller}/${method}`) ?? "/";
}

function normalizeRoutePath(path: string | undefined): string | undefined {
  if (path === undefined) {
    return undefined;
  }

  const trimmed = path.trim().replace(/^['"`]|['"`]$/g, "");

  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/")}`;
}

function isNestControllerDecoratorName(name: string): boolean {
  return name === "Controller" || name.endsWith("Controller");
}

function isNestProviderDecoratorName(name: string): boolean {
  return ["Catch", "Injectable", "Processor", "Resolver", "WebSocketGateway"].includes(name);
}

function isNestInjectionDecoratorName(name: string): boolean {
  return ["Inject", "InjectModel", "InjectQueue", "InjectRepository"].includes(name);
}

function isAuthorizationName(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized.includes("auth") || normalized.includes("permission") || normalized.includes("guard") || normalized.includes("requireuser");
}

function rootName(name: string): string {
  return name.split(".")[0] ?? name;
}

function unqualifiedName(name: string): string {
  return name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
}

function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }

  return specifier.split("/")[0] ?? specifier;
}

function mapByName<T extends { readonly name: string }>(items: readonly T[]): ReadonlyMap<string, readonly T[]> {
  return groupBy(items, (item) => item.name);
}

function groupBy<T>(items: readonly T[], getKey: (item: T) => string): ReadonlyMap<string, readonly T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const values = grouped.get(key) ?? [];
    values.push(item);
    grouped.set(key, values);
  }

  return new Map([...grouped.entries()].map(([key, values]) => [key, values.sort(compareByStableJson)] as const));
}

function isSemanticTarget(value: SemanticTarget | undefined): value is SemanticTarget {
  return Boolean(value);
}

function evidence(span: SourceSpan | undefined, description: string, confidence: EdgeEvidence["confidence"] = "exact"): readonly EdgeEvidence[] {
  return span ? [createSyntaxEvidence(span, description, confidence)] : [{ kind: "semantic", confidence, description }];
}

function provenance(passId?: string): CompilerSymbol["provenance"] {
  return {
    passId,
    parser: "typescript",
    parserVersion: TYPESCRIPT_ANALYZER_VERSION,
    source: "typescript",
  };
}

function addSymbol(symbols: Map<string, CompilerSymbol>, symbol: CompilerSymbol): void {
  if (!symbols.has(symbol.id)) {
    symbols.set(symbol.id, symbol);
  }
}

function addRelationship(relationships: Map<string, CompilerRelationship>, relationship: CompilerRelationship): void {
  const id = relationship.id ?? createEdgeId(relationship.type, relationship.from, relationship.to);

  if (!relationships.has(id)) {
    relationships.set(id, { ...relationship, id });
  }
}

function compareAnalyzers(left: FrameworkAnalyzer, right: FrameworkAnalyzer): number {
  return left.id.localeCompare(right.id);
}

function compareDetections(left: DetectionResult, right: DetectionResult): number {
  return left.framework.localeCompare(right.framework);
}

function compareFacts(left: SemanticFact, right: SemanticFact): number {
  return stableString(left).localeCompare(stableString(right));
}

function compareSymbols(left: CompilerSymbol, right: CompilerSymbol): number {
  return left.id.localeCompare(right.id);
}

function compareRelationships(left: CompilerRelationship, right: CompilerRelationship): number {
  const leftId = left.id ?? createEdgeId(left.type, left.from, left.to);
  const rightId = right.id ?? createEdgeId(right.type, right.from, right.to);
  return leftId.localeCompare(rightId);
}

function compareByStableJson<T>(left: T, right: T): number {
  return stableString(left).localeCompare(stableString(right));
}

function stableString(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as T & O;
}
