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
  PythonProject,
} from "@0xsarwagya/ontoly-python";
import { PYTHON_ANALYZER_VERSION } from "@0xsarwagya/ontoly-python";
import type {
  DetectionResult,
  SemanticFact,
} from "@0xsarwagya/ontoly-semantic";

export interface PythonFrameworkAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly detect: (project: PythonProject) => DetectionResult;
  readonly analyze: (project: PythonProject) => readonly SemanticFact[];
}

export interface PythonFrameworkRegistry {
  readonly analyzers: readonly PythonFrameworkAnalyzer[];
  readonly detect: (project: PythonProject) => readonly DetectionResult[];
  readonly analyze: (project: PythonProject) => readonly SemanticFact[];
}

export interface GeneratePythonCompilerArtifactsInput {
  readonly project: PythonProject;
  readonly registry?: PythonFrameworkRegistry | undefined;
}

export interface GeneratePythonCompilerArtifactsResult {
  readonly symbols: readonly CompilerSymbol[];
  readonly relationships: readonly CompilerRelationship[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly detections: readonly DetectionResult[];
  readonly facts: readonly SemanticFact[];
}

export function createPythonFrameworkRegistry(
  analyzers: readonly PythonFrameworkAnalyzer[] = [],
): PythonFrameworkRegistry {
  const sorted = [...analyzers].sort((a, b) => a.id.localeCompare(b.id));
  return {
    analyzers: sorted,
    detect: (project) =>
      sorted.map((a) => a.detect(project)).sort((a, b) => a.framework.localeCompare(b.framework)),
    analyze: (project) =>
      sorted.flatMap((a) => (a.detect(project).detected ? a.analyze(project) : [])),
  };
}

export function createDefaultPythonFrameworkRegistry(): PythonFrameworkRegistry {
  return createPythonFrameworkRegistry([
    createDjangoAnalyzer(),
    createFastApiAnalyzer(),
    createPyTorchAnalyzer(),
    createTensorFlowAnalyzer(),
    createHuggingFaceAnalyzer(),
    createScikitLearnAnalyzer(),
  ]);
}

export function generatePythonCompilerArtifacts(
  input: GeneratePythonCompilerArtifactsInput,
): GeneratePythonCompilerArtifactsResult {
  const registry = input.registry ?? createDefaultPythonFrameworkRegistry();
  const detections = registry.detect(input.project);
  const facts = registry.analyze(input.project);
  const symbols = new Map<string, CompilerSymbol>();
  const relationships = new Map<string, CompilerRelationship>();

  addPythonSymbols(input.project, symbols);
  addPythonRelationships(input.project, symbols, relationships);

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
    parser: "python",
    parserVersion: PYTHON_ANALYZER_VERSION,
    source: "python",
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

function addPythonSymbols(project: PythonProject, symbols: Map<string, CompilerSymbol>): void {
  for (const file of project.files) {
    addSymbol(symbols, {
      id: file.id,
      kind: "Script",
      name: file.file,
      file: file.file,
      span: file.span,
      language: "python",
      provenance: provenance(),
    });
  }

  for (const cls of project.classes) {
    addSymbol(symbols, {
      id: cls.id,
      kind: "Class",
      name: cls.name,
      file: cls.file,
      span: cls.span,
      language: "python",
      metadata: {
        bases: cls.bases as unknown as JsonObject,
        decoratorCount: cls.decorators.length,
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
      language: "python",
      metadata: {
        async: func.async,
        parameterCount: func.parameters.length,
        ...(func.returnAnnotation ? { returnAnnotation: func.returnAnnotation } : {}),
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
      language: "python",
      metadata: {
        async: method.async,
        static: method.static,
        classmethod: method.classmethod,
        property: method.property,
        parameterCount: method.parameters.length,
      },
      provenance: provenance(),
    });
  }

  for (const imp of project.imports) {
    addSymbol(symbols, {
      id: imp.id,
      kind: "Import",
      name: imp.module || imp.names.map((n) => n.name).join(", "),
      file: imp.file,
      span: imp.span,
      language: "python",
      metadata: {
        relative: imp.relative,
        relativeLevel: imp.relativeLevel,
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
      language: "python",
      metadata: {
        ...(v.annotation ? { annotation: v.annotation } : {}),
      },
      provenance: provenance(),
    });
  }
}

function addPythonRelationships(
  project: PythonProject,
  symbols: Map<string, CompilerSymbol>,
  relationships: Map<string, CompilerRelationship>,
): void {
  const fileById = new Map(project.files.map((f) => [f.file, f] as const));

  for (const cls of project.classes) {
    const sourceFile = fileById.get(cls.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: cls.id,
        evidence: evidence(cls.span, "module contains class"),
        metadata: { ownerKind: "Module" },
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
        evidence: evidence(func.span, "module contains function"),
        metadata: { ownerKind: "Module" },
      });
    }
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

  for (const imp of project.imports) {
    const sourceFile = fileById.get(imp.file);
    if (sourceFile) {
      const targetId = createNodeId({ type: "Package", name: imp.module || "." });
      addSymbol(symbols, {
        id: targetId,
        kind: "Package",
        name: imp.module || ".",
        language: "python",
        provenance: provenance(),
      });
      addRelationship(relationships, {
        type: "IMPORTS",
        from: sourceFile.id,
        to: targetId,
        evidence: evidence(imp.span, `imports ${imp.module}`),
        metadata: {
          importNodeId: imp.id,
          module: imp.module,
          names: imp.names.map((n) => n.name).join(", "),
        },
      });
    }
  }

  for (const decorator of project.decorators) {
    const decoratorSymbolId = createNodeId({ type: "Decorator", name: decorator.name });
    addSymbol(symbols, {
      id: decoratorSymbolId,
      kind: "Decorator",
      name: decorator.name,
      span: decorator.span,
      language: "python",
      metadata: { expression: decorator.expression },
      provenance: provenance(),
    });
    addRelationship(relationships, {
      type: "DECORATES",
      from: decoratorSymbolId,
      to: decorator.targetId,
      evidence: evidence(decorator.span, `@${decorator.name} decorates target`),
    });
  }

  for (const cls of project.classes) {
    for (const base of cls.bases) {
      const baseId = createNodeId({ type: "Class", name: base });
      addSymbol(symbols, {
        id: baseId,
        kind: "Class",
        name: base,
        language: "python",
        provenance: provenance(),
      });
      addRelationship(relationships, {
        type: "EXTENDS",
        from: cls.id,
        to: baseId,
        evidence: evidence(cls.span, `extends ${base}`),
      });
    }
  }

  for (const call of project.calls) {
    if (!call.targetId) continue;
    addRelationship(relationships, {
      type: "CALLS",
      from: call.ownerId,
      to: call.targetId,
      evidence: evidence(call.span, "calls target"),
    });
  }

  for (const imp of project.imports) {
    const sourceFile = fileById.get(imp.file);
    if (!sourceFile) continue;
    addRelationship(relationships, {
      type: "CONTAINS",
      from: sourceFile.id,
      to: imp.id,
      evidence: evidence(imp.span, "module contains import"),
    });
  }

  for (const v of project.variables) {
    const sourceFile = fileById.get(v.file);
    if (sourceFile) {
      addRelationship(relationships, {
        type: "CONTAINS",
        from: sourceFile.id,
        to: v.id,
        evidence: evidence(v.span, "module contains variable"),
      });
    }
  }
}

const DJANGO_MODULES = new Set([
  "django", "django.db", "django.db.models", "django.http", "django.urls",
  "django.views", "django.conf", "django.contrib", "django.middleware",
  "django.core", "django.forms", "django.template",
]);

const FASTAPI_MODULES = new Set([
  "fastapi", "fastapi.routing", "fastapi.responses", "fastapi.middleware",
  "fastapi.security", "fastapi.params",
]);

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

export function createDjangoAnalyzer(): PythonFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-python:django",
    name: "Django",
    version: "1.0.0",
    capabilities: ["models", "views", "routes", "middleware"],
    detect: (project) => {
      const importEvidence = project.imports
        .filter((i) => DJANGO_MODULES.has(i.module) || i.module.startsWith("django."))
        .map((i) => i.module);
      const evidence = [...new Set(importEvidence)].sort();
      return {
        framework: "Django",
        detected: evidence.length > 0,
        confidence: evidence.length > 0 ? "exact" : "low",
        evidence,
        analyzerId: "@0xsarwagya/ontoly-semantic-python:django",
        analyzerVersion: "1.0.0",
        coverage: evidence.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeDjango(project),
  };
}

function analyzeDjango(project: PythonProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-python:django",
    framework: "Django",
    confidence: "exact",
  };

  for (const cls of project.classes) {
    const isModel = cls.bases.some((b) =>
      b === "models.Model" || b === "Model" || b.endsWith(".Model"),
    );
    if (isModel) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { djangoKind: "model" },
      } as SemanticFact);
    }

    const isView = cls.bases.some((b) =>
      b === "View" || b === "TemplateView" || b === "ListView" || b === "DetailView"
      || b === "CreateView" || b === "UpdateView" || b === "DeleteView" || b === "FormView"
      || b === "APIView" || b === "GenericAPIView" || b === "ModelViewSet" || b === "ViewSet"
      || b.endsWith("View") || b.endsWith("ViewSet") || b.endsWith("Mixin"),
    );
    if (isView) {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: cls.id,
        classId: cls.id,
        name: cls.name,
        file: cls.file,
        paths: [],
        decorator: "",
        span: cls.span,
        metadata: { djangoKind: "class-based-view" },
      } as SemanticFact);
    }
  }

  for (const func of project.functions) {
    const hasHttpResponse = project.imports.some((i) =>
      i.module === "django.http" && i.names.some((n) =>
        n.name === "HttpResponse" || n.name === "JsonResponse",
      ),
    );
    const hasRequestParam = func.parameters.some((p) => p.name === "request");
    if (hasRequestParam && hasHttpResponse) {
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
        metadata: { djangoKind: "function-based-view" },
      } as SemanticFact);
    }
  }

  for (const cls of project.classes) {
    const isMiddleware = cls.bases.some((b) => b === "MiddlewareMixin" || b.endsWith("Middleware"));
    if (isMiddleware) {
      facts.push({
        ...base,
        kind: "MiddlewareRegistered",
        middlewareId: cls.id,
        name: cls.name,
        file: cls.file,
        routeId: "",
        authorization: false,
        span: cls.span,
      } as SemanticFact);
    }
  }

  return facts;
}

