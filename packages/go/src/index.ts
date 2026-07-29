import { readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import Parser from "tree-sitter";
import Go from "tree-sitter-go";
import {
  createNodeId,
  normalizePath,
  stableHash,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";

export const GO_SEMANTIC_MODEL_VERSION = "1.0.0";
export const GO_ANALYZER_NAME = "go";
export const GO_ANALYZER_VERSION = "0.1.0";

export interface AnalyzeGoProjectInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly sourceProvider?: ((path: string) => string | undefined) | undefined;
}

export interface GoProject {
  readonly version: string;
  readonly root: string;
  readonly files: readonly GoSourceFile[];
  readonly packages: readonly GoPackageDecl[];
  readonly structs: readonly GoStruct[];
  readonly interfaces: readonly GoInterface[];
  readonly functions: readonly GoFunction[];
  readonly methods: readonly GoMethod[];
  readonly imports: readonly GoImport[];
  readonly typeAliases: readonly GoTypeAlias[];
  readonly constants: readonly GoConstant[];
  readonly variables: readonly GoVariable[];
  readonly calls: readonly GoCall[];
  readonly diagnostics: readonly GoDiagnostic[];
  readonly metadata: GoSemanticModelMetadata;
}

export interface GoSemanticModelMetadata {
  readonly fileCount: number;
  readonly parseErrors: number;
}

export interface GoSourceFile {
  readonly id: string;
  readonly file: string;
  readonly absoluteFile: string;
  readonly packageName: string;
  readonly span: SourceSpan;
}

export interface GoPackageDecl {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
}

export interface GoStruct {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly fields: readonly GoField[];
  readonly embeds: readonly string[];
  readonly exported: boolean;
  readonly typeParameters: readonly string[];
}

export interface GoField {
  readonly name: string;
  readonly type: string;
  readonly tag?: string | undefined;
  readonly embedded: boolean;
  readonly exported: boolean;
}

export interface GoInterface {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly methods: readonly GoInterfaceMethod[];
  readonly embeds: readonly string[];
  readonly exported: boolean;
  readonly typeParameters: readonly string[];
}

export interface GoInterfaceMethod {
  readonly name: string;
  readonly parameters: readonly GoParameter[];
  readonly results: readonly GoParameter[];
}

export interface GoFunction {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly parameters: readonly GoParameter[];
  readonly results: readonly GoParameter[];
  readonly exported: boolean;
  readonly typeParameters: readonly string[];
}

export interface GoMethod {
  readonly id: string;
  readonly name: string;
  readonly receiverType: string;
  readonly receiverName: string;
  readonly pointerReceiver: boolean;
  readonly file: string;
  readonly span: SourceSpan;
  readonly parameters: readonly GoParameter[];
  readonly results: readonly GoParameter[];
  readonly exported: boolean;
}

export interface GoParameter {
  readonly name: string;
  readonly type: string;
  readonly variadic: boolean;
}

export interface GoImport {
  readonly id: string;
  readonly file: string;
  readonly path: string;
  readonly alias?: string | undefined;
  readonly sideEffect: boolean;
  readonly dot: boolean;
  readonly span: SourceSpan;
}

export interface GoTypeAlias {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly underlyingType: string;
  readonly isAlias: boolean;
  readonly exported: boolean;
}

export interface GoConstant {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly type?: string | undefined;
  readonly value?: string | undefined;
  readonly exported: boolean;
}

export interface GoVariable {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly type?: string | undefined;
  readonly exported: boolean;
}

export interface GoCall {
  readonly id: string;
  readonly file: string;
  readonly ownerId: string;
  readonly expression: string;
  readonly calleeName?: string | undefined;
  readonly receiverName?: string | undefined;
  readonly methodName?: string | undefined;
  readonly argumentCount: number;
  readonly span: SourceSpan;
}

export interface GoDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly file: string;
  readonly span?: SourceSpan | undefined;
}

type SyntaxNode = Parser.SyntaxNode;

