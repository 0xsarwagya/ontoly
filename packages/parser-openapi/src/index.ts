import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createEdgeId,
  createNodeId,
  createSyntaxEvidence,
  normalizePath,
  type JsonObject,
  type SoftwareGraphDiagnostic,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";
import { compilerDiagnostic, type CompilerPass, type CompilerRelationship, type CompilerSymbol, type SourceProvider } from "@0xsarwagya/ontoly-compiler";

export const OPENAPI_FRONTEND_NAME = "openapi";
export const OPENAPI_FRONTEND_PASS_ID = "@0xsarwagya/ontoly-parser-openapi:frontend";
export const OPENAPI_FRONTEND_VERSION = "1.0.0";

type JsonRecord = Record<string, unknown>;

interface OpenApiContext {
  readonly root: string;
  readonly passId: string;
  readonly file: string;
  readonly symbols: Map<string, CompilerSymbol>;
  readonly relationships: Map<string, CompilerRelationship>;
  readonly diagnostics: SoftwareGraphDiagnostic[];
}

const HTTP_METHODS = ["delete", "get", "head", "options", "patch", "post", "put", "trace"] as const;

export function createOpenApiFrontendPass(options: {
  readonly id?: string | undefined;
} = {}): CompilerPass {
  const passId = options.id ?? OPENAPI_FRONTEND_PASS_ID;

  return {
    id: passId,
    kind: "parser",
    stage: "frontend-parsing",
    semantic: true,
    reads: ["source-inventory"],
    writes: ["compiler-symbols:openapi", "compiler-relationships:openapi"],
    run: async (context, state) => {
      const symbols = new Map<string, CompilerSymbol>();
      const relationships = new Map<string, CompilerRelationship>();
      const diagnostics: SoftwareGraphDiagnostic[] = [];
      const files = (state.sources?.sources.map((source) => source.path) ?? [])
        .filter((file) => file.endsWith(".json"))
        .sort();
      let documentCount = 0;

      for (const file of files) {
        const parsed = await readOpenApiDocument(context.invocation.root, file, diagnostics, context.invocation.sourceProvider);

        if (!parsed) {
          continue;
        }

        documentCount += 1;
        collectOpenApiFacts({
          root: context.invocation.root,
          passId,
          file,
          symbols,
          relationships,
          diagnostics,
        }, parsed);
      }

      return {
        symbols: [...symbols.values()].sort(compareSymbols),
        relationships: [...relationships.values()].sort(compareRelationships),
        diagnostics: diagnostics.sort(compareDiagnostics),
        parserVersions: {
          [OPENAPI_FRONTEND_NAME]: OPENAPI_FRONTEND_VERSION,
        },
        output: {
          documents: documentCount,
          symbols: symbols.size,
          relationships: relationships.size,
        },
      };
    },
  };
}

async function readOpenApiDocument(
  root: string,
  file: string,
  diagnostics: SoftwareGraphDiagnostic[],
  provider?: SourceProvider,
): Promise<JsonRecord | undefined> {
  let contents: string;

  try {
    const fromProvider = provider?.readFile(normalizePath(file));
    contents = fromProvider !== undefined ? fromProvider : await readFile(join(root, file), "utf8");
  } catch (error) {
    diagnostics.push(compilerDiagnostic({
      code: "OPENAPI_FILE_READ_FAILED",
      severity: "warning",
      message: `Could not read OpenAPI candidate ${file}.`,
      span: fileSpan(file),
      metadata: { file, error: error instanceof Error ? error.message : String(error) },
    }));
    return undefined;
  }

  let value: unknown;

  try {
    value = JSON.parse(contents);
  } catch {
    return undefined;
  }

  if (!isRecord(value) || (typeof value.openapi !== "string" && typeof value.swagger !== "string")) {
    return undefined;
  }

  return value;
}

function collectOpenApiFacts(context: OpenApiContext, document: JsonRecord): void {
  const documentId = createNodeId({ type: "Configuration", file: context.file, name: "openapi" });
  const info = isRecord(document.info) ? document.info : {};
  const title = readString(info, "title") ?? "OpenAPI";

  addSymbol(context, {
    id: documentId,
    kind: "Configuration",
    name: title,
    file: context.file,
    metadata: {
      configurationKind: "openapi",
      openapi: readString(document, "openapi") ?? readString(document, "swagger"),
      title,
      version: readString(info, "version"),
    },
  });

  const schemaIds = collectSchemas(context, document);
  collectPaths(context, documentId, document, schemaIds);
}