export function createFastApiAnalyzer(): PythonFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-python:fastapi",
    name: "FastAPI",
    version: "1.0.0",
    capabilities: ["routes", "dependency-injection", "models"],
    detect: (project) => {
      const importEvidence = project.imports
        .filter((i) => FASTAPI_MODULES.has(i.module) || i.module.startsWith("fastapi."))
        .map((i) => i.module);
      const decoratorEvidence = project.decorators
        .filter((d) => HTTP_METHODS.has(d.name.split(".").pop() ?? ""))
        .map((d) => `@${d.name}`);
      const evidence = [...new Set([...importEvidence, ...decoratorEvidence])].sort();
      return {
        framework: "FastAPI",
        detected: evidence.length > 0,
        confidence: importEvidence.length > 0 ? "exact" : "inferred",
        evidence,
        analyzerId: "@0xsarwagya/ontoly-semantic-python:fastapi",
        analyzerVersion: "1.0.0",
        coverage: evidence.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeFastApi(project),
  };
}

function analyzeFastApi(project: PythonProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-python:fastapi",
    framework: "FastAPI",
    confidence: "exact",
  };

  for (const func of project.functions) {
    for (const dec of func.decorators) {
      const parts = dec.name.split(".");
      const method = parts.pop()?.toLowerCase() ?? "";
      if (!HTTP_METHODS.has(method)) continue;

      const path = dec.arguments[0]?.replace(/['"]/g, "") ?? "/";
      const routeId = createNodeId({
        type: "Route",
        name: `${method.toUpperCase()} ${path}`,
        file: func.file,
      });

      facts.push({
        ...base,
        kind: "RouteDeclared",
        routeId,
        name: func.name,
        method: method.toUpperCase(),
        path,
        file: func.file,
        handlerId: func.id,
        mountedById: func.id,
        decorator: dec.expression,
        span: func.span,
      } as SemanticFact);
    }

    for (const param of func.parameters) {
      if (param.annotation === "Depends" || param.defaultValue?.startsWith("Depends(")) {
        const dependencyExpr = param.defaultValue ?? param.annotation ?? "";
        facts.push({
          ...base,
          kind: "DependencyInjected",
          fromClassId: func.id,
          toId: createNodeId({ type: "Function", name: dependencyExpr }),
          parameter: param.name,
          token: dependencyExpr,
          span: func.span,
        } as SemanticFact);
      }
    }
  }

  for (const cls of project.classes) {
    const isBaseModel = cls.bases.some((b) => b === "BaseModel" || b === "pydantic.BaseModel");
    if (isBaseModel) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { fastapiKind: "pydantic-model" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- PyTorch analyzer ---

const PYTORCH_MODULES = new Set([
  "torch", "torch.nn", "torch.optim", "torch.utils", "torch.utils.data",
  "torch.nn.functional", "torch.autograd", "torch.cuda", "torch.distributed",
  "torch.jit", "torch.onnx", "torch.quantization", "torch.amp",
  "torchvision", "torchvision.models", "torchvision.transforms", "torchvision.datasets",
  "torchaudio", "torchtext",
]);

const PYTORCH_MODEL_BASES = new Set([
  "nn.Module", "Module", "torch.nn.Module",
  "LightningModule", "pl.LightningModule",
  "LightningDataModule", "pl.LightningDataModule",
]);

const PYTORCH_DATASET_BASES = new Set([
  "Dataset", "IterableDataset", "torch.utils.data.Dataset",
  "torch.utils.data.IterableDataset", "data.Dataset",
]);

export function createPyTorchAnalyzer(): PythonFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-python:pytorch",
    name: "PyTorch",
    version: "1.0.0",
    capabilities: ["models", "datasets", "layers"],
    detect: (project) => {
      const importEvidence = project.imports
        .filter((i) => PYTORCH_MODULES.has(i.module) || i.module.startsWith("torch.") || i.module.startsWith("torchvision."))
        .map((i) => i.module);
      const ev = [...new Set(importEvidence)].sort();
      return {
        framework: "PyTorch",
        detected: ev.length > 0,
        confidence: ev.length > 0 ? "exact" : "low",
        evidence: ev,
        analyzerId: "@0xsarwagya/ontoly-semantic-python:pytorch",
        analyzerVersion: "1.0.0",
        coverage: ev.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzePyTorch(project),
  };
}

function analyzePyTorch(project: PythonProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-python:pytorch",
    framework: "PyTorch",
    confidence: "exact",
  };

  for (const cls of project.classes) {
    const isModel = cls.bases.some((b) => PYTORCH_MODEL_BASES.has(b));
    if (isModel) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "model", mlFramework: "pytorch" },
      } as SemanticFact);
    }

    const isDataset = cls.bases.some((b) => PYTORCH_DATASET_BASES.has(b));
    if (isDataset) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "dataset", mlFramework: "pytorch" },
      } as SemanticFact);
    }
  }

  for (const func of project.functions) {
    const hasTorchDecorator = func.decorators.some((d) =>
      d.name === "torch.no_grad" || d.name === "torch.jit.script"
      || d.name === "torch.jit.export" || d.name === "torch.inference_mode",
    );
    if (hasTorchDecorator) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: func.id,
        name: func.name,
        file: func.file,
        classId: func.id,
        providerKind: "factory",
        span: func.span,
        metadata: { mlKind: "optimized-function", mlFramework: "pytorch" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- TensorFlow / Keras analyzer ---

const TENSORFLOW_MODULES = new Set([
  "tensorflow", "tensorflow.keras", "tensorflow.data", "tensorflow.lite",
  "tensorflow.saved_model", "tensorflow.distribute", "tensorflow.io",
  "keras", "keras.layers", "keras.models", "keras.callbacks",
  "keras.optimizers", "keras.losses", "keras.metrics",
  "tf", "tf.keras",
]);

const TF_MODEL_BASES = new Set([
  "Model", "keras.Model", "tf.keras.Model", "tensorflow.keras.Model",
  "Sequential", "keras.Sequential", "tf.keras.Sequential",
]);

const TF_LAYER_BASES = new Set([
  "Layer", "keras.layers.Layer", "tf.keras.layers.Layer",
  "tensorflow.keras.layers.Layer",
]);

const TF_CALLBACK_BASES = new Set([
  "Callback", "keras.callbacks.Callback", "tf.keras.callbacks.Callback",
  "tensorflow.keras.callbacks.Callback",
]);

export function createTensorFlowAnalyzer(): PythonFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-python:tensorflow",
    name: "TensorFlow",
    version: "1.0.0",
    capabilities: ["models", "layers", "callbacks"],
    detect: (project) => {
      const importEvidence = project.imports
        .filter((i) =>
          TENSORFLOW_MODULES.has(i.module)
          || i.module.startsWith("tensorflow.")
          || i.module.startsWith("keras.")
          || (i.module === "tensorflow" || i.module === "keras"),
        )
        .map((i) => i.module);
      const ev = [...new Set(importEvidence)].sort();
      return {
        framework: "TensorFlow",
        detected: ev.length > 0,
        confidence: ev.length > 0 ? "exact" : "low",
        evidence: ev,
        analyzerId: "@0xsarwagya/ontoly-semantic-python:tensorflow",
        analyzerVersion: "1.0.0",
        coverage: ev.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeTensorFlow(project),
  };
}

function analyzeTensorFlow(project: PythonProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-python:tensorflow",
    framework: "TensorFlow",
    confidence: "exact",
  };

  for (const cls of project.classes) {
    const isModel = cls.bases.some((b) => TF_MODEL_BASES.has(b));
    if (isModel) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "model", mlFramework: "tensorflow" },
      } as SemanticFact);
    }

    const isLayer = cls.bases.some((b) => TF_LAYER_BASES.has(b));
    if (isLayer) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "layer", mlFramework: "tensorflow" },
      } as SemanticFact);
    }

    const isCallback = cls.bases.some((b) => TF_CALLBACK_BASES.has(b));
    if (isCallback) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "callback", mlFramework: "tensorflow" },
      } as SemanticFact);
    }
  }

  for (const func of project.functions) {
    const hasTfFunction = func.decorators.some((d) =>
      d.name === "tf.function" || d.name === "tensorflow.function",
    );
    if (hasTfFunction) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: func.id,
        name: func.name,
        file: func.file,
        classId: func.id,
        providerKind: "factory",
        span: func.span,
        metadata: { mlKind: "graph-function", mlFramework: "tensorflow" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- HuggingFace Transformers analyzer ---

const HUGGINGFACE_MODULES = new Set([
  "transformers", "datasets", "tokenizers", "accelerate", "peft", "trl",
  "diffusers", "safetensors", "huggingface_hub",
  "transformers.modeling_utils", "transformers.configuration_utils",
  "transformers.tokenization_utils", "transformers.training_args",
]);

const HF_MODEL_BASES = new Set([
  "PreTrainedModel", "transformers.PreTrainedModel",
  "PretrainedConfig", "transformers.PretrainedConfig",
  "GenerationMixin",
]);

const HF_TRAINER_BASES = new Set([
  "Trainer", "transformers.Trainer",
  "Seq2SeqTrainer", "transformers.Seq2SeqTrainer",
]);

const HF_TOKENIZER_BASES = new Set([
  "PreTrainedTokenizer", "transformers.PreTrainedTokenizer",
  "PreTrainedTokenizerFast", "transformers.PreTrainedTokenizerFast",
  "PreTrainedTokenizerBase", "transformers.PreTrainedTokenizerBase",
]);

export function createHuggingFaceAnalyzer(): PythonFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-python:huggingface",
    name: "HuggingFace Transformers",
    version: "1.0.0",
    capabilities: ["models", "trainers", "tokenizers", "pipelines"],
    detect: (project) => {
      const importEvidence = project.imports
        .filter((i) =>
          HUGGINGFACE_MODULES.has(i.module)
          || i.module.startsWith("transformers.")
          || i.module.startsWith("datasets.")
          || i.module.startsWith("diffusers.")
          || i.module.startsWith("peft.")
          || i.module.startsWith("trl."),
        )
        .map((i) => i.module);
      const ev = [...new Set(importEvidence)].sort();
      return {
        framework: "HuggingFace Transformers",
        detected: ev.length > 0,
        confidence: ev.length > 0 ? "exact" : "low",
        evidence: ev,
        analyzerId: "@0xsarwagya/ontoly-semantic-python:huggingface",
        analyzerVersion: "1.0.0",
        coverage: ev.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeHuggingFace(project),
  };
}

function analyzeHuggingFace(project: PythonProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-python:huggingface",
    framework: "HuggingFace Transformers",
    confidence: "exact",
  };

  for (const cls of project.classes) {
    const isModel = cls.bases.some((b) => HF_MODEL_BASES.has(b));
    if (isModel) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "model", mlFramework: "huggingface" },
      } as SemanticFact);
    }

    const isTrainer = cls.bases.some((b) => HF_TRAINER_BASES.has(b));
    if (isTrainer) {
      facts.push({
        ...base,
        kind: "ControllerDeclared",
        controllerId: cls.id,
        classId: cls.id,
        name: cls.name,
        file: cls.file,
        paths: [],
        decorator: "",
        span: cls.span,
        metadata: { mlKind: "trainer", mlFramework: "huggingface" },
      } as SemanticFact);
    }

    const isTokenizer = cls.bases.some((b) => HF_TOKENIZER_BASES.has(b));
    if (isTokenizer) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "tokenizer", mlFramework: "huggingface" },
      } as SemanticFact);
    }
  }

  for (const call of project.calls) {
    if (call.calleeName === "pipeline" || call.calleeName === "transformers.pipeline") {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: call.ownerId,
        name: call.calleeName,
        file: call.file,
        classId: call.ownerId,
        providerKind: "factory",
        span: call.span,
        metadata: { mlKind: "pipeline", mlFramework: "huggingface" },
      } as SemanticFact);
    }
  }

  return facts;
}

