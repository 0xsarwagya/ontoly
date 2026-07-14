import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import ts from "typescript";
import {
  createDiagnosticId,
  createNodeId,
  normalizePath,
  stableHash,
  stableStringify,
  type DiagnosticSeverity,
  type JsonObject,
  type NodeType,
  type RelationshipType,
  type SoftwareGraphDiagnostic,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";

export const TYPESCRIPT_SEMANTIC_MODEL_VERSION = "1.0.0";
export const TYPESCRIPT_ANALYZER_NAME = "typescript";
export const TYPESCRIPT_ANALYZER_VERSION = ts.version;

export interface AnalyzeTypeScriptProjectInput {
  readonly root: string;
  readonly files?: readonly string[] | undefined;
  readonly compilerOptions?: ts.CompilerOptions | undefined;
}

export interface TypeScriptProject {
  readonly version: string;
  readonly root: string;
  readonly compilerVersion: string;
  readonly files: readonly TypeScriptSourceFile[];
  readonly sourceFiles: readonly TypeScriptSourceFile[];
  readonly symbols: readonly TypeScriptSymbol[];
  readonly classes: readonly TypeScriptClass[];
  readonly interfaces: readonly TypeScriptInterface[];
  readonly functions: readonly TypeScriptFunction[];
  readonly methods: readonly TypeScriptMethod[];
  readonly variables: readonly TypeScriptVariable[];
  readonly enums: readonly TypeScriptEnum[];
  readonly namespaces: readonly TypeScriptNamespace[];
  readonly imports: readonly TypeScriptImport[];
  readonly exports: readonly TypeScriptExport[];
  readonly calls: readonly TypeScriptCall[];
  readonly decorators: readonly TypeScriptDecorator[];
  readonly types: readonly TypeScriptTypeReference[];
  readonly heritage: readonly TypeScriptHeritage[];
  readonly constructors: readonly TypeScriptConstructor[];
  readonly creates: readonly TypeScriptCreateExpression[];
  readonly throws: readonly TypeScriptThrowExpression[];
  readonly environmentAccesses: readonly TypeScriptEnvironmentAccess[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly metadata: TypeScriptSemanticModelMetadata;
}

export interface TypeScriptSemanticModelMetadata {
  readonly generatedAt: string;
  readonly deterministicHash: string;
  readonly fileCount: number;
  readonly symbolCount: number;
}

export interface TypeScriptSourceFile {
  readonly id: string;
  readonly file: string;
  readonly absoluteFile: string;
  readonly extension: string;
  readonly span: SourceSpan;
}

export interface TypeScriptSymbol {
  readonly id: string;
  readonly kind: NodeType;
  readonly name: string;
  readonly file?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface TypeScriptClass {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly decorators: readonly TypeScriptDecorator[];
  readonly typeParameters: number;
  readonly abstract: boolean;
  readonly exported: boolean;
  readonly default: boolean;
}

export interface TypeScriptInterface {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly typeParameters: number;
  readonly exported: boolean;
}

export interface TypeScriptFunction {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly async: boolean;
  readonly generator: boolean;
  readonly parameters: number;
  readonly typeParameters: number;
  readonly exported: boolean;
  readonly default: boolean;
  readonly declarationKind: "function" | "variable";
}

export interface TypeScriptMethod {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly className: string;
  readonly methodName: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly decorators: readonly TypeScriptDecorator[];
  readonly async: boolean;
  readonly static: boolean;
  readonly abstract: boolean;
  readonly parameters: number;
  readonly typeParameters: number;
}

export interface TypeScriptVariable {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly typeName?: string | undefined;
  readonly initializerText?: string | undefined;
  readonly initializerCalleeName?: string | undefined;
  readonly initializerKind?: string | undefined;
  readonly ownerId: string;
}

export interface TypeScriptEnum {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly exported: boolean;
  readonly const: boolean;
  readonly members: number;
}

export interface TypeScriptNamespace {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly exported: boolean;
  readonly declarationKind: "namespace" | "external-module";
}

export interface TypeScriptDecorator {
  readonly id: string;
  readonly name: string;
  readonly expression: string;
  readonly arguments: readonly TypeScriptExpression[];
  readonly targetId: string;
  readonly targetKind: NodeType | "Parameter";
  readonly file: string;
  readonly span: SourceSpan;
}

export interface TypeScriptExpression {
  readonly text: string;
  readonly kind: string;
  readonly name?: string | undefined;
  readonly literal?: string | undefined;
}

export interface TypeScriptImport {
  readonly id: string;
  readonly file: string;
  readonly moduleId: string;
  readonly specifier: string;
  readonly importKind: "type" | "value";
  readonly defaultBinding?: string | undefined;
  readonly namespaceBinding?: string | undefined;
  readonly namedBindings: readonly TypeScriptImportBinding[];
  readonly sideEffectOnly: boolean;
  readonly targetId: string;
  readonly targetKind: NodeType;
  readonly targetName: string;
  readonly targetFile?: string | undefined;
  readonly unresolved?: boolean | undefined;
  readonly span: SourceSpan;
}

export interface TypeScriptImportBinding {
  readonly localName: string;
  readonly importedName: string;
  readonly typeOnly: boolean;
  readonly targetId?: string | undefined;
}

export interface TypeScriptExport {
  readonly id: string;
  readonly file: string;
  readonly moduleId: string;
  readonly name: string;
  readonly exportKind: "default" | "exportEquals" | "namespace" | "star" | "type" | "value";
  readonly localName?: string | undefined;
  readonly specifier?: string | undefined;
  readonly declarationKind?: string | undefined;
  readonly reexport?: boolean | undefined;
  readonly targetId?: string | undefined;
  readonly span: SourceSpan;
}

export interface TypeScriptCall {
  readonly id: string;
  readonly file: string;
  readonly ownerId: string;
  readonly expression: string;
  readonly calleeName?: string | undefined;
  readonly receiverName?: string | undefined;
  readonly methodName?: string | undefined;
  readonly arguments: readonly TypeScriptExpression[];
  readonly targetId?: string | undefined;
  readonly span: SourceSpan;
}

export interface TypeScriptTypeReference {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly relationship: Extract<RelationshipType, "RETURNS" | "USES">;
  readonly usage: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
}

export interface TypeScriptHeritage {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly relationship: Extract<RelationshipType, "EXTENDS" | "IMPLEMENTS">;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
}

export interface TypeScriptConstructor {
  readonly id: string;
  readonly classId: string;
  readonly className: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly parameters: readonly TypeScriptConstructorParameter[];
}

export interface TypeScriptConstructorParameter {
  readonly name: string;
  readonly typeName?: string | undefined;
  readonly targetIds: readonly string[];
  readonly decorators: readonly TypeScriptDecorator[];
  readonly span: SourceSpan;
}

export interface TypeScriptCreateExpression {
  readonly id: string;
  readonly ownerId: string;
  readonly targetId: string;
  readonly expression: string;
  readonly file: string;
  readonly span: SourceSpan;
}

export interface TypeScriptThrowExpression {
  readonly id: string;
  readonly ownerId: string;
  readonly exceptionName: string;
  readonly targetId?: string | undefined;
  readonly expression: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly expressionSpan: SourceSpan;
}

export interface TypeScriptEnvironmentAccess {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly access: "read" | "write";
  readonly file: string;
  readonly span: SourceSpan;
}

export interface TypeScriptSemanticModelValidationIssue {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
}

export interface TypeScriptSemanticModelValidationResult {
  readonly ok: boolean;
  readonly issues: readonly TypeScriptSemanticModelValidationIssue[];
}

interface AnalyzerContext {
  readonly root: string;
  readonly absoluteFile: string;
  readonly relativeFile: string;
  readonly sourceFile: ts.SourceFile;
  readonly compilerOptions: ts.CompilerOptions;
  readonly moduleId: string;
  readonly symbols: Map<string, TypeScriptSymbol>;
  readonly classes: TypeScriptClass[];
  readonly interfaces: TypeScriptInterface[];
  readonly functions: TypeScriptFunction[];
  readonly methods: TypeScriptMethod[];
  readonly variables: TypeScriptVariable[];
  readonly enums: TypeScriptEnum[];
  readonly namespaces: TypeScriptNamespace[];
  readonly imports: TypeScriptImport[];
  readonly exports: TypeScriptExport[];
  readonly calls: TypeScriptCall[];
  readonly decorators: TypeScriptDecorator[];
  readonly types: TypeScriptTypeReference[];
  readonly heritage: TypeScriptHeritage[];
  readonly constructors: TypeScriptConstructor[];
  readonly creates: TypeScriptCreateExpression[];
  readonly throws: TypeScriptThrowExpression[];
  readonly environmentAccesses: TypeScriptEnvironmentAccess[];
  readonly diagnostics: SoftwareGraphDiagnostic[];
  readonly localSymbols: Map<string, string>;
  readonly importedIdentifiers: Map<string, string>;
  readonly variableTypes: Map<string, string>;
  readonly methodsByQualifiedName: Map<string, string>;
  readonly projectMethodsByQualifiedName: Map<string, string>;
  readonly importRecords: ImportRecord[];
  readonly exportRecords: ExportRecord[];
}

interface ImportRecord {
  readonly declaration: ts.ImportDeclaration;
  readonly model: TypeScriptImport;
}

interface ExportRecord {
  readonly node: ts.Node;
  readonly model: TypeScriptExport;
}

const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

export async function analyze(rootOrInput: string | AnalyzeTypeScriptProjectInput): Promise<TypeScriptProject> {
  const input = typeof rootOrInput === "string" ? { root: rootOrInput } : rootOrInput;
  return analyzeTypeScriptProject(input);
}

export function analyzeTypeScriptProject(input: AnalyzeTypeScriptProjectInput): TypeScriptProject {
  const root = resolve(input.root);
  const files = (input.files ?? listTypeScriptFiles(root))
    .filter(isTypeScriptSourcePath)
    .map((file) => resolve(root, file))
    .sort((left, right) => left.localeCompare(right));
  const fileSet = new Set(files.map((file) => normalizePath(resolve(file))));
  const compilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    skipLibCheck: true,
    allowJs: false,
    ...loadProjectCompilerOptions(root, input.compilerOptions),
  };
  const program = ts.createProgram(files, compilerOptions);
  const sourceFiles = program
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile)
    .filter((sourceFile) => fileSet.has(normalizePath(resolve(sourceFile.fileName))))
    .sort((left, right) => toRelativePath(root, left.fileName).localeCompare(toRelativePath(root, right.fileName)));
  const relativeFiles = new Set(sourceFiles.map((sourceFile) => toRelativePath(root, sourceFile.fileName)));
  const symbols = new Map<string, TypeScriptSymbol>();
  const diagnostics: SoftwareGraphDiagnostic[] = [];
  const projectMethodsByQualifiedName = new Map<string, string>();
  const contexts: AnalyzerContext[] = [];
  const filesModel: TypeScriptSourceFile[] = [];

  for (const sourceFile of sourceFiles) {
    const relativeFile = toRelativePath(root, sourceFile.fileName);
    const moduleId = createNodeId({ type: "Module", name: relativeFile });
    const sourceFileModel: TypeScriptSourceFile = {
      id: moduleId,
      file: relativeFile,
      absoluteFile: normalizePath(resolve(sourceFile.fileName)),
      extension: extname(relativeFile),
      span: sourceSpan(sourceFile, sourceFile, relativeFile),
    };
    filesModel.push(sourceFileModel);

    const context: AnalyzerContext = {
      root,
      absoluteFile: sourceFileModel.absoluteFile,
      relativeFile,
      sourceFile,
      compilerOptions: program.getCompilerOptions(),
      moduleId,
      symbols,
      classes: [],
      interfaces: [],
      functions: [],
      methods: [],
      variables: [],
      enums: [],
      namespaces: [],
      imports: [],
      exports: [],
      calls: [],
      decorators: [],
      types: [],
      heritage: [],
      constructors: [],
      creates: [],
      throws: [],
      environmentAccesses: [],
      diagnostics,
      localSymbols: new Map(),
      importedIdentifiers: new Map(),
      variableTypes: new Map(),
      methodsByQualifiedName: new Map(),
      projectMethodsByQualifiedName,
      importRecords: [],
      exportRecords: [],
    };

    addSymbol(context, {
      id: moduleId,
      kind: "Module",
      name: relativeFile,
      file: relativeFile,
      span: sourceFileModel.span,
      metadata: {
        extension: extname(relativeFile),
      },
    });
    collectSyntacticDiagnostics(root, program.getSyntacticDiagnostics(sourceFile), diagnostics);
    contexts.push(context);
  }

  for (const context of contexts) {
    for (const statement of context.sourceFile.statements) {
      collectTopLevelStatement(context, statement, relativeFiles);
    }
  }

  const contextsByFile = new Map(contexts.map((context) => [context.relativeFile, context] as const));

  for (const context of contexts) {
    resolveImportedBindings(context, contextsByFile);
  }

  for (const context of contexts) {
    resolveExports(context, contextsByFile);
  }

  for (const context of contexts) {
    collectDeclarationSemantics(context);
  }

  for (const context of contexts) {
    collectCalls(context);
    collectModuleSemantics(context);
  }

  const project = normalizeProject({
    version: TYPESCRIPT_SEMANTIC_MODEL_VERSION,
    root,
    compilerVersion: TYPESCRIPT_ANALYZER_VERSION,
    files: filesModel,
    sourceFiles: filesModel,
    symbols: [...symbols.values()],
    classes: contexts.flatMap((context) => context.classes),
    interfaces: contexts.flatMap((context) => context.interfaces),
    functions: contexts.flatMap((context) => context.functions),
    methods: contexts.flatMap((context) => context.methods),
    variables: contexts.flatMap((context) => context.variables),
    enums: contexts.flatMap((context) => context.enums),
    namespaces: contexts.flatMap((context) => context.namespaces),
    imports: contexts.flatMap((context) => context.imports),
    exports: contexts.flatMap((context) => context.exports),
    calls: contexts.flatMap((context) => context.calls),
    decorators: contexts.flatMap((context) => context.decorators),
    types: contexts.flatMap((context) => context.types),
    heritage: contexts.flatMap((context) => context.heritage),
    constructors: contexts.flatMap((context) => context.constructors),
    creates: contexts.flatMap((context) => context.creates),
    throws: contexts.flatMap((context) => context.throws),
    environmentAccesses: contexts.flatMap((context) => context.environmentAccesses),
    diagnostics: dedupeDiagnostics(diagnostics),
    metadata: {
      generatedAt: "1970-01-01T00:00:00.000Z",
      deterministicHash: "",
      fileCount: filesModel.length,
      symbolCount: symbols.size,
    },
  });

  return {
    ...project,
    metadata: {
      ...project.metadata,
      deterministicHash: stableHash(stableStringify({ ...project, metadata: undefined })),
    },
  };
}

export function serializeTypeScriptProject(project: TypeScriptProject): string {
  return `${JSON.stringify(normalizeProject(project), null, 2)}\n`;
}

export function deserializeTypeScriptProject(contents: string): TypeScriptProject {
  return normalizeProject(JSON.parse(contents) as TypeScriptProject);
}

export function writeTypeScriptSemanticModel(project: TypeScriptProject, path: string): void {
  writeFileSync(path, serializeTypeScriptProject(project), "utf8");
}

export function validateTypeScriptSemanticModel(project: TypeScriptProject): TypeScriptSemanticModelValidationResult {
  const issues: TypeScriptSemanticModelValidationIssue[] = [];
  const symbolIds = new Set<string>();

  if (project.version !== TYPESCRIPT_SEMANTIC_MODEL_VERSION) {
    issues.push({
      code: "UNSUPPORTED_TYPESCRIPT_SEMANTIC_MODEL_VERSION",
      severity: "error",
      message: `Unsupported TypeScript semantic model version ${project.version}.`,
    });
  }

  for (const symbol of project.symbols) {
    if (symbolIds.has(symbol.id)) {
      issues.push({
        code: "DUPLICATE_TYPESCRIPT_SYMBOL",
        severity: "error",
        message: `Duplicate TypeScript symbol id ${symbol.id}.`,
      });
    }

    symbolIds.add(symbol.id);
  }

  for (const call of project.calls) {
    if (!symbolIds.has(call.ownerId)) {
      issues.push({
        code: "MISSING_CALL_OWNER",
        severity: "error",
        message: `Call ${call.id} references missing owner ${call.ownerId}.`,
      });
    }
  }

  for (const decorator of project.decorators) {
    if (decorator.targetKind !== "Parameter" && !symbolIds.has(decorator.targetId)) {
      issues.push({
        code: "MISSING_DECORATOR_TARGET",
        severity: "error",
        message: `Decorator ${decorator.id} references missing target ${decorator.targetId}.`,
      });
    }
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues: issues.sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message)),
  };
}