interface FileContext {
  readonly root: string;
  readonly file: string;
  readonly absoluteFile: string;
  readonly moduleId: string;
  readonly packageName: string;
  readonly sourceFiles: GoSourceFile[];
  readonly packages: GoPackageDecl[];
  readonly structs: GoStruct[];
  readonly interfaces: GoInterface[];
  readonly functions: GoFunction[];
  readonly methods: GoMethod[];
  readonly imports: GoImport[];
  readonly typeAliases: GoTypeAlias[];
  readonly constants: GoConstant[];
  readonly variables: GoVariable[];
  readonly calls: GoCall[];
  readonly diagnostics: GoDiagnostic[];
}

let sharedParser: Parser | undefined;

function getParser(): Parser {
  if (!sharedParser) {
    sharedParser = new Parser();
    sharedParser.setLanguage(Go);
  }
  return sharedParser;
}

export function analyzeGoProject(input: AnalyzeGoProjectInput): GoProject {
  const parser = getParser();
  const sourceFiles: GoSourceFile[] = [];
  const packages: GoPackageDecl[] = [];
  const structs: GoStruct[] = [];
  const interfaces: GoInterface[] = [];
  const functions: GoFunction[] = [];
  const methods: GoMethod[] = [];
  const imports: GoImport[] = [];
  const typeAliases: GoTypeAlias[] = [];
  const constants: GoConstant[] = [];
  const variables: GoVariable[] = [];
  const calls: GoCall[] = [];
  const diagnostics: GoDiagnostic[] = [];
  let parseErrors = 0;

  for (const filePath of input.files) {
    const absoluteFile = isAbsolute(filePath) ? filePath : join(input.root, filePath);
    const file = normalizePath(relative(input.root, absoluteFile));

    let source: string | undefined;
    if (input.sourceProvider) {
      source = input.sourceProvider(absoluteFile) ?? input.sourceProvider(filePath);
    }
    if (source === undefined) {
      try {
        source = readFileSync(absoluteFile, "utf-8");
      } catch {
        diagnostics.push({
          code: "go-read-error",
          message: `Failed to read file: ${file}`,
          file,
        });
        continue;
      }
    }

    const tree = parser.parse(source);
    if (tree.rootNode.hasError) {
      parseErrors++;
    }

    const lines = source.split("\n");
    const totalLines = lines.length;
    const lastLineLength = lines[totalLines - 1]?.length ?? 0;

    const packageName = extractPackageName(tree.rootNode);
    const moduleId = createNodeId({ type: "Script", name: file, file });

    const sourceFile: GoSourceFile = {
      id: moduleId,
      file,
      absoluteFile,
      packageName,
      span: { file, startLine: 1, startColumn: 0, endLine: totalLines, endColumn: lastLineLength },
    };
    sourceFiles.push(sourceFile);

    const ctx: FileContext = {
      root: input.root,
      file,
      absoluteFile,
      moduleId,
      packageName,
      sourceFiles,
      packages,
      structs,
      interfaces,
      functions,
      methods,
      imports,
      typeAliases,
      constants,
      variables,
      calls,
      diagnostics,
    };

    walkSourceFile(ctx, tree.rootNode);
  }

  return {
    version: GO_SEMANTIC_MODEL_VERSION,
    root: input.root,
    files: sourceFiles,
    packages,
    structs,
    interfaces,
    functions,
    methods,
    imports,
    typeAliases,
    constants,
    variables,
    calls,
    diagnostics,
    metadata: { fileCount: sourceFiles.length, parseErrors },
  };
}

function nodeSpan(file: string, node: SyntaxNode): SourceSpan {
  return {
    file,
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column,
  };
}

function isExported(name: string): boolean {
  const ch = name[0];
  return name.length > 0 && ch !== undefined && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

function extractPackageName(root: SyntaxNode): string {
  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i)!;
    if (child.type === "package_clause") {
      const pkgId = child.namedChildren.find(c => c.type === "package_identifier");
      return pkgId?.text ?? "";
    }
  }
  return "";
}

