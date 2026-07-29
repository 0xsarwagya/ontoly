import type {
  CompilerRelationship,
  CompilerSymbol,
} from "@0xsarwagya/ontoly-compiler";
import {
  createEdgeId,
  createNodeId,
  createSyntaxEvidence,
  type EdgeEvidence,
  type JsonObject,
  type SoftwareGraphDiagnostic,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";
import type {
  GoProject,
} from "@0xsarwagya/ontoly-go";
import { GO_ANALYZER_VERSION } from "@0xsarwagya/ontoly-go";
import type {
  DetectionResult,
  SemanticFact,
} from "@0xsarwagya/ontoly-semantic";

export interface GoFrameworkAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly detect: (project: GoProject) => DetectionResult;
  readonly analyze: (project: GoProject) => readonly SemanticFact[];
}

export interface GoFrameworkRegistry {
  readonly analyzers: readonly GoFrameworkAnalyzer[];
  readonly detect: (project: GoProject) => readonly DetectionResult[];
  readonly analyze: (project: GoProject) => readonly SemanticFact[];
}

export interface GenerateGoCompilerArtifactsInput {
  readonly project: GoProject;
  readonly registry?: GoFrameworkRegistry | undefined;
}

export interface GenerateGoCompilerArtifactsResult {
  readonly symbols: readonly CompilerSymbol[];
  readonly relationships: readonly CompilerRelationship[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly detections: readonly DetectionResult[];
  readonly facts: readonly SemanticFact[];
}

export function createGoFrameworkRegistry(
  analyzers: readonly GoFrameworkAnalyzer[] = [],
): GoFrameworkRegistry {
  const sorted = [...analyzers].sort((a, b) => a.id.localeCompare(b.id));
  return {
    analyzers: sorted,
    detect: (project) =>
      sorted.map((a) => a.detect(project)).sort((a, b) => a.framework.localeCompare(b.framework)),
    analyze: (project) =>
      sorted.flatMap((a) => (a.detect(project).detected ? a.analyze(project) : [])),
  };
}

export function createDefaultGoFrameworkRegistry(): GoFrameworkRegistry {
  return createGoFrameworkRegistry([
    createGinAnalyzer(),
    createEchoAnalyzer(),
    createFiberAnalyzer(),
    createChiAnalyzer(),
    createGrpcAnalyzer(),
    createGormAnalyzer(),
  ]);
}

export function generateGoCompilerArtifacts(
  input: GenerateGoCompilerArtifactsInput,
): GenerateGoCompilerArtifactsResult {
  const registry = input.registry ?? createDefaultGoFrameworkRegistry();
  const detections = registry.detect(input.project);
  const facts = registry.analyze(input.project);
  const symbols = new Map<string, CompilerSymbol>();
  const relationships = new Map<string, CompilerRelationship>();

  addGoSymbols(input.project, symbols);
  addGoRelationships(input.project, symbols, relationships);

  return {
    symbols: [...symbols.values()].sort((a, b) => a.id.localeCompare(b.id)),
    relationships: [...relationships.values()].sort((a, b) => {
      const aId = a.id ?? createEdgeId(a.type, a.from, a.to);
      const bId = b.id ?? createEdgeId(b.type, b.from, b.to);
      return aId.localeCompare(bId);
    }),
    diagnostics: input.project.diagnostics.map((d) => ({
      id: `diag:${d.code}:${d.file}`,
      code: d.code,
      severity: "warning" as const,
      message: d.message,
      span: d.span,
    })),
    detections,
    facts,
  };
}

function provenance(): CompilerSymbol["provenance"] {
  return {
    parser: "go",
    parserVersion: GO_ANALYZER_VERSION,
    source: "go",
  };
}

function evidence(
  span: SourceSpan | undefined,
  description: string,
  confidence: EdgeEvidence["confidence"] = "exact",
): readonly EdgeEvidence[] {
  return span
    ? [createSyntaxEvidence(span, description, confidence)]
    : [{ kind: "semantic", confidence, description }];
}

function addSymbol(symbols: Map<string, CompilerSymbol>, symbol: CompilerSymbol): void {
  if (!symbols.has(symbol.id)) {
    symbols.set(symbol.id, symbol);
  }
}

function addRelationship(
  relationships: Map<string, CompilerRelationship>,
  relationship: CompilerRelationship,
): void {
  const id = relationship.id ?? createEdgeId(relationship.type, relationship.from, relationship.to);
  if (!relationships.has(id)) {
    relationships.set(id, { ...relationship, id });
  }
}

function addGoSymbols(project: GoProject, symbols: Map<string, CompilerSymbol>): void {
  for (const file of project.files) {
    addSymbol(symbols, {
      id: file.id,
      kind: "Script",
      name: file.file,
      file: file.file,
      span: file.span,
      language: "go",
      provenance: provenance(),
    });
  }

  for (const s of project.structs) {
    addSymbol(symbols, {
      id: s.id,
      kind: "Class",
      name: s.name,
      file: s.file,
      span: s.span,
      language: "go",
      metadata: {
        goKind: "struct",
        fieldCount: s.fields.length,
        embedCount: s.embeds.length,
        exported: s.exported,
      },
      provenance: provenance(),
    });
  }

  for (const iface of project.interfaces) {
    addSymbol(symbols, {
      id: iface.id,
      kind: "Class",
      name: iface.name,
      file: iface.file,
      span: iface.span,
      language: "go",
      metadata: {
        goKind: "interface",
        methodCount: iface.methods.length,
        exported: iface.exported,
      },
      provenance: provenance(),
    });
  }

  for (const func of project.functions) {
    addSymbol(symbols, {
      id: func.id,
      kind: "Function",
      name: func.name,
      file: func.file,
      span: func.span,
      language: "go",
      metadata: {
        parameterCount: func.parameters.length,
        exported: func.exported,
      },
      provenance: provenance(),
    });
  }

  for (const method of project.methods) {
    addSymbol(symbols, {
      id: method.id,
      kind: "Method",
      name: method.name,
      file: method.file,
      span: method.span,
      language: "go",
      metadata: {
        receiverType: method.receiverType,
        pointerReceiver: method.pointerReceiver,
        parameterCount: method.parameters.length,
        exported: method.exported,
      },
      provenance: provenance(),
    });
  }

  for (const imp of project.imports) {
    addSymbol(symbols, {
      id: imp.id,
      kind: "Import",
      name: imp.path,
      file: imp.file,
      span: imp.span,
      language: "go",
      metadata: {
        ...(imp.alias ? { alias: imp.alias } : {}),
        sideEffect: imp.sideEffect,
      },
      provenance: provenance(),
    });
  }

  for (const c of project.constants) {
    addSymbol(symbols, {
      id: c.id,
      kind: "Configuration",
      name: c.name,
      file: c.file,
      span: c.span,
      language: "go",
      metadata: {
        goKind: "const",
        ...(c.type ? { type: c.type } : {}),
        ...(c.value ? { value: c.value } : {}),
        exported: c.exported,
      },
      provenance: provenance(),
    });
  }

  for (const v of project.variables) {
    addSymbol(symbols, {
      id: v.id,
      kind: "Configuration",
      name: v.name,
      file: v.file,
      span: v.span,
      language: "go",
      metadata: {
        goKind: "var",
        ...(v.type ? { type: v.type } : {}),
        exported: v.exported,
      },
      provenance: provenance(),
    });
  }

  for (const ta of project.typeAliases) {
    addSymbol(symbols, {
      id: ta.id,
      kind: "Class",
      name: ta.name,
      file: ta.file,
      span: ta.span,
      language: "go",
      metadata: {
        goKind: ta.isAlias ? "type-alias" : "type-definition",
        underlyingType: ta.underlyingType,
        exported: ta.exported,
      },
      provenance: provenance(),
    });
  }
}

function addGoRelationships(
  project: GoProject,
  symbols: Map<string, CompilerSymbol>,
  relationships: Map<string, CompilerRelationship>,
): void {
  const fileById = new Map(project.files.map((f) => [f.file, f] as const));

  for (const s of project.structs) {
    const sourceFile = fileById.get(s.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: s.id,
        evidence: evidence(s.span, "file contains struct"),
        metadata: { ownerKind: "File" },
      });
    }