function collectTopLevelStatement(
  context: AnalyzerContext,
  statement: ts.Statement,
  relativeFiles: ReadonlySet<string>,
): void {
  if (ts.isImportDeclaration(statement)) {
    addImport(context, statement, relativeFiles);
    return;
  }

  if (ts.isExportDeclaration(statement)) {
    addExportDeclaration(context, statement);
    return;
  }

  if (ts.isExportAssignment(statement)) {
    addExportAssignment(context, statement);
    return;
  }

  if (ts.isFunctionDeclaration(statement)) {
    const name = declarationName(statement.name, statement);

    if (name) {
      const id = addDeclarationSymbol(context, "Function", name, statement, functionMetadata(statement));
      context.functions.push({
        id,
        name,
        file: context.relativeFile,
        span: sourceSpan(context.sourceFile, statement, context.relativeFile),
        async: hasModifier(statement, ts.SyntaxKind.AsyncKeyword),
        generator: Boolean(statement.asteriskToken),
        parameters: statement.parameters.length,
        typeParameters: statement.typeParameters?.length ?? 0,
        exported: isExported(statement),
        default: isDefaultExport(statement),
        declarationKind: "function",
      });
      addExportForDeclaration(context, statement, name, "function", id, symbolExportKind(statement, "value"));
    }

    return;
  }

  if (ts.isClassDeclaration(statement)) {
    const name = declarationName(statement.name, statement);

    if (name) {
      const id = addDeclarationSymbol(context, "Class", name, statement, classMetadata(statement));
      const decorators = addDecorators(context, statement, id, "Class");
      context.classes.push({
        id,
        name,
        file: context.relativeFile,
        span: sourceSpan(context.sourceFile, statement, context.relativeFile),
        decorators,
        typeParameters: statement.typeParameters?.length ?? 0,
        abstract: hasModifier(statement, ts.SyntaxKind.AbstractKeyword),
        exported: isExported(statement),
        default: isDefaultExport(statement),
      });
      addExportForDeclaration(context, statement, name, "class", id, symbolExportKind(statement, "value"));
      addClassMethodSymbols(context, statement, name, id);
    }

    return;
  }

  if (ts.isInterfaceDeclaration(statement)) {
    const id = addDeclarationSymbol(context, "Interface", statement.name.text, statement, interfaceMetadata(statement));
    context.interfaces.push({
      id,
      name: statement.name.text,
      file: context.relativeFile,
      span: sourceSpan(context.sourceFile, statement, context.relativeFile),
      typeParameters: statement.typeParameters?.length ?? 0,
      exported: isExported(statement),
    });
    addExportForDeclaration(context, statement, statement.name.text, "interface", id, symbolExportKind(statement, "type"));
    return;
  }

  if (ts.isTypeAliasDeclaration(statement)) {
    const id = addDeclarationSymbol(context, "TypeAlias", statement.name.text, statement, typeAliasMetadata(statement));
    addExportForDeclaration(context, statement, statement.name.text, "type-alias", id, symbolExportKind(statement, "type"));
    return;
  }

  if (ts.isEnumDeclaration(statement)) {
    const id = addDeclarationSymbol(context, "Enum", statement.name.text, statement, enumMetadata(statement));
    context.enums.push({
      id,
      name: statement.name.text,
      file: context.relativeFile,
      span: sourceSpan(context.sourceFile, statement, context.relativeFile),
      exported: isExported(statement),
      const: hasModifier(statement, ts.SyntaxKind.ConstKeyword),
      members: statement.members.length,
    });
    addExportForDeclaration(context, statement, statement.name.text, "enum", id, symbolExportKind(statement, "value"));
    return;
  }

  if (ts.isModuleDeclaration(statement)) {
    const name = statement.name.getText(context.sourceFile).replace(/^["']|["']$/g, "");
    const id = addDeclarationSymbol(context, "Namespace", name, statement, {
      exported: isExported(statement),
      default: false,
      declarationKind: ts.isStringLiteral(statement.name) ? "external-module" : "namespace",
    });
    context.namespaces.push({
      id,
      name,
      file: context.relativeFile,
      span: sourceSpan(context.sourceFile, statement, context.relativeFile),
      exported: isExported(statement),
      declarationKind: ts.isStringLiteral(statement.name) ? "external-module" : "namespace",
    });
    addExportForDeclaration(context, statement, statement.name.getText(context.sourceFile), "namespace", id, symbolExportKind(statement, "value"));
    return;
  }

  if (ts.isVariableStatement(statement)) {
    addFunctionVariableSymbols(context, statement);
    collectVariables(context, statement, context.moduleId);
  }
}

function addDeclarationSymbol(
  context: AnalyzerContext,
  kind: NodeType,
  name: string,
  node: ts.Node,
  metadata: JsonObject,
): string {
  const id = createNodeId({ type: kind, file: context.relativeFile, name });

  addSymbol(context, {
    id,
    kind,
    name,
    file: context.relativeFile,
    span: sourceSpan(context.sourceFile, node, context.relativeFile),
    metadata,
  });

  if (kind === "Method") {
    context.methodsByQualifiedName.set(name, id);
    context.projectMethodsByQualifiedName.set(name, id);
  } else {
    context.localSymbols.set(name, id);
  }

  return id;
}

function addClassMethodSymbols(
  context: AnalyzerContext,
  declaration: ts.ClassDeclaration,
  className: string,
  classId: string,
): void {
  for (const member of declaration.members) {
    if (!ts.isMethodDeclaration(member) || !member.name) {
      continue;
    }

    const methodName = propertyNameToString(member.name);

    if (!methodName) {
      continue;
    }

    const qualifiedName = `${className}.${methodName}`;
    const id = addDeclarationSymbol(context, "Method", qualifiedName, member, methodMetadata(member));
    const decorators = addDecorators(context, member, id, "Method");

    context.methods.push({
      id,
      name: qualifiedName,
      classId,
      className,
      methodName,
      file: context.relativeFile,
      span: sourceSpan(context.sourceFile, member, context.relativeFile),
      decorators,
      async: hasModifier(member, ts.SyntaxKind.AsyncKeyword),
      static: hasModifier(member, ts.SyntaxKind.StaticKeyword),
      abstract: hasModifier(member, ts.SyntaxKind.AbstractKeyword),
      parameters: member.parameters.length,
      typeParameters: member.typeParameters?.length ?? 0,
    });
  }
}

function addDecorators(
  context: AnalyzerContext,
  node: ts.Node,
  targetId: string,
  targetKind: NodeType | "Parameter",
): readonly TypeScriptDecorator[] {
  const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
  const models: TypeScriptDecorator[] = [];

  for (const decorator of decorators) {
    const name = expressionDisplayName(context.sourceFile, decorator.expression);

    if (!name) {
      continue;
    }

    const span = sourceSpan(context.sourceFile, decorator, context.relativeFile);
    const model: TypeScriptDecorator = {
      id: `tsdecorator:${stableHash(`${context.relativeFile}|${targetId}|${decorator.getStart(context.sourceFile)}|${decorator.getText(context.sourceFile)}`)}`,
      name: unqualifiedName(name),
      expression: decorator.expression.getText(context.sourceFile),
      arguments: decoratorArguments(decorator, context.sourceFile),
      targetId,
      targetKind,
      file: context.relativeFile,
      span,
    };
    context.decorators.push(model);
    models.push(model);
  }

  return models;
}

function addImport(
  context: AnalyzerContext,
  declaration: ts.ImportDeclaration,
  relativeFiles: ReadonlySet<string>,
): void {
  const details = importDetails(declaration);
  const resolved = resolveImport(context, relativeFiles, details.specifier);
  const id = createNodeId({
    type: "Import",
    file: context.relativeFile,
    name: `${details.specifier}:${stableHash(importKey(details))}`,
  });
  const span = sourceSpan(context.sourceFile, declaration, context.relativeFile);
  const model: TypeScriptImport = withOptionalProperties({
    id,
    file: context.relativeFile,
    moduleId: context.moduleId,
    specifier: details.specifier,
    importKind: details.importKind,
    namedBindings: details.namedBindings,
    sideEffectOnly: details.sideEffectOnly,
    targetId: resolved.targetId,
    targetKind: resolved.targetKind,
    targetName: resolved.targetName,
    span,
  }, {
    defaultBinding: details.defaultBinding,
    namespaceBinding: details.namespaceBinding,
    targetFile: resolved.targetFile,
    unresolved: resolved.unresolved,
  });

  context.imports.push(model);
  context.importRecords.push({ declaration, model });
  addSymbol(context, {
    id,
    kind: "Import",
    name: details.specifier,
    file: context.relativeFile,
    span,
    metadata: withOptionalProperties<JsonObject, JsonObject>({
      specifier: details.specifier,
      importKind: details.importKind,
      namedBindings: details.namedBindings.map(importBindingText).sort(),
      sideEffectOnly: details.sideEffectOnly,
    }, {
      defaultBinding: details.defaultBinding,
      namespaceBinding: details.namespaceBinding,
      targetFile: resolved.targetFile,
      unresolved: resolved.unresolved,
    }),
  });

  if (resolved.unresolved) {
    context.diagnostics.push(diagnostic({
      code: "TYPESCRIPT_BROKEN_IMPORT",
      severity: "warning",
      message: `Could not resolve import "${details.specifier}" from ${context.relativeFile}.`,
      span,
      metadata: {
        file: context.relativeFile,
        specifier: details.specifier,
        analyzer: TYPESCRIPT_ANALYZER_NAME,
      },
    }));
  }
}

function addExportDeclaration(context: AnalyzerContext, declaration: ts.ExportDeclaration): void {
  const specifier = moduleSpecifierText(declaration.moduleSpecifier);
  const exportClause = declaration.exportClause;

  if (!exportClause) {
    addExport(context, declaration, {
      name: "*",
      exportKind: "star",
      specifier,
      reexport: Boolean(specifier),
    });
    return;
  }

  if (ts.isNamespaceExport(exportClause)) {
    addExport(context, declaration, {
      name: exportClause.name.text,
      exportKind: "namespace",
      specifier,
      reexport: Boolean(specifier),
    });
    return;
  }

  for (const element of exportClause.elements) {
    const localName = element.propertyName?.text ?? element.name.text;
    const typeOnly = declaration.isTypeOnly || element.isTypeOnly;
    addExport(context, element, {
      name: element.name.text,
      exportKind: typeOnly ? "type" : "value",
      localName,
      specifier,
      reexport: Boolean(specifier),
    });
  }
}

function addExportAssignment(context: AnalyzerContext, declaration: ts.ExportAssignment): void {
  addExport(context, declaration, {
    name: declaration.isExportEquals ? "export=" : "default",
    exportKind: declaration.isExportEquals ? "exportEquals" : "default",
    localName: declaration.expression.getText(context.sourceFile),
  });
}

function addExport(
  context: AnalyzerContext,
  node: ts.Node,
  details: Omit<TypeScriptExport, "id" | "file" | "moduleId" | "span">,
): TypeScriptExport {
  const idName = details.name === "*" ? `*:${stableHash(details.specifier ?? "local")}` : details.name;
  const id = createNodeId({ type: "Export", file: context.relativeFile, name: idName });
  const span = sourceSpan(context.sourceFile, node, context.relativeFile);
  const model = withOptionalProperties<TypeScriptExport, Partial<TypeScriptExport>>({
    id,
    file: context.relativeFile,
    moduleId: context.moduleId,
    name: details.name,
    exportKind: details.exportKind,
    span,
  }, {
    localName: details.localName,
    specifier: details.specifier,
    declarationKind: details.declarationKind,
    reexport: details.reexport,
    targetId: details.targetId,
  });

  context.exports.push(model);
  context.exportRecords.push({ node, model });
  addSymbol(context, {
    id,
    kind: "Export",
    name: details.name,
    file: context.relativeFile,
    span,
    metadata: withOptionalProperties<JsonObject, JsonObject>({
      exportKind: details.exportKind,
    }, {
      localName: details.localName,
      specifier: details.specifier,
      declarationKind: details.declarationKind,
      reexport: details.reexport,
    }),
  });

  return model;
}

function addExportForDeclaration(
  context: AnalyzerContext,
  node: ts.Node,
  localName: string,
  declarationKind: string,
  targetId: string,
  exportKind: TypeScriptExport["exportKind"] | undefined,
): void {
  if (!exportKind) {
    return;
  }

  addExport(context, node, {
    name: exportKind === "default" ? "default" : localName,
    exportKind,
    localName,
    declarationKind,
    targetId,
  });
}

function addFunctionVariableSymbols(context: AnalyzerContext, statement: ts.VariableStatement): void {
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !isFunctionLikeInitializer(declaration.initializer)) {
      continue;
    }

    const name = declaration.name.text;
    const id = addDeclarationSymbol(context, "Function", name, declaration, {
      ...functionMetadata(declaration.initializer),
      declarationKind: "variable",
      exported: isExported(statement),
      default: false,
    });

    context.functions.push({
      id,
      name,
      file: context.relativeFile,
      span: sourceSpan(context.sourceFile, declaration, context.relativeFile),
      async: hasModifier(declaration.initializer, ts.SyntaxKind.AsyncKeyword),
      generator: false,
      parameters: declaration.initializer.parameters.length,
      typeParameters: declaration.initializer.typeParameters?.length ?? 0,
      exported: isExported(statement),
      default: false,
      declarationKind: "variable",
    });
    addExportForDeclaration(context, statement, name, "variable", id, symbolExportKind(statement, "value"));
  }
}