function walkSourceFile(ctx: FileContext, root: SyntaxNode): void {
  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i)!;
    switch (child.type) {
      case "package_clause":
        processPackageClause(ctx, child);
        break;
      case "import_declaration":
        processImportDeclaration(ctx, child);
        break;
      case "function_declaration":
        processFunctionDeclaration(ctx, child);
        break;
      case "method_declaration":
        processMethodDeclaration(ctx, child);
        break;
      case "type_declaration":
        processTypeDeclaration(ctx, child);
        break;
      case "const_declaration":
        processConstDeclaration(ctx, child);
        break;
      case "var_declaration":
        processVarDeclaration(ctx, child);
        break;
    }
  }
}

function processPackageClause(ctx: FileContext, node: SyntaxNode): void {
  const pkgId = node.namedChildren.find(c => c.type === "package_identifier");
  if (!pkgId) return;

  const id = createNodeId({ type: "Script", name: `package:${pkgId.text}`, file: ctx.file });
  ctx.packages.push({
    id,
    name: pkgId.text,
    file: ctx.file,
    span: nodeSpan(ctx.file, node),
  });
}

function processImportDeclaration(ctx: FileContext, node: SyntaxNode): void {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "import_spec") {
      processImportSpec(ctx, child);
    } else if (child.type === "import_spec_list") {
      for (let j = 0; j < child.namedChildCount; j++) {
        const spec = child.namedChild(j)!;
        if (spec.type === "import_spec") {
          processImportSpec(ctx, spec);
        }
      }
    }
  }
}

function processImportSpec(ctx: FileContext, node: SyntaxNode): void {
  const pathNode = node.namedChildren.find(c => c.type === "interpreted_string_literal");
  if (!pathNode) return;

  const importPath = pathNode.text.slice(1, -1);
  let alias: string | undefined;
  let sideEffect = false;
  let dot = false;

  const nameNode = node.namedChildren.find(c =>
    c.type === "package_identifier" || c.type === "blank_identifier" || c.type === "dot",
  );
  if (nameNode) {
    if (nameNode.type === "blank_identifier") {
      sideEffect = true;
      alias = "_";
    } else if (nameNode.type === "dot") {
      dot = true;
      alias = ".";
    } else {
      alias = nameNode.text;
    }
  }

  const id = createNodeId({ type: "Import", name: `${ctx.file}:${importPath}`, file: ctx.file });
  ctx.imports.push({
    id,
    file: ctx.file,
    path: importPath,
    alias,
    sideEffect,
    dot,
    span: nodeSpan(ctx.file, node),
  });
}

function processFunctionDeclaration(ctx: FileContext, node: SyntaxNode): void {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) return;

  const funcName = nameNode.text;
  const funcId = createNodeId({ type: "Function", name: funcName, file: ctx.file });

  const parameters = extractParameterList(node.childForFieldName("parameters"));
  const results = extractResultList(node.childForFieldName("result"));
  const typeParameters = extractTypeParameters(node.childForFieldName("type_parameters"));

  ctx.functions.push({
    id: funcId,
    name: funcName,
    file: ctx.file,
    span: nodeSpan(ctx.file, node),
    parameters,
    results,
    exported: isExported(funcName),
    typeParameters,
  });

  const body = node.childForFieldName("body");
  if (body) {
    walkForCalls(ctx, body, funcId);
  }
}

function processMethodDeclaration(ctx: FileContext, node: SyntaxNode): void {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) return;

  const methodName = nameNode.text;
  const receiverNode = node.childForFieldName("receiver");
  const { typeName, paramName, isPointer } = extractReceiver(receiverNode);

  const fullName = `${typeName}.${methodName}`;
  const methodId = createNodeId({ type: "Method", name: fullName, file: ctx.file });

  const parameters = extractParameterList(node.childForFieldName("parameters"));
  const results = extractResultList(node.childForFieldName("result"));

  ctx.methods.push({
    id: methodId,
    name: fullName,
    receiverType: typeName,
    receiverName: paramName,
    pointerReceiver: isPointer,
    file: ctx.file,
    span: nodeSpan(ctx.file, node),
    parameters,
    results,
    exported: isExported(methodName),
  });

  const body = node.childForFieldName("body");
  if (body) {
    walkForCalls(ctx, body, methodId);
  }
}