function collectSchemas(context: OpenApiContext, document: JsonRecord): ReadonlyMap<string, string> {
  const components = isRecord(document.components) ? document.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  const schemaIds = new Map<string, string>();

  for (const [schemaName, schemaValue] of Object.entries(schemas).sort(([left], [right]) => left.localeCompare(right))) {
    const modelId = createNodeId({ type: "Model", name: schemaName });
    const schema = isRecord(schemaValue) ? schemaValue : {};
    schemaIds.set(schemaName, modelId);
    addSymbol(context, {
      id: modelId,
      kind: "Model",
      name: schemaName,
      file: context.file,
      metadata: {
        source: "openapi.components.schemas",
        schemaType: readString(schema, "type"),
      },
    });

    const properties = isRecord(schema.properties) ? schema.properties : {};

    for (const [fieldName, fieldSchema] of Object.entries(properties).sort(([left], [right]) => left.localeCompare(right))) {
      const fieldId = createNodeId({ type: "Field", file: context.file, name: `${schemaName}.${fieldName}` });
      const field = isRecord(fieldSchema) ? fieldSchema : {};

      addSymbol(context, {
        id: fieldId,
        kind: "Field",
        name: `${schemaName}.${fieldName}`,
        file: context.file,
        metadata: {
          modelId,
          fieldName,
          schemaType: readString(field, "type"),
          required: readStringArray(schema, "required").includes(fieldName),
        },
      });
      addRelationship(context, "CONTAINS", modelId, fieldId, "schema contains field");
    }
  }

  return schemaIds;
}

function collectPaths(
  context: OpenApiContext,
  documentId: string,
  document: JsonRecord,
  schemaIds: ReadonlyMap<string, string>,
): void {
  const paths = isRecord(document.paths) ? document.paths : {};

  for (const [path, pathItem] of Object.entries(paths).sort(([left], [right]) => left.localeCompare(right))) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (!isRecord(operation)) {
        continue;
      }

      const upperMethod = method.toUpperCase();
      const routeId = createNodeId({ type: "Route", name: `${upperMethod}:${path}` });
      const operationId = readString(operation, "operationId") ?? `${upperMethod}:${path}`;
      const operationNodeId = createNodeId({ type: "Operation", file: context.file, name: operationId });

      addSymbol(context, {
        id: routeId,
        kind: "Route",
        name: `${upperMethod}:${path}`,
        file: context.file,
        metadata: {
          method: upperMethod,
          path,
          source: "openapi.paths",
        },
      });
      addSymbol(context, {
        id: operationNodeId,
        kind: "Operation",
        name: operationId,
        file: context.file,
        metadata: {
          method: upperMethod,
          path,
          summary: readString(operation, "summary"),
          tags: readStringArray(operation, "tags"),
        },
      });
      addRelationship(context, "EXPOSES", documentId, routeId, "OpenAPI document exposes route");
      addRelationship(context, "HANDLES", routeId, operationNodeId, "route maps to OpenAPI operation");

      collectOperationTags(context, operationNodeId, operation);
      collectOperationParameters(context, operationNodeId, operation);
      collectOperationSecurity(context, operationNodeId, operation);
      collectOperationSchemaReferences(context, operationNodeId, operation, schemaIds);
    }
  }
}

function collectOperationTags(context: OpenApiContext, operationId: string, operation: JsonRecord): void {
  for (const tag of readStringArray(operation, "tags")) {
    const resourceId = createNodeId({ type: "Resource", name: tag });

    addSymbol(context, {
      id: resourceId,
      kind: "Resource",
      name: tag,
      metadata: {
        source: "openapi.operation.tags",
      },
    });
    addRelationship(context, "BELONGS_TO", operationId, resourceId, "operation belongs to resource tag");
  }
}