function collectVariables(context: AnalyzerContext, node: ts.Node, ownerId: string): void {
  const visit = (child: ts.Node): void => {
    if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name)) {
      const initializer = child.initializer;
      const model: TypeScriptVariable = withOptionalProperties({
        id: `tsvar:${stableHash(`${context.relativeFile}|${child.name.text}|${child.getStart(context.sourceFile)}`)}`,
        name: child.name.text,
        file: context.relativeFile,
        span: sourceSpan(context.sourceFile, child, context.relativeFile),
        ownerId,
      }, {
        typeName: child.type?.getText(context.sourceFile),
        initializerText: initializer?.getText(context.sourceFile),
        initializerCalleeName: initializer && (ts.isCallExpression(initializer) || ts.isNewExpression(initializer))
          ? expressionDisplayName(context.sourceFile, initializer.expression)
          : undefined,
        initializerKind: initializer ? ts.SyntaxKind[initializer.kind] : undefined,
      });

      context.variables.push(model);

      if (initializer && ts.isNewExpression(initializer)) {
        const className = unqualifiedName(expressionDisplayName(context.sourceFile, initializer.expression) ?? "");

        if (className) {
          context.variableTypes.set(child.name.text, className);
        }
      }
    }

    ts.forEachChild(child, visit);
  };

  visit(node);
}