function extractReceiver(receiverNode: SyntaxNode | null): {
  typeName: string;
  paramName: string;
  isPointer: boolean;
} {
  if (!receiverNode) return { typeName: "", paramName: "", isPointer: false };

  let typeName = "";
  let paramName = "";
  let isPointer = false;

  for (let i = 0; i < receiverNode.namedChildCount; i++) {
    const child = receiverNode.namedChild(i)!;
    if (child.type === "parameter_declaration") {
      const nameChild = child.namedChildren.find(c => c.type === "identifier");
      const typeChild = child.namedChildren.find(c =>
        c.type === "type_identifier" || c.type === "pointer_type" || c.type === "generic_type",
      );

      if (nameChild) paramName = nameChild.text;

      if (typeChild) {
        if (typeChild.type === "pointer_type") {
          isPointer = true;
          const inner = typeChild.namedChildren.find(c =>
            c.type === "type_identifier" || c.type === "generic_type",
          );
          typeName = inner?.type === "generic_type"
            ? (inner.childForFieldName("type")?.text ?? inner.text)
            : (inner?.text ?? "");
        } else if (typeChild.type === "generic_type") {
          typeName = typeChild.childForFieldName("type")?.text ?? typeChild.text;
        } else {
          typeName = typeChild.text;
        }
      }
    }
  }

  return { typeName, paramName, isPointer };
}

function processTypeDeclaration(ctx: FileContext, node: SyntaxNode): void {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "type_spec") {
      processTypeSpec(ctx, child);
    } else if (child.type === "type_alias") {
      processTypeAliasNode(ctx, child);
    }
  }
}

function processTypeSpec(ctx: FileContext, node: SyntaxNode): void {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) return;

  const typeName = nameNode.text;
  const typeNode = node.childForFieldName("type");
  const typeParameters = extractTypeParameters(node.childForFieldName("type_parameters"));

  if (typeNode?.type === "struct_type") {
    processStructType(ctx, node, typeName, typeNode, typeParameters);
  } else if (typeNode?.type === "interface_type") {
    processInterfaceType(ctx, node, typeName, typeNode, typeParameters);
  } else if (typeNode) {
    const id = createNodeId({ type: "Class", name: typeName, file: ctx.file });
    ctx.typeAliases.push({
      id,
      name: typeName,
      file: ctx.file,
      span: nodeSpan(ctx.file, node),
      underlyingType: typeNode.text,
      isAlias: false,
      exported: isExported(typeName),
    });
  }
}

function processTypeAliasNode(ctx: FileContext, node: SyntaxNode): void {
  const nameNode = node.childForFieldName("name");
  const typeNode = node.childForFieldName("type");
  if (!nameNode || !typeNode) return;

  const typeName = nameNode.text;
  const id = createNodeId({ type: "Class", name: typeName, file: ctx.file });
  ctx.typeAliases.push({
    id,
    name: typeName,
    file: ctx.file,
    span: nodeSpan(ctx.file, node),
    underlyingType: typeNode.text,
    isAlias: true,
    exported: isExported(typeName),
  });
}