function collectOperationParameters(context: OpenApiContext, operationId: string, operation: JsonRecord): void {
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];

  for (const parameter of parameters) {
    if (!isRecord(parameter)) {
      continue;
    }

    const parameterName = readString(parameter, "name");

    if (!parameterName) {
      continue;
    }

    const fieldId = createNodeId({ type: "Field", file: context.file, name: `${operationId}:${parameterName}` });

    addSymbol(context, {
      id: fieldId,
      kind: "Field",
      name: parameterName,
      file: context.file,
      metadata: {
        source: "openapi.operation.parameters",
        in: readString(parameter, "in"),
        required: readBoolean(parameter, "required"),
      },
    });
    addRelationship(context, "USES", operationId, fieldId, "operation uses parameter");
  }
}

function collectOperationSecurity(context: OpenApiContext, operationId: string, operation: JsonRecord): void {
  const security = Array.isArray(operation.security) ? operation.security : [];

  for (const requirement of security) {
    if (!isRecord(requirement)) {
      continue;
    }

    for (const permissionName of Object.keys(requirement).sort()) {
      const permissionId = createNodeId({ type: "Permission", name: permissionName });

      addSymbol(context, {
        id: permissionId,
        kind: "Permission",
        name: permissionName,
        metadata: {
          source: "openapi.operation.security",
        },
      });
      addRelationship(context, "AUTHORIZES", permissionId, operationId, "security requirement authorizes operation");
    }
  }
}

function collectOperationSchemaReferences(
  context: OpenApiContext,
  operationId: string,
  operation: JsonRecord,
  schemaIds: ReadonlyMap<string, string>,
): void {
  for (const reference of collectRefs(operation)) {
    const schemaName = reference.split("/").at(-1);
    const modelId = schemaName ? schemaIds.get(schemaName) : undefined;

    if (modelId) {
      addRelationship(context, "REFERENCES", operationId, modelId, "operation references schema", {
        ref: reference,
      });
    }
  }
}

function addSymbol(context: OpenApiContext, input: Omit<CompilerSymbol, "span" | "language" | "provenance"> & {
  readonly span?: SourceSpan | undefined;
  readonly language?: string | undefined;
}): void {
  if (context.symbols.has(input.id)) {
    return;
  }

  context.symbols.set(input.id, {
    ...input,
    span: input.span ?? (input.file ? fileSpan(input.file) : undefined),
    language: input.language ?? "openapi",
    provenance: {
      passId: context.passId,
      parser: OPENAPI_FRONTEND_NAME,
      parserVersion: OPENAPI_FRONTEND_VERSION,
      source: "openapi",
    },
  });
}

function addRelationship(
  context: OpenApiContext,
  type: CompilerRelationship["type"],
  from: string,
  to: string,
  description: string,
  metadata?: JsonObject | undefined,
): void {
  const id = createEdgeId(type, from, to);

  if (context.relationships.has(id)) {
    return;
  }

  context.relationships.set(id, {
    id,
    type,
    from,
    to,
    evidence: [createSyntaxEvidence(fileSpan(context.file), description)],
    metadata,
  });
}

function collectRefs(value: unknown): readonly string[] {
  const refs = new Set<string>();
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      for (const child of item) {
        visit(child);
      }
      return;
    }

    if (!isRecord(item)) {
      return;
    }

    const ref = item.$ref;

    if (typeof ref === "string") {
      refs.add(ref);
    }

    for (const child of Object.values(item)) {
      visit(child);
    }
  };

  visit(value);
  return [...refs].sort();
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readBoolean(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(record: JsonRecord, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").sort() : [];
}

function fileSpan(file: string): SourceSpan {
  return {
    file: normalizePath(file),
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1,
  };
}

function compareSymbols(left: CompilerSymbol, right: CompilerSymbol): number {
  return left.id.localeCompare(right.id);
}

function compareRelationships(left: CompilerRelationship, right: CompilerRelationship): number {
  const leftId = left.id ?? createEdgeId(left.type, left.from, left.to);
  const rightId = right.id ?? createEdgeId(right.type, right.from, right.to);
  return leftId.localeCompare(rightId);
}

function compareDiagnostics(left: SoftwareGraphDiagnostic, right: SoftwareGraphDiagnostic): number {
  return left.id.localeCompare(right.id);
}