function resolveImportedBindings(
  context: AnalyzerContext,
  contextsByFile: ReadonlyMap<string, AnalyzerContext>,
): void {
  for (const record of context.importRecords) {
    const targetContext = record.model.targetFile ? contextsByFile.get(record.model.targetFile) : undefined;
    const importClause = record.declaration.importClause;

    if (!importClause) {
      continue;
    }

    if (importClause.name) {
      context.importedIdentifiers.set(importClause.name.text, targetContext?.localSymbols.get("default") ?? record.model.targetId);
    }

    if (record.model.namespaceBinding) {
      context.importedIdentifiers.set(record.model.namespaceBinding, record.model.targetId);
    }

    const bindings = record.model.namedBindings.map((binding): TypeScriptImportBinding => {
      const targetId = targetContext?.localSymbols.get(binding.importedName) ?? record.model.targetId;
      context.importedIdentifiers.set(binding.localName, targetId);
      return { ...binding, targetId };
    });
    replaceImport(context, record.model.id, { ...record.model, namedBindings: bindings });
  }
}

function resolveExports(
  context: AnalyzerContext,
  contextsByFile: ReadonlyMap<string, AnalyzerContext>,
): void {
  for (const record of context.exportRecords) {
    const targetContext = record.model.specifier
      ? resolveExportTargetContext(context, contextsByFile, record.model.specifier)
      : context;
    const targetId = record.model.targetId ?? resolveExportTarget(record.model, targetContext) ?? record.model.id;
    replaceExport(context, record.model.id, { ...record.model, targetId });
  }
}