function processStructType(
  ctx: FileContext,
  specNode: SyntaxNode,
  name: string,
  structNode: SyntaxNode,
  typeParameters: readonly string[],
): void {
  const structId = createNodeId({ type: "Class", name, file: ctx.file });
  const fields: GoField[] = [];
  const embeds: string[] = [];

  const fieldList = structNode.namedChildren.find(c => c.type === "field_declaration_list");
  if (fieldList) {
    for (let i = 0; i < fieldList.namedChildCount; i++) {
      const field = fieldList.namedChild(i)!;
      if (field.type !== "field_declaration") continue;

      const nameNodes = field.namedChildren.filter(c => c.type === "field_identifier");
      const typeChild = field.namedChildren.find(c =>
        c.type !== "field_identifier" && c.type !== "raw_string_literal",
      );
      const tagChild = field.namedChildren.find(c => c.type === "raw_string_literal");
      const tag = tagChild ? tagChild.text.slice(1, -1) : undefined;

      if (nameNodes.length > 0) {
        const fieldType = typeChild?.text ?? "";
        for (const n of nameNodes) {
          fields.push({
            name: n.text,
            type: fieldType,
            tag,
            embedded: false,
            exported: isExported(n.text),
          });
        }
      } else if (typeChild) {
        const embedName = extractEmbedName(typeChild);
        embeds.push(embedName);
        fields.push({
          name: embedName,
          type: typeChild.text,
          tag,
          embedded: true,
          exported: isExported(embedName),
        });
      }
    }
  }

  ctx.structs.push({
    id: structId,
    name,
    file: ctx.file,
    span: nodeSpan(ctx.file, specNode),
    fields,
    embeds,
    exported: isExported(name),
    typeParameters,
  });
}

function extractEmbedName(typeNode: SyntaxNode): string {
  if (typeNode.type === "pointer_type") {
    const inner = typeNode.namedChild(0);
    return inner ? extractEmbedName(inner) : typeNode.text;
  }
  if (typeNode.type === "qualified_type") {
    const sel = typeNode.namedChildren.find(c => c.type === "type_identifier");
    return sel?.text ?? typeNode.text;
  }
  if (typeNode.type === "generic_type") {
    const base = typeNode.childForFieldName("type");
    return base?.text ?? typeNode.text;
  }
  return typeNode.text;
}

function processInterfaceType(
  ctx: FileContext,
  specNode: SyntaxNode,
  name: string,
  ifaceNode: SyntaxNode,
  typeParameters: readonly string[],
): void {
  const ifaceId = createNodeId({ type: "Class", name, file: ctx.file });
  const methods: GoInterfaceMethod[] = [];
  const embeds: string[] = [];

  for (let i = 0; i < ifaceNode.namedChildCount; i++) {
    const child = ifaceNode.namedChild(i)!;
    if (child.type === "method_elem") {
      const methodName = child.childForFieldName("name")?.text ?? "";
      const params = extractParameterList(child.childForFieldName("parameters"));
      const results = extractResultList(child.childForFieldName("result"));
      methods.push({ name: methodName, parameters: params, results });
    } else if (child.type === "type_elem" || child.type === "type_identifier" || child.type === "qualified_type") {
      embeds.push(child.text);
    } else if (child.type === "struct_elem") {
      // struct constraint in generics
    }
  }

  ctx.interfaces.push({
    id: ifaceId,
    name,
    file: ctx.file,
    span: nodeSpan(ctx.file, specNode),
    methods,
    embeds,
    exported: isExported(name),
    typeParameters,
  });
}

function processConstDeclaration(ctx: FileContext, node: SyntaxNode): void {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "const_spec") {
      const names = child.namedChildren.filter(c => c.type === "identifier");
      const typeNode = child.namedChildren.find(c => c.type === "type_identifier" || c.type === "qualified_type");
      const exprList = child.namedChildren.find(c => c.type === "expression_list");

      for (let j = 0; j < names.length; j++) {
        const name = names[j]!.text;
        const value = exprList?.namedChild(j)?.text;
        const id = createNodeId({ type: "Configuration", name, file: ctx.file });
        ctx.constants.push({
          id,
          name,
          file: ctx.file,
          span: nodeSpan(ctx.file, child),
          type: typeNode?.text,
          value,
          exported: isExported(name),
        });
      }
    }
  }
}

function processVarDeclaration(ctx: FileContext, node: SyntaxNode): void {
  const specs: SyntaxNode[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "var_spec") {
      specs.push(child);
    } else if (child.type === "var_spec_list") {
      for (let j = 0; j < child.namedChildCount; j++) {
        const spec = child.namedChild(j)!;
        if (spec.type === "var_spec") specs.push(spec);
      }
    }
  }

  for (const spec of specs) {
    const names = spec.namedChildren.filter(c => c.type === "identifier");
    const typeNode = spec.namedChildren.find(c =>
      c.type !== "identifier" && c.type !== "expression_list",
    );

    for (const nameNode of names) {
      const name = nameNode.text;
      const id = createNodeId({ type: "Configuration", name, file: ctx.file });
      ctx.variables.push({
        id,
        name,
        file: ctx.file,
        span: nodeSpan(ctx.file, spec),
        type: typeNode?.text,
        exported: isExported(name),
      });
    }
  }
}