// --- scikit-learn analyzer ---

const SKLEARN_MODULES = new Set([
  "sklearn", "sklearn.base", "sklearn.pipeline", "sklearn.model_selection",
  "sklearn.preprocessing", "sklearn.metrics", "sklearn.linear_model",
  "sklearn.tree", "sklearn.ensemble", "sklearn.svm", "sklearn.neighbors",
  "sklearn.cluster", "sklearn.decomposition", "sklearn.neural_network",
  "sklearn.feature_extraction", "sklearn.feature_selection",
  "sklearn.utils", "sklearn.datasets", "sklearn.compose",
]);

const SKLEARN_ESTIMATOR_BASES = new Set([
  "BaseEstimator", "sklearn.base.BaseEstimator",
  "ClassifierMixin", "sklearn.base.ClassifierMixin",
  "RegressorMixin", "sklearn.base.RegressorMixin",
  "ClusterMixin", "sklearn.base.ClusterMixin",
]);

const SKLEARN_TRANSFORMER_BASES = new Set([
  "TransformerMixin", "sklearn.base.TransformerMixin",
]);

export function createScikitLearnAnalyzer(): PythonFrameworkAnalyzer {
  return {
    id: "@0xsarwagya/ontoly-semantic-python:sklearn",
    name: "scikit-learn",
    version: "1.0.0",
    capabilities: ["estimators", "transformers", "pipelines"],
    detect: (project) => {
      const importEvidence = project.imports
        .filter((i) => SKLEARN_MODULES.has(i.module) || i.module.startsWith("sklearn."))
        .map((i) => i.module);
      const ev = [...new Set(importEvidence)].sort();
      return {
        framework: "scikit-learn",
        detected: ev.length > 0,
        confidence: ev.length > 0 ? "exact" : "low",
        evidence: ev,
        analyzerId: "@0xsarwagya/ontoly-semantic-python:sklearn",
        analyzerVersion: "1.0.0",
        coverage: ev.length > 0 ? 100 : 0,
      };
    },
    analyze: (project) => analyzeScikitLearn(project),
  };
}