function resolveExportTargetContext(
  context: AnalyzerContext,
  contextsByFile: ReadonlyMap<string, AnalyzerContext>,
  specifier: string,
): AnalyzerContext | undefined {
  const resolved = resolveImport(context, new Set(contextsByFile.keys()), specifier);
  return resolved.targetFile ? contextsByFile.get(resolved.targetFile) : undefined;
}

function resolveExportTarget(
  model: TypeScriptExport,
  targetContext: AnalyzerContext | undefined,
): string | undefined {
  if (!targetContext) {
    return undefined;
  }

  if (model.exportKind === "star" || model.exportKind === "namespace") {
    return targetContext.moduleId;
  }

  return targetContext.localSymbols.get(model.localName ?? model.name);
}

function collectDeclarationSemantics(context: AnalyzerContext): void {
  for (const statement of context.sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name) {
      const classId = context.localSymbols.get(statement.name.text);

      if (classId) {
        addClassHeritage(context, statement, classId);
        addClassConstructor(context, statement, classId);
        addTypeReferences(context, classId, statement.typeParameters, "USES", "type-parameter");
      }

      continue;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      const interfaceId = context.localSymbols.get(statement.name.text);

      if (interfaceId) {
        addInterfaceHeritage(context, statement, interfaceId);
        addTypeReferences(context, interfaceId, statement.typeParameters, "USES", "type-parameter");
      }

      continue;
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      const typeAliasId = context.localSymbols.get(statement.name.text);

      if (typeAliasId) {
        addTypeReferences(context, typeAliasId, statement.type, "USES", "type-alias");
        addTypeReferences(context, typeAliasId, statement.typeParameters, "USES", "type-parameter");
      }
    }
  }
}

function collectCalls(context: AnalyzerContext): void {
  for (const statement of context.sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body && statement.name) {
      const ownerId = context.localSymbols.get(statement.name.text);
      if (ownerId) {
        collectFunctionLikeFacts(context, ownerId, statement, statement.body);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && isFunctionLikeInitializer(declaration.initializer)) {
          const ownerId = context.localSymbols.get(declaration.name.text);
          if (ownerId) {
            collectFunctionLikeFacts(context, ownerId, declaration.initializer, declaration.initializer.body);
          }
        }
      }
      continue;
    }

    if (ts.isClassDeclaration(statement) && statement.name) {
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member) || !member.body || !member.name) {
          continue;
        }

        const methodName = propertyNameToString(member.name);
        const ownerId = methodName ? context.methodsByQualifiedName.get(`${statement.name.text}.${methodName}`) : undefined;

        if (ownerId) {
          collectFunctionLikeFacts(context, ownerId, member, member.body);
        }
      }
    }
  }
}

function collectFunctionLikeFacts(
  context: AnalyzerContext,
  ownerId: string,
  declaration: ts.FunctionLikeDeclaration,
  body: ts.Node,
): void {
  addTypeReferences(context, ownerId, declaration.type, "RETURNS", "return-type");
  addTypeReferences(context, ownerId, declaration.typeParameters, "USES", "type-parameter");

  for (const parameter of declaration.parameters) {
    addTypeReferences(context, ownerId, parameter.type, "USES", "parameter-type");
  }

  collectExecutableFacts(context, ownerId, body, { includeCalls: true });
}

function collectModuleSemantics(context: AnalyzerContext): void {
  for (const statement of context.sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      continue;
    }

    collectExecutableFacts(context, context.moduleId, statement, { includeCalls: false });
  }
}

function collectExecutableFacts(
  context: AnalyzerContext,
  ownerId: string,
  root: ts.Node,
  _options: { readonly includeCalls: boolean },
): void {
  const scopedVariableTypes = new Map(context.variableTypes);
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      collectScopedVariableType(context, node, scopedVariableTypes);
    }

    if (ts.isNewExpression(node)) {
      const targetId = resolveExpressionTarget(context, node.expression);

      if (targetId && targetId !== ownerId) {
        context.creates.push({
          id: `tscreate:${stableHash(`${ownerId}|${targetId}|${node.getStart(context.sourceFile)}`)}`,
          ownerId,
          targetId,
          expression: node.expression.getText(context.sourceFile),
          file: context.relativeFile,
          span: sourceSpan(context.sourceFile, node, context.relativeFile),
        });
      }
    }

    if (ts.isCallExpression(node)) {
      const targetId = resolveCallTarget(context, node.expression, scopedVariableTypes);
      const call = callModel(context, ownerId, node, targetId);
      context.calls.push(call);
    }

    if (ts.isThrowStatement(node) && node.expression) {
      const exception = thrownException(context, node.expression);

      if (exception) {
        context.throws.push({
          id: `tsthrow:${stableHash(`${ownerId}|${exception.exceptionName}|${node.getStart(context.sourceFile)}`)}`,
          ownerId,
          exceptionName: exception.exceptionName,
          targetId: exception.targetId,
          expression: node.expression.getText(context.sourceFile),
          file: context.relativeFile,
          span: sourceSpan(context.sourceFile, node, context.relativeFile),
          expressionSpan: sourceSpan(context.sourceFile, node.expression, context.relativeFile),
        });
      }
    }

    const environmentVariable = environmentVariableName(context.sourceFile, node);

    if (environmentVariable) {
      context.environmentAccesses.push({
        id: `tsenv:${stableHash(`${ownerId}|${environmentVariable}|${node.getStart(context.sourceFile)}`)}`,
        ownerId,
        name: environmentVariable,
        access: assignmentWritesNode(node) ? "write" : "read",
        file: context.relativeFile,
        span: sourceSpan(context.sourceFile, node, context.relativeFile),
      });
    }

    if (node !== root && isFunctionLikeNode(node)) {
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(root);
}