function extractParameterList(node: SyntaxNode | null): GoParameter[] {
  if (!node || node.type !== "parameter_list") return [];

  const params: GoParameter[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "parameter_declaration") {
      const names = child.namedChildren.filter(c => c.type === "identifier");
      const typeChild = child.namedChildren.find(c =>
        c.type !== "identifier" && c.type !== "variadic_parameter_declaration",
      );
      const isVariadic = child.namedChildren.some(c => c.type === "variadic_parameter_declaration")
        || typeChild?.type === "variadic_argument";

      const typeName = typeChild?.text ?? "";
      if (names.length > 0) {
        for (const n of names) {
          params.push({ name: n.text, type: typeName, variadic: false });
        }
      } else {
        params.push({ name: "", type: typeName, variadic: false });
      }
    } else if (child.type === "variadic_parameter_declaration") {
      const nameNode = child.namedChildren.find(c => c.type === "identifier");
      const typeChild = child.namedChildren.find(c => c.type !== "identifier");
      params.push({
        name: nameNode?.text ?? "",
        type: typeChild?.text ?? "",
        variadic: true,
      });
    }
  }
  return params;
}

function extractResultList(node: SyntaxNode | null): GoParameter[] {
  if (!node) return [];

  if (node.type === "parameter_list") {
    return extractParameterList(node);
  }

  return [{ name: "", type: node.text, variadic: false }];
}

function extractTypeParameters(node: SyntaxNode | null): string[] {
  if (!node || node.type !== "type_parameter_list") return [];

  const params: string[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "type_parameter_declaration") {
      const nameNode = child.namedChildren.find(c => c.type === "identifier");
      if (nameNode) params.push(nameNode.text);
    }
  }
  return params;
}

function walkForCalls(ctx: FileContext, node: SyntaxNode, ownerId: string): void {
  if (node.type === "call_expression") {
    processCallExpression(ctx, node, ownerId);
  }

  if (node.type === "go_statement") {
    for (let i = 0; i < node.namedChildCount; i++) {
      walkForCalls(ctx, node.namedChild(i)!, ownerId);
    }
    return;
  }

  for (let i = 0; i < node.namedChildCount; i++) {
    walkForCalls(ctx, node.namedChild(i)!, ownerId);
  }
}

function processCallExpression(ctx: FileContext, node: SyntaxNode, ownerId: string): void {
  const funcNode = node.childForFieldName("function");
  if (!funcNode) return;

  let calleeName: string | undefined;
  let receiverName: string | undefined;
  let methodName: string | undefined;

  if (funcNode.type === "identifier") {
    calleeName = funcNode.text;
  } else if (funcNode.type === "selector_expression") {
    const operand = funcNode.childForFieldName("operand");
    const field = funcNode.childForFieldName("field");
    receiverName = operand?.text;
    methodName = field?.text;
    calleeName = funcNode.text;
  } else if (funcNode.type === "parenthesized_expression" || funcNode.type === "type_conversion_expression") {
    calleeName = funcNode.text;
  }

  const argList = node.childForFieldName("arguments");
  const argumentCount = argList?.namedChildCount ?? 0;

  const callId = createNodeId({
    type: "Function",
    name: `call:${ctx.file}:${calleeName ?? "unknown"}`,
    file: ctx.file,
    signature: `${ownerId}:${node.startPosition.row}:${node.startPosition.column}`,
  });

  ctx.calls.push({
    id: callId,
    file: ctx.file,
    ownerId,
    expression: node.text.length > 200 ? node.text.substring(0, 200) : node.text,
    calleeName,
    receiverName,
    methodName,
    argumentCount,
    span: nodeSpan(ctx.file, node),
  });
}