function analyzeScikitLearn(project: PythonProject): SemanticFact[] {
  const facts: SemanticFact[] = [];
  const base: Pick<SemanticFact, "analyzerId" | "framework" | "confidence"> = {
    analyzerId: "@0xsarwagya/ontoly-semantic-python:sklearn",
    framework: "scikit-learn",
    confidence: "exact",
  };

  for (const cls of project.classes) {
    const isEstimator = cls.bases.some((b) => SKLEARN_ESTIMATOR_BASES.has(b));
    if (isEstimator) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "estimator", mlFramework: "sklearn" },
      } as SemanticFact);
    }

    const isTransformer = cls.bases.some((b) => SKLEARN_TRANSFORMER_BASES.has(b));
    if (isTransformer) {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: cls.id,
        name: cls.name,
        file: cls.file,
        classId: cls.id,
        providerKind: "class",
        span: cls.span,
        metadata: { mlKind: "transformer", mlFramework: "sklearn" },
      } as SemanticFact);
    }
  }

  for (const call of project.calls) {
    if (call.calleeName === "Pipeline" || call.calleeName === "make_pipeline"
      || call.calleeName === "sklearn.pipeline.Pipeline" || call.calleeName === "sklearn.pipeline.make_pipeline") {
      facts.push({
        ...base,
        kind: "ProviderDeclared",
        providerId: call.ownerId,
        name: call.calleeName,
        file: call.file,
        classId: call.ownerId,
        providerKind: "factory",
        span: call.span,
        metadata: { mlKind: "pipeline", mlFramework: "sklearn" },
      } as SemanticFact);
    }
  }

  return facts;
}

export type {
  DetectionResult,
  SemanticFact,
} from "@0xsarwagya/ontoly-semantic";

export type {
  PythonProject,
} from "@0xsarwagya/ontoly-python";