function callModel(
  context: AnalyzerContext,
  ownerId: string,
  node: ts.CallExpression,
  targetId: string | undefined,
): TypeScriptCall {
  const calleeName = expressionDisplayName(context.sourceFile, node.expression);
  const property = ts.isPropertyAccessExpression(node.expression) ? node.expression : undefined;

  return withOptionalProperties({
    id: `tscall:${stableHash(`${context.relativeFile}|${ownerId}|${node.getStart(context.sourceFile)}|${node.expression.getText(context.sourceFile)}`)}`,
    file: context.relativeFile,
    ownerId,
    expression: node.expression.getText(context.sourceFile),
    arguments: node.arguments.filter(ts.isExpression).map((argument) => expressionModel(context.sourceFile, argument)),
    span: sourceSpan(context.sourceFile, node, context.relativeFile),
  }, {
    calleeName,
    receiverName: property ? rootIdentifierName(property.expression) : undefined,
    methodName: property?.name.text,
    targetId,
  });
}

function addClassHeritage(context: AnalyzerContext, declaration: ts.ClassDeclaration, classId: string): void {
  for (const clause of declaration.heritageClauses ?? []) {
    const relationship = clause.token === ts.SyntaxKind.ExtendsKeyword ? "EXTENDS" : "IMPLEMENTS";

    for (const type of clause.types) {
      const targetId = resolveExpressionTarget(context, type.expression);

      if (!targetId || targetId === classId) {
        continue;
      }

      context.heritage.push({
        id: `tsheritage:${stableHash(`${relationship}|${classId}|${targetId}`)}`,
        from: classId,
        to: targetId,
        relationship,
        name: type.expression.getText(context.sourceFile),
        file: context.relativeFile,
        span: sourceSpan(context.sourceFile, type, context.relativeFile),
      });
    }
  }
}

function addInterfaceHeritage(context: AnalyzerContext, declaration: ts.InterfaceDeclaration, interfaceId: string): void {
  for (const clause of declaration.heritageClauses ?? []) {
    for (const type of clause.types) {
      const targetId = resolveExpressionTarget(context, type.expression);

      if (!targetId || targetId === interfaceId) {
        continue;
      }

      context.heritage.push({
        id: `tsheritage:${stableHash(`EXTENDS|${interfaceId}|${targetId}`)}`,
        from: interfaceId,
        to: targetId,
        relationship: "EXTENDS",
        name: type.expression.getText(context.sourceFile),
        file: context.relativeFile,
        span: sourceSpan(context.sourceFile, type, context.relativeFile),
      });
    }
  }
}

function addClassConstructor(context: AnalyzerContext, declaration: ts.ClassDeclaration, classId: string): void {
  const className = declaration.name?.text;

  if (!className) {
    return;
  }

  for (const member of declaration.members) {
    if (!ts.isConstructorDeclaration(member)) {
      continue;
    }

    const parameters = member.parameters.map((parameter): TypeScriptConstructorParameter => {
      const typeName = parameter.type?.getText(context.sourceFile);
      const targetIds = parameter.type ? resolveTypeTargets(context, parameter.type) : [];
      const decorators = addDecorators(context, parameter, classId, "Parameter");

      return withOptionalProperties({
        name: parameter.name.getText(context.sourceFile),
        targetIds,
        decorators,
        span: sourceSpan(context.sourceFile, parameter, context.relativeFile),
      }, {
        typeName,
      });
    });

    context.constructors.push({
      id: `tsconstructor:${stableHash(`${context.relativeFile}|${classId}|${member.getStart(context.sourceFile)}`)}`,
      classId,
      className,
      file: context.relativeFile,
      span: sourceSpan(context.sourceFile, member, context.relativeFile),
      parameters,
    });
  }
}

function addTypeReferences(
  context: AnalyzerContext,
  ownerId: string,
  nodeOrNodes: ts.Node | ts.NodeArray<ts.Node> | undefined,
  relationship: Extract<RelationshipType, "RETURNS" | "USES">,
  usage: string,
): void {
  if (!nodeOrNodes) {
    return;
  }

  const nodes = Array.isArray(nodeOrNodes) ? nodeOrNodes : [nodeOrNodes];

  for (const node of nodes) {
    const visit = (child: ts.Node): void => {
      if (ts.isTypeReferenceNode(child)) {
        const targetId = resolveTypeTarget(context, child.typeName);

        if (targetId && targetId !== ownerId) {
          context.types.push({
            id: `tstype:${stableHash(`${relationship}|${ownerId}|${targetId}|${usage}|${child.getStart(context.sourceFile)}`)}`,
            from: ownerId,
            to: targetId,
            relationship,
            usage,
            name: child.typeName.getText(context.sourceFile),
            file: context.relativeFile,
            span: sourceSpan(context.sourceFile, child, context.relativeFile),
          });
        }
      }

      ts.forEachChild(child, visit);
    };

    visit(node);
  }
}

function resolveTypeTargets(context: AnalyzerContext, node: ts.Node): readonly string[] {
  const targets = new Set<string>();
  const visit = (child: ts.Node): void => {
    if (ts.isTypeReferenceNode(child)) {
      const targetId = resolveTypeTarget(context, child.typeName);

      if (targetId) {
        targets.add(targetId);
      }
    }

    ts.forEachChild(child, visit);
  };

  visit(node);
  return [...targets].sort();
}

function resolveCallTarget(
  context: AnalyzerContext,
  expression: ts.Expression,
  variableTypes: ReadonlyMap<string, string>,
): string | undefined {
  const callee = expressionDisplayName(context.sourceFile, expression);

  if (!callee) {
    return undefined;
  }

  const local = context.localSymbols.get(callee) ?? context.importedIdentifiers.get(callee);

  if (local) {
    return local;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const receiverName = expressionDisplayName(context.sourceFile, expression.expression);
    const methodName = expression.name.text;
    const receiverType = receiverName ? variableTypes.get(receiverName) : undefined;

    if (receiverName) {
      const importedReceiver = context.importedIdentifiers.get(receiverName) ??
        context.importedIdentifiers.get(unqualifiedName(receiverName)) ??
        context.importedIdentifiers.get(rootIdentifierName(expression.expression) ?? "");

      if (importedReceiver?.startsWith("pkg:")) {
        return importedReceiver;
      }
    }

    if (receiverType) {
      return context.projectMethodsByQualifiedName.get(`${receiverType}.${methodName}`);
    }
  }

  return context.methodsByQualifiedName.get(callee) ?? context.projectMethodsByQualifiedName.get(callee);
}

function resolveExpressionTarget(context: AnalyzerContext, expression: ts.Expression): string | undefined {
  const name = expressionDisplayName(context.sourceFile, expression);

  if (!name) {
    return undefined;
  }

  return (
    context.localSymbols.get(name) ??
    context.importedIdentifiers.get(name) ??
    context.localSymbols.get(unqualifiedName(name)) ??
    context.importedIdentifiers.get(unqualifiedName(name))
  );
}

function resolveTypeTarget(context: AnalyzerContext, typeName: ts.EntityName): string | undefined {
  const name = typeName.getText(context.sourceFile);

  return (
    context.localSymbols.get(name) ??
    context.importedIdentifiers.get(name) ??
    context.localSymbols.get(unqualifiedName(name)) ??
    context.importedIdentifiers.get(unqualifiedName(name))
  );
}

function collectScopedVariableType(
  context: AnalyzerContext,
  declaration: ts.VariableDeclaration,
  target: Map<string, string>,
): void {
  if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isNewExpression(declaration.initializer)) {
    return;
  }

  const className = unqualifiedName(expressionDisplayName(context.sourceFile, declaration.initializer.expression) ?? "");

  if (className) {
    target.set(declaration.name.text, className);
  }
}