    for (const embed of s.embeds) {
      const embedId = createNodeId({ type: "Class", name: embed });
      addSymbol(symbols, {
        id: embedId,
        kind: "Class",
        name: embed,
        language: "go",
        provenance: provenance(),
      });
      addRelationship(relationships, {
        type: "EXTENDS",
        from: s.id,
        to: embedId,
        evidence: evidence(s.span, `embeds ${embed}`),
      });
    }
  }

  for (const iface of project.interfaces) {
    const sourceFile = fileById.get(iface.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: iface.id,
        evidence: evidence(iface.span, "file contains interface"),
        metadata: { ownerKind: "File" },
      });
    }

    for (const embed of iface.embeds) {
      const embedId = createNodeId({ type: "Class", name: embed });
      addSymbol(symbols, {
        id: embedId,
        kind: "Class",
        name: embed,
        language: "go",
        provenance: provenance(),
      });
      addRelationship(relationships, {
        type: "EXTENDS",
        from: iface.id,
        to: embedId,
        evidence: evidence(iface.span, `embeds interface ${embed}`),
      });
    }
  }

  for (const func of project.functions) {
    const sourceFile = fileById.get(func.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: func.id,
        evidence: evidence(func.span, "file contains function"),
        metadata: { ownerKind: "File" },
      });
    }
  }

  for (const method of project.methods) {
    const structId = createNodeId({ type: "Class", name: method.receiverType, file: method.file });
    addRelationship(relationships, {
      type: "CONTAINS",
      from: structId,
      to: method.id,
      evidence: evidence(method.span, "struct contains method"),
      metadata: { ownerKind: "Struct" },
    });
  }

  for (const imp of project.imports) {
    const sourceFile = fileById.get(imp.file);
    if (sourceFile) {
      const targetId = createNodeId({ type: "Package", name: imp.path });
      addSymbol(symbols, {
        id: targetId,
        kind: "Package",
        name: imp.path,
        language: "go",
        provenance: provenance(),
      });
      addRelationship(relationships, {
        type: "IMPORTS",
        from: sourceFile.id,
        to: targetId,
        evidence: evidence(imp.span, `imports ${imp.path}`),
        metadata: {
          importNodeId: imp.id,
          path: imp.path,
        },
      });
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: imp.id,
        evidence: evidence(imp.span, "file contains import"),
      });
    }
  }

  for (const call of project.calls) {
    if (!call.calleeName) continue;
    const targetId = call.receiverName && call.methodName
      ? createNodeId({ type: "Method", name: `${call.receiverName}.${call.methodName}` })
      : createNodeId({ type: "Function", name: call.calleeName });
    addRelationship(relationships, {
      type: "CALLS",
      from: call.ownerId,
      to: targetId,
      evidence: evidence(call.span, "calls target"),
    });
  }

  for (const c of project.constants) {
    const sourceFile = fileById.get(c.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: c.id,
        evidence: evidence(c.span, "file contains constant"),
      });
    }
  }

  for (const v of project.variables) {
    const sourceFile = fileById.get(v.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: v.id,
        evidence: evidence(v.span, "file contains variable"),
      });
    }
  }

  for (const ta of project.typeAliases) {
    const sourceFile = fileById.get(ta.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: ta.id,
        evidence: evidence(ta.span, "file contains type alias"),
      });
    }
  }
}