function thrownException(
  context: AnalyzerContext,
  expression: ts.Expression,
): { readonly exceptionName: string; readonly targetId?: string | undefined } | undefined {
  if (!ts.isNewExpression(expression)) {
    return undefined;
  }

  const targetId = resolveExpressionTarget(context, expression.expression);
  const exceptionName = unqualifiedName(expressionDisplayName(context.sourceFile, expression.expression) ?? "");

  if (!exceptionName) {
    return undefined;
  }

  return withOptionalProperties({ exceptionName }, { targetId });
}

function environmentVariableName(sourceFile: ts.SourceFile, node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node) && isProcessEnvExpression(node.expression)) {
    return node.name.text;
  }

  if (ts.isElementAccessExpression(node) && isProcessEnvExpression(node.expression)) {
    const argument = node.argumentExpression;
    return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
  }

  if (ts.isPropertyAccessExpression(node) && isImportMetaEnvExpression(node.expression)) {
    return node.name.text;
  }

  return undefined;
}

function isProcessEnvExpression(expression: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "env" &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "process"
  );
}

function isImportMetaEnvExpression(expression: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "env" &&
    ts.isMetaProperty(expression.expression) &&
    expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
  );
}

function assignmentWritesNode(node: ts.Node): boolean {
  const parent = node.parent;
  return Boolean(parent && ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind));
}

function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function importDetails(declaration: ts.ImportDeclaration): Pick<TypeScriptImport, "defaultBinding" | "importKind" | "namedBindings" | "namespaceBinding" | "sideEffectOnly" | "specifier"> {
  const importClause = declaration.importClause;
  const namedBindings = importClause?.namedBindings;
  const specifier = moduleSpecifierText(declaration.moduleSpecifier) ?? declaration.moduleSpecifier.getText();
  const namedBindingsList = namedBindings && ts.isNamedImports(namedBindings)
    ? namedBindings.elements
        .map((element): TypeScriptImportBinding => ({
          localName: element.name.text,
          importedName: element.propertyName?.text ?? element.name.text,
          typeOnly: element.isTypeOnly,
        }))
        .sort(compareImportBindings)
    : [];

  return withOptionalProperties({
    specifier,
    importKind: importClause?.isTypeOnly ? "type" as const : "value" as const,
    namedBindings: namedBindingsList,
    sideEffectOnly: !importClause,
  }, {
    defaultBinding: importClause?.name?.text,
    namespaceBinding: namedBindings && ts.isNamespaceImport(namedBindings) ? namedBindings.name.text : undefined,
  });
}

function importKey(details: Pick<TypeScriptImport, "defaultBinding" | "importKind" | "namedBindings" | "namespaceBinding" | "sideEffectOnly" | "specifier">): string {
  return [
    details.specifier,
    details.importKind,
    details.defaultBinding ?? "",
    details.namespaceBinding ?? "",
    details.namedBindings.map(importBindingText).join(","),
    String(details.sideEffectOnly),
  ].join("|");
}

function importBindingText(binding: TypeScriptImportBinding): string {
  const base = binding.importedName === binding.localName
    ? binding.localName
    : `${binding.importedName} as ${binding.localName}`;

  return binding.typeOnly ? `type ${base}` : base;
}

function resolveImport(
  context: AnalyzerContext,
  relativeFiles: ReadonlySet<string>,
  specifier: string,
): Pick<TypeScriptImport, "targetFile" | "targetId" | "targetKind" | "targetName" | "unresolved"> {
  const resolvedModule = ts.resolveModuleName(
    specifier,
    context.absoluteFile,
    context.compilerOptions,
    ts.sys,
  ).resolvedModule;
  const resolvedFile = resolvedModule && !resolvedModule.isExternalLibraryImport
    ? toRelativePath(context.root, resolvedModule.resolvedFileName)
    : undefined;

  if (resolvedFile && relativeFiles.has(resolvedFile)) {
    return {
      targetId: createNodeId({ type: "Module", name: resolvedFile }),
      targetKind: "Module",
      targetName: resolvedFile,
      targetFile: resolvedFile,
    };
  }

  if (!specifier.startsWith(".")) {
    const packageName = packageNameFromSpecifier(specifier);
    return {
      targetId: createNodeId({ type: "Package", name: packageName }),
      targetKind: "Package",
      targetName: packageName,
    };
  }

  const base = normalizePath(relative(context.root, resolve(dirname(context.absoluteFile), specifier)));
  const candidates = [
    base,
    ...TYPESCRIPT_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...TYPESCRIPT_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ].map(normalizePath);
  const targetFile = candidates.find((candidate) => relativeFiles.has(candidate));

  if (targetFile) {
    return {
      targetId: createNodeId({ type: "Module", name: targetFile }),
      targetKind: "Module",
      targetName: targetFile,
      targetFile,
    };
  }

  return {
    targetId: createNodeId({ type: "Module", name: base }),
    targetKind: "Module",
    targetName: base,
    targetFile: base,
    unresolved: true,
  };
}

function functionMetadata(node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction): JsonObject {
  return {
    async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
    generator: ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ? Boolean(node.asteriskToken) : false,
    exported: isExported(node),
    default: isDefaultExport(node),
    parameters: node.parameters.length,
    typeParameters: node.typeParameters?.length ?? 0,
    declarationKind: ts.isArrowFunction(node) ? "arrow" : "function",
  };
}

function classMetadata(node: ts.ClassDeclaration): JsonObject {
  return {
    abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
    exported: isExported(node),
    default: isDefaultExport(node),
    typeParameters: node.typeParameters?.length ?? 0,
    declarationKind: "class",
  };
}

function methodMetadata(node: ts.MethodDeclaration): JsonObject {
  return {
    async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
    static: hasModifier(node, ts.SyntaxKind.StaticKeyword),
    abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
    parameters: node.parameters.length,
    typeParameters: node.typeParameters?.length ?? 0,
    declarationKind: "method",
  };
}

function interfaceMetadata(node: ts.InterfaceDeclaration): JsonObject {
  return {
    exported: isExported(node),
    default: false,
    typeParameters: node.typeParameters?.length ?? 0,
    declarationKind: "interface",
  };
}

function typeAliasMetadata(node: ts.TypeAliasDeclaration): JsonObject {
  return {
    exported: isExported(node),
    default: false,
    typeParameters: node.typeParameters?.length ?? 0,
    declarationKind: "type-alias",
    union: ts.isUnionTypeNode(node.type),
    intersection: ts.isIntersectionTypeNode(node.type),
    mapped: ts.isMappedTypeNode(node.type),
    conditional: ts.isConditionalTypeNode(node.type),
  };
}

function enumMetadata(node: ts.EnumDeclaration): JsonObject {
  return {
    exported: isExported(node),
    default: false,
    const: hasModifier(node, ts.SyntaxKind.ConstKeyword),
    members: node.members.length,
    declarationKind: "enum",
  };
}

function decoratorArguments(decorator: ts.Decorator, sourceFile: ts.SourceFile): readonly TypeScriptExpression[] {
  return ts.isCallExpression(decorator.expression)
    ? decorator.expression.arguments.filter(ts.isExpression).map((argument) => expressionModel(sourceFile, argument))
    : [];
}

function expressionModel(sourceFile: ts.SourceFile, expression: ts.Expression): TypeScriptExpression {
  return withOptionalProperties({
    text: expression.getText(sourceFile),
    kind: ts.SyntaxKind[expression.kind] ?? "Unknown",
  }, {
    name: expressionDisplayName(sourceFile, expression),
    literal: literalValue(sourceFile, expression),
  });
}

function literalValue(sourceFile: ts.SourceFile, expression: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) || ts.isNumericLiteral(expression)) {
    return expression.text;
  }

  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isObjectLiteralExpression(expression) || ts.isArrayLiteralExpression(expression)) {
    return expression.getText(sourceFile);
  }

  return undefined;
}

function expressionDisplayName(sourceFile: ts.SourceFile, expression: ts.Node): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const left = expressionDisplayName(sourceFile, expression.expression);
    return left ? `${left}.${expression.name.text}` : expression.name.text;
  }

  if (ts.isCallExpression(expression)) {
    return expressionDisplayName(sourceFile, expression.expression);
  }

  if (ts.isNewExpression(expression)) {
    return expressionDisplayName(sourceFile, expression.expression);
  }

  return undefined;
}

function rootIdentifierName(expression: ts.Node): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return rootIdentifierName(expression.expression);
  }

  if (ts.isCallExpression(expression)) {
    return rootIdentifierName(expression.expression);
  }

  return undefined;
}

function collectSyntacticDiagnostics(root: string, sourceDiagnostics: readonly ts.Diagnostic[], diagnostics: SoftwareGraphDiagnostic[]): void {
  for (const item of sourceDiagnostics) {
    diagnostics.push(diagnostic({
      code: `TYPESCRIPT_${item.code}`,
      severity: diagnosticSeverity(item.category),
      message: ts.flattenDiagnosticMessageText(item.messageText, "\n"),
      span: diagnosticSpan(root, item),
    metadata: {
      parser: TYPESCRIPT_ANALYZER_NAME,
      analyzer: TYPESCRIPT_ANALYZER_NAME,
      category: ts.DiagnosticCategory[item.category] ?? "Unknown",
    },
    }));
  }
}

function diagnostic(input: {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}): SoftwareGraphDiagnostic {
  return {
    id: createDiagnosticId(input.code, input.message, input.span?.file ?? ""),
    code: input.code,
    severity: input.severity,
    message: input.message,
    span: input.span,
    metadata: input.metadata,
  };
}

function diagnosticSpan(root: string, item: ts.Diagnostic): SourceSpan | undefined {
  if (!item.file || item.start === undefined) {
    return undefined;
  }

  const start = item.file.getLineAndCharacterOfPosition(item.start);
  const end = item.file.getLineAndCharacterOfPosition(item.start + (item.length ?? 0));

  return {
    file: toRelativePath(root, item.file.fileName),
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

function sourceSpan(sourceFile: ts.SourceFile, node: ts.Node, relativeFile: string): SourceSpan {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  return {
    file: relativeFile,
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

function replaceImport(context: AnalyzerContext, id: string, replacement: TypeScriptImport): void {
  const index = context.imports.findIndex((item) => item.id === id);

  if (index >= 0) {
    context.imports[index] = replacement;
  }
}

function replaceExport(context: AnalyzerContext, id: string, replacement: TypeScriptExport): void {
  const index = context.exports.findIndex((item) => item.id === id);

  if (index >= 0) {
    context.exports[index] = replacement;
  }
}

function normalizeProject(project: TypeScriptProject): TypeScriptProject {
  return {
    ...project,
    files: [...project.files].sort(compareSourceFiles),
    sourceFiles: [...project.sourceFiles].sort(compareSourceFiles),
    symbols: [...project.symbols].sort(compareSymbols),
    classes: [...project.classes].sort(compareById),
    interfaces: [...project.interfaces].sort(compareById),
    functions: [...project.functions].sort(compareById),
    methods: [...project.methods].sort(compareById),
    variables: [...project.variables].sort(compareById),
    enums: [...project.enums].sort(compareById),
    namespaces: [...project.namespaces].sort(compareById),
    imports: [...project.imports].sort(compareById),
    exports: [...project.exports].sort(compareById),
    calls: [...project.calls].sort(compareById),
    decorators: [...project.decorators].sort(compareById),
    types: [...project.types].sort(compareById),
    heritage: [...project.heritage].sort(compareById),
    constructors: [...project.constructors].sort(compareById),
    creates: [...project.creates].sort(compareById),
    throws: [...project.throws].sort(compareById),
    environmentAccesses: [...project.environmentAccesses].sort(compareById),
    diagnostics: [...project.diagnostics].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function addSymbol(context: AnalyzerContext, symbol: TypeScriptSymbol): void {
  if (!context.symbols.has(symbol.id)) {
    context.symbols.set(symbol.id, symbol);
  }
}

function listTypeScriptFiles(root: string): readonly string[] {
  const ignored = new Set([
    ".artifacts",
    ".cache",
    ".expo",
    ".git",
    ".next",
    ".nuxt",
    ".ontoly",
    ".svelte-kit",
    ".turbo",
    ".vite",
    "artifacts",
    "build",
    "coverage",
    "dist",
    "downloads",
    "node_modules",
    "ontoly-output",
    "out",
    "outputs",
    "playwright-report",
    "temp",
    "test-results",
    "tmp",
    "work",
  ]);
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (ignored.has(entry.name)) {
        continue;
      }

      const absolute = join(directory, entry.name);

      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile() && isTypeScriptSourcePath(absolute)) {
        files.push(toRelativePath(root, absolute));
      }
    }
  };

  if (statSync(root).isDirectory()) {
    visit(root);
  }

  return files.sort();
}

function loadProjectCompilerOptions(root: string, overrides?: ts.CompilerOptions | undefined): ts.CompilerOptions {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  const options = configPath ? readCompilerOptionsFromConfig(configPath) : {};

  return {
    ...options,
    ...(overrides ?? {}),
  };
}

function readCompilerOptionsFromConfig(configPath: string): ts.CompilerOptions {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);

  if (config.error || !config.config) {
    return {};
  }

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  return parsed.options;
}

function declarationName(name: ts.Identifier | undefined, node: ts.Node): string | undefined {
  if (name) {
    return name.text;
  }

  return isDefaultExport(node) ? "default" : undefined;
}

function symbolExportKind(
  node: ts.Node,
  normalKind: Extract<TypeScriptExport["exportKind"], "type" | "value">,
): TypeScriptExport["exportKind"] | undefined {
  if (isDefaultExport(node)) {
    return "default";
  }

  return isExported(node) ? normalKind : undefined;
}

function moduleSpecifierText(node: ts.Expression | undefined): string | undefined {
  return node && ts.isStringLiteral(node) ? node.text : undefined;
}

function isTypeScriptSourcePath(path: string): boolean {
  const normalized = normalizePath(path);

  if (normalized.endsWith(".d.ts") || normalized.endsWith(".d.mts") || normalized.endsWith(".d.cts")) {
    return false;
  }

  return TYPESCRIPT_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind));
}

function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function isDefaultExport(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.DefaultKeyword);
}

function isFunctionLikeInitializer(node: ts.Expression): node is ts.ArrowFunction | ts.FunctionExpression {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function isFunctionLikeNode(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function propertyNameToString(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
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

function diagnosticSeverity(category: ts.DiagnosticCategory): DiagnosticSeverity {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return "error";
    case ts.DiagnosticCategory.Warning:
      return "warning";
    default:
      return "info";
  }
}

function toRelativePath(root: string, file: string): string {
  return normalizePath(relative(resolve(root), isAbsolute(file) ? file : resolve(root, file)));
}

function dedupeDiagnostics(diagnostics: readonly SoftwareGraphDiagnostic[]): readonly SoftwareGraphDiagnostic[] {
  return [...new Map(diagnostics.map((item) => [item.id, item] as const)).values()];
}

function compareSourceFiles(left: TypeScriptSourceFile, right: TypeScriptSourceFile): number {
  return left.id.localeCompare(right.id);
}

function compareSymbols(left: TypeScriptSymbol, right: TypeScriptSymbol): number {
  return left.id.localeCompare(right.id);
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return left.id.localeCompare(right.id);
}

function compareImportBindings(left: TypeScriptImportBinding, right: TypeScriptImportBinding): number {
  return importBindingText(left).localeCompare(importBindingText(right));
}

function withOptionalProperties<T extends object, O extends object>(target: T, optional: O): T & O {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as T & O;
}