// --- Gin framework analyzer ---

const GIN_IMPORTS = new Set([
  "github.com/gin-gonic/gin",
  "github.com/gin-contrib/cors",
  "github.com/gin-contrib/sessions",
  "github.com/gin-contrib/gzip",
  "github.com/gin-contrib/pprof",
]);

const GIN_HTTP_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export function createGinAnalyzer(): GoFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-go:gin",
    name: "Gin",
    version: "1.0.0",
    capabilities: ["routes", "middleware", "handlers"],
    detect: (project) => {
      const ev = project.imports
        .filter((i) => GIN_IMPORTS.has(i.path) || i.path.startsWith("github.com/gin-gonic/") || i.path.startsWith("github.com/gin-contrib/"))
        .map((i) => i.path);
      const unique = [...new Set(ev)].sort();
      return {
        framework: "Gin",
        detected: unique.length > 0,
        confidence: unique.length > 0 ? "exact" : "low",
        evidence: unique,
        analyzerId: "@0xsarwagya/ontoly-semantic-go:gin",
        analyzerVersion: "1.0.0",
        coverage: unique.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeGin(project),
  };
}

function analyzeGin(project: GoProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-go:gin",
    framework: "Gin",
    confidence: "inferred",
  };

  for (const call of project.calls) {
    if (!call.methodName) continue;
    const method = call.methodName.toUpperCase();
    if (GIN_HTTP_METHODS.has(method)) {
      const routeId = createNodeId({
        type: "Route",
        name: `${method} ${call.expression}`,
        file: call.file,
        signature: `${call.span.startLine}:${call.span.startColumn}`,
      });
      facts.push({
        ...base,
        kind: "RouteDeclared",
        routeId,
        name: call.methodName,
        method,
        path: extractFirstStringArg(call.expression),
        file: call.file,
        handlerId: call.ownerId,
        mountedById: call.ownerId,
        span: call.span,
        metadata: { goFramework: "gin" },
      } as SemanticFact);
    }

    if (call.methodName === "Use") {
      facts.push({
        ...base,
        kind: "MiddlewareRegistered",
        middlewareId: call.id,
        name: call.expression,
        file: call.file,
        routeId: "",
        authorization: false,
        span: call.span,
        metadata: { goFramework: "gin" },
      } as SemanticFact);
    }

    if (call.methodName === "Group") {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: call.id,
        classId: call.ownerId,
        name: call.expression,
        file: call.file,
        paths: [extractFirstStringArg(call.expression)],
        decorator: "",
        span: call.span,
        metadata: { goFramework: "gin", ginKind: "route-group" },
      } as SemanticFact);
    }
  }

  for (const func of project.functions) {
    const hasGinContext = func.parameters.some((p) => p.type === "*gin.Context" || p.type === "gin.Context");
    if (hasGinContext) {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: func.id,
        classId: func.id,
        name: func.name,
        file: func.file,
        paths: [],
        decorator: "",
        span: func.span,
        metadata: { goFramework: "gin", ginKind: "handler" },
      } as SemanticFact);
    }
  }

  for (const method of project.methods) {
    const hasGinContext = method.parameters.some((p) => p.type === "*gin.Context" || p.type === "gin.Context");
    if (hasGinContext) {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: method.id,
        classId: method.id,
        name: method.name,
        file: method.file,
        paths: [],
        decorator: "",
        span: method.span,
        metadata: { goFramework: "gin", ginKind: "handler-method" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- Echo framework analyzer ---

const ECHO_IMPORTS = new Set([
  "github.com/labstack/echo/v4",
  "github.com/labstack/echo/v4/middleware",
  "github.com/labstack/echo",
]);

export function createEchoAnalyzer(): GoFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-go:echo",
    name: "Echo",
    version: "1.0.0",
    capabilities: ["routes", "middleware", "handlers"],
    detect: (project) => {
      const ev = project.imports
        .filter((i) => ECHO_IMPORTS.has(i.path) || i.path.startsWith("github.com/labstack/echo"))
        .map((i) => i.path);
      const unique = [...new Set(ev)].sort();
      return {
        framework: "Echo",
        detected: unique.length > 0,
        confidence: unique.length > 0 ? "exact" : "low",
        evidence: unique,
        analyzerId: "@0xsarwagya/ontoly-semantic-go:echo",
        analyzerVersion: "1.0.0",
        coverage: unique.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeEcho(project),
  };
}

function analyzeEcho(project: GoProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-go:echo",
    framework: "Echo",
    confidence: "inferred",
  };

  for (const call of project.calls) {
    if (!call.methodName) continue;
    const method = call.methodName.toUpperCase();
    if (GIN_HTTP_METHODS.has(method)) {
      const routeId = createNodeId({
        type: "Route",
        name: `${method} ${call.expression}`,
        file: call.file,
        signature: `${call.span.startLine}:${call.span.startColumn}`,
      });
      facts.push({
        ...base,
        kind: "RouteDeclared",
        routeId,
        name: call.methodName,
        method,
        path: extractFirstStringArg(call.expression),
        file: call.file,
        handlerId: call.ownerId,
        mountedById: call.ownerId,
        span: call.span,
        metadata: { goFramework: "echo" },
      } as SemanticFact);
    }

    if (call.methodName === "Use") {
      facts.push({
        ...base,
        kind: "MiddlewareRegistered",
        middlewareId: call.id,
        name: call.expression,
        file: call.file,
        routeId: "",
        authorization: false,
        span: call.span,
        metadata: { goFramework: "echo" },
      } as SemanticFact);
    }

    if (call.methodName === "Group") {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: call.id,
        classId: call.ownerId,
        name: call.expression,
        file: call.file,
        paths: [extractFirstStringArg(call.expression)],
        decorator: "",
        span: call.span,
        metadata: { goFramework: "echo", echoKind: "route-group" },
      } as SemanticFact);
    }
  }

  for (const func of project.functions) {
    const hasEchoContext = func.parameters.some((p) => p.type === "echo.Context");
    if (hasEchoContext) {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: func.id,
        classId: func.id,
        name: func.name,
        file: func.file,
        paths: [],
        decorator: "",
        span: func.span,
        metadata: { goFramework: "echo", echoKind: "handler" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- Fiber framework analyzer ---

const FIBER_IMPORTS = new Set([
  "github.com/gofiber/fiber/v2",
  "github.com/gofiber/fiber/v2/middleware/cors",
  "github.com/gofiber/fiber/v2/middleware/logger",
  "github.com/gofiber/fiber/v3",
  "github.com/gofiber/fiber",
]);

export function createFiberAnalyzer(): GoFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-go:fiber",
    name: "Fiber",
    version: "1.0.0",
    capabilities: ["routes", "middleware", "handlers"],
    detect: (project) => {
      const ev = project.imports
        .filter((i) => FIBER_IMPORTS.has(i.path) || i.path.startsWith("github.com/gofiber/"))
        .map((i) => i.path);
      const unique = [...new Set(ev)].sort();
      return {
        framework: "Fiber",
        detected: unique.length > 0,
        confidence: unique.length > 0 ? "exact" : "low",
        evidence: unique,
        analyzerId: "@0xsarwagya/ontoly-semantic-go:fiber",
        analyzerVersion: "1.0.0",
        coverage: unique.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeFiber(project),
  };
}

function analyzeFiber(project: GoProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-go:fiber",
    framework: "Fiber",
    confidence: "inferred",
  };

  for (const call of project.calls) {
    if (!call.methodName) continue;
    const method = call.methodName;
    if (method === "Get" || method === "Post" || method === "Put" || method === "Delete" || method === "Patch") {
      const httpMethod = method.toUpperCase();
      const routeId = createNodeId({
        type: "Route",
        name: `${httpMethod} ${call.expression}`,
        file: call.file,
        signature: `${call.span.startLine}:${call.span.startColumn}`,
      });
      facts.push({
        ...base,
        kind: "RouteDeclared",
        routeId,
        name: method,
        method: httpMethod,
        path: extractFirstStringArg(call.expression),
        file: call.file,
        handlerId: call.ownerId,
        mountedById: call.ownerId,
        span: call.span,
        metadata: { goFramework: "fiber" },
      } as SemanticFact);
    }

    if (method === "Use") {
      facts.push({
        ...base,
        kind: "MiddlewareRegistered",
        middlewareId: call.id,
        name: call.expression,
        file: call.file,
        routeId: "",
        authorization: false,
        span: call.span,
        metadata: { goFramework: "fiber" },
      } as SemanticFact);
    }

    if (method === "Group") {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: call.id,
        classId: call.ownerId,
        name: call.expression,
        file: call.file,
        paths: [extractFirstStringArg(call.expression)],
        decorator: "",
        span: call.span,
        metadata: { goFramework: "fiber", fiberKind: "route-group" },
      } as SemanticFact);
    }
  }

  for (const func of project.functions) {
    const hasFiberCtx = func.parameters.some((p) => p.type === "*fiber.Ctx" || p.type === "fiber.Ctx");
    if (hasFiberCtx) {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: func.id,
        classId: func.id,
        name: func.name,
        file: func.file,
        paths: [],
        decorator: "",
        span: func.span,
        metadata: { goFramework: "fiber", fiberKind: "handler" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- Chi router analyzer ---

const CHI_IMPORTS = new Set([
  "github.com/go-chi/chi",
  "github.com/go-chi/chi/v5",
  "github.com/go-chi/chi/v5/middleware",
]);

export function createChiAnalyzer(): GoFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-go:chi",
    name: "Chi",
    version: "1.0.0",
    capabilities: ["routes", "middleware"],
    detect: (project) => {
      const ev = project.imports
        .filter((i) => CHI_IMPORTS.has(i.path) || i.path.startsWith("github.com/go-chi/"))
        .map((i) => i.path);
      const unique = [...new Set(ev)].sort();
      return {
        framework: "Chi",
        detected: unique.length > 0,
        confidence: unique.length > 0 ? "exact" : "low",
        evidence: unique,
        analyzerId: "@0xsarwagya/ontoly-semantic-go:chi",
        analyzerVersion: "1.0.0",
        coverage: unique.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeChi(project),
  };
}

function analyzeChi(project: GoProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-go:chi",
    framework: "Chi",
    confidence: "inferred",
  };

  for (const call of project.calls) {
    if (!call.methodName) continue;
    const method = call.methodName;
    if (method === "Get" || method === "Post" || method === "Put" || method === "Delete" || method === "Patch") {
      const httpMethod = method.toUpperCase();
      const routeId = createNodeId({
        type: "Route",
        name: `${httpMethod} ${call.expression}`,
        file: call.file,
        signature: `${call.span.startLine}:${call.span.startColumn}`,
      });
      facts.push({
        ...base,
        kind: "RouteDeclared",
        routeId,
        name: method,
        method: httpMethod,
        path: extractFirstStringArg(call.expression),
        file: call.file,
        handlerId: call.ownerId,
        mountedById: call.ownerId,
        span: call.span,
        metadata: { goFramework: "chi" },
      } as SemanticFact);
    }

    if (method === "Use") {
      facts.push({
        ...base,
        kind: "MiddlewareRegistered",
        middlewareId: call.id,
        name: call.expression,
        file: call.file,
        routeId: "",
        authorization: false,
        span: call.span,
        metadata: { goFramework: "chi" },
      } as SemanticFact);
    }

    if (method === "Route" || method === "Mount") {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: call.id,
        classId: call.ownerId,
        name: call.expression,
        file: call.file,
        paths: [extractFirstStringArg(call.expression)],
        decorator: "",
        span: call.span,
        metadata: { goFramework: "chi", chiKind: method === "Mount" ? "mount" : "route-group" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- gRPC analyzer ---

const GRPC_IMPORTS = new Set([
  "google.golang.org/grpc",
  "google.golang.org/grpc/codes",
  "google.golang.org/grpc/status",
  "google.golang.org/grpc/metadata",
  "google.golang.org/grpc/credentials",
  "google.golang.org/protobuf/proto",
  "google.golang.org/protobuf/types/known/emptypb",
  "google.golang.org/protobuf/types/known/timestamppb",
]);

export function createGrpcAnalyzer(): GoFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-go:grpc",
    name: "gRPC",
    version: "1.0.0",
    capabilities: ["services", "interceptors"],
    detect: (project) => {
      const ev = project.imports
        .filter((i) => GRPC_IMPORTS.has(i.path) || i.path.startsWith("google.golang.org/grpc") || i.path.startsWith("google.golang.org/protobuf"))
        .map((i) => i.path);
      const unique = [...new Set(ev)].sort();
      return {
        framework: "gRPC",
        detected: unique.length > 0,
        confidence: unique.length > 0 ? "exact" : "low",
        evidence: unique,
        analyzerId: "@0xsarwagya/ontoly-semantic-go:grpc",
        analyzerVersion: "1.0.0",
        coverage: unique.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeGrpc(project),
  };
}

function analyzeGrpc(project: GoProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-go:grpc",
    framework: "gRPC",
    confidence: "inferred",
  };

  for (const s of project.structs) {
    const isServer = s.name.endsWith("Server") && s.embeds.some((e) => e.endsWith("Server"));
    if (isServer) {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: s.id,
        classId: s.id,
        name: s.name,
        file: s.file,
        paths: [],
        decorator: "",
        span: s.span,
        metadata: { goFramework: "grpc", grpcKind: "service-impl" },
      } as SemanticFact);
    }
  }

  for (const call of project.calls) {
    if (call.calleeName === "grpc.UnaryInterceptor" || call.calleeName === "grpc.StreamInterceptor"
      || call.methodName === "UnaryInterceptor" || call.methodName === "StreamInterceptor") {
      facts.push({
        ...base,
        kind: "MiddlewareRegistered",
        middlewareId: call.id,
        name: call.expression,
        file: call.file,
        routeId: "",
        authorization: false,
        span: call.span,
        metadata: { goFramework: "grpc", grpcKind: "interceptor" },
      } as SemanticFact);
    }

    if (call.calleeName === "grpc.NewServer" || call.methodName === "NewServer") {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: call.id,
        name: "grpc.Server",
        file: call.file,
        classId: call.ownerId,
        providerKind: "factory",
        span: call.span,
        metadata: { goFramework: "grpc", grpcKind: "server" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- GORM analyzer ---

const GORM_IMPORTS = new Set([
  "gorm.io/gorm",
  "gorm.io/driver/postgres",
  "gorm.io/driver/mysql",
  "gorm.io/driver/sqlite",
  "gorm.io/driver/sqlserver",
  "gorm.io/plugin/dbresolver",
]);

export function createGormAnalyzer(): GoFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-go:gorm",
    name: "GORM",
    version: "1.0.0",
    capabilities: ["models", "queries"],
    detect: (project) => {
      const ev = project.imports
        .filter((i) => GORM_IMPORTS.has(i.path) || i.path.startsWith("gorm.io/"))
        .map((i) => i.path);
      const unique = [...new Set(ev)].sort();
      return {
        framework: "GORM",
        detected: unique.length > 0,
        confidence: unique.length > 0 ? "exact" : "low",
        evidence: unique,
        analyzerId: "@0xsarwagya/ontoly-semantic-go:gorm",
        analyzerVersion: "1.0.0",
        coverage: unique.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeGorm(project),
  };
}

function analyzeGorm(project: GoProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-go:gorm",
    framework: "GORM",
    confidence: "inferred",
  };

  for (const s of project.structs) {
    const hasGormModel = s.embeds.some((e) => e === "Model" || e === "gorm.Model");
    const hasGormTags = s.fields.some((f) => f.tag?.includes("gorm:"));
    if (hasGormModel || hasGormTags) {
      facts.push({
        ...base,
        confidence: hasGormModel ? "exact" : "inferred",
        kind: "ProviderDeclared",
        providerId: s.id,
        name: s.name,
        file: s.file,
        classId: s.id,
        providerKind: "class",
        span: s.span,
        metadata: { goFramework: "gorm", gormKind: "model" },
      } as SemanticFact);
    }
  }

  for (const call of project.calls) {
    if (call.calleeName === "gorm.Open" || call.methodName === "Open") {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: call.id,
        name: "gorm.DB",
        file: call.file,
        classId: call.ownerId,
        providerKind: "factory",
        span: call.span,
        metadata: { goFramework: "gorm", gormKind: "connection" },
      } as SemanticFact);
    }

    if (call.methodName === "AutoMigrate") {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: call.id,
        name: call.expression,
        file: call.file,
        classId: call.ownerId,
        providerKind: "factory",
        span: call.span,
        metadata: { goFramework: "gorm", gormKind: "migration" },
      } as SemanticFact);
    }
  }

  return facts;
}

function extractFirstStringArg(expression: string): string {
  const match = expression.match(/"([^"]*)"/);
  return match?.[1] ?? "/";
}

export type {
  DetectionResult,
  SemanticFact,
} from "@0xsarwagya/ontoly-semantic";

export type {
  GoProject,
} from "@0xsarwagya/ontoly-go";
