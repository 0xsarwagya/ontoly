import { readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import {
  createNodeId,
  normalizePath,
  stableHash,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";

export const PYTHON_SEMANTIC_MODEL_VERSION = "1.0.0";
export const PYTHON_ANALYZER_NAME = "python";
export const PYTHON_ANALYZER_VERSION = "0.1.0";

export interface AnalyzePythonProjectInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly sourceProvider?: ((path: string) => string | undefined) | undefined;
}

export interface PythonProject {
  readonly version: string;
  readonly root: string;
  readonly files: readonly PythonSourceFile[];
  readonly classes: readonly PythonClass[];
  readonly functions: readonly PythonFunction[];
  readonly methods: readonly PythonMethod[];
  readonly imports: readonly PythonImport[];
  readonly variables: readonly PythonVariable[];
  readonly decorators: readonly PythonDecorator[];
  readonly calls: readonly PythonCall[];
  readonly assignments: readonly PythonAssignment[];
  readonly diagnostics: readonly PythonDiagnostic[];
  readonly metadata: PythonSemanticModelMetadata;
}

export interface PythonSemanticModelMetadata {
  readonly fileCount: number;
  readonly parseErrors: number;
}

export interface PythonSourceFile {
  readonly id: string;
  readonly file: string;
  readonly absoluteFile: string;
  readonly span: SourceSpan;
}

export interface PythonClass {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly bases: readonly string[];
  readonly decorators: readonly PythonDecorator[];
  readonly exported: boolean;
}

export interface PythonFunction {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly async: boolean;
  readonly parameters: readonly PythonParameter[];
  readonly returnAnnotation?: string | undefined;
  readonly decorators: readonly PythonDecorator[];
  readonly exported: boolean;
}

export interface PythonMethod {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly className: string;
  readonly methodName: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly async: boolean;
  readonly static: boolean;
  readonly classmethod: boolean;
  readonly property: boolean;
  readonly parameters: readonly PythonParameter[];
  readonly returnAnnotation?: string | undefined;
  readonly decorators: readonly PythonDecorator[];
}

export interface PythonParameter {
  readonly name: string;
  readonly annotation?: string | undefined;
  readonly defaultValue?: string | undefined;
  readonly kind: "positional" | "keyword" | "star" | "double_star";
}

export interface PythonImport {
  readonly id: string;
  readonly file: string;
  readonly module: string;
  readonly names: readonly PythonImportName[];
  readonly relative: boolean;
  readonly relativeLevel: number;
  readonly span: SourceSpan;
}

export interface PythonImportName {
  readonly name: string;
  readonly alias?: string | undefined;
}

export interface PythonVariable {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly span: SourceSpan;
  readonly annotation?: string | undefined;
  readonly ownerId?: string | undefined;
}

export interface PythonDecorator {
  readonly id: string;
  readonly name: string;
  readonly expression: string;
  readonly arguments: readonly string[];
  readonly targetId: string;
  readonly file: string;
  readonly span: SourceSpan;
}

export interface PythonCall {
  readonly id: string;
  readonly file: string;
  readonly ownerId: string;
  readonly expression: string;
  readonly calleeName?: string | undefined;
  readonly receiverName?: string | undefined;
  readonly methodName?: string | undefined;
  readonly argumentCount: number;
  readonly targetId?: string | undefined;
  readonly span: SourceSpan;
}

export interface PythonAssignment {
  readonly id: string;
  readonly file: string;
  readonly target: string;
  readonly annotation?: string | undefined;
  readonly valueExpression?: string | undefined;
  readonly ownerId?: string | undefined;
  readonly span: SourceSpan;
}

export interface PythonDiagnostic {
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
  readonly sourceFiles: PythonSourceFile[];
  readonly classes: PythonClass[];
  readonly functions: PythonFunction[];
  readonly methods: PythonMethod[];
  readonly imports: PythonImport[];
  readonly variables: PythonVariable[];
  readonly decorators: PythonDecorator[];
  readonly calls: PythonCall[];
  readonly assignments: PythonAssignment[];
  readonly diagnostics: PythonDiagnostic[];
}

let sharedParser: Parser | undefined;

function getParser(): Parser {
  if (!sharedParser) {
    sharedParser = new Parser();
    sharedParser.setLanguage(Python);
  }
  return sharedParser;
}

export function analyzePythonProject(input: AnalyzePythonProjectInput): PythonProject {
  const parser = getParser();
  const sourceFiles: PythonSourceFile[] = [];
  const classes: PythonClass[] = [];
  const functions: PythonFunction[] = [];
  const methods: PythonMethod[] = [];
  const imports: PythonImport[] = [];
  const variables: PythonVariable[] = [];
  const decorators: PythonDecorator[] = [];
  const calls: PythonCall[] = [];
  const assignments: PythonAssignment[] = [];
  const diagnostics: PythonDiagnostic[] = [];
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
          code: "python-read-error",
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

    const moduleId = createNodeId({ type: "Script", name: file, file });
    const sourceFile: PythonSourceFile = {
      id: moduleId,
      file,
      absoluteFile,
      span: { file, startLine: 1, startColumn: 0, endLine: totalLines, endColumn: lastLineLength },
    };
    sourceFiles.push(sourceFile);

    const ctx: FileContext = {
      root: input.root,
      file,
      absoluteFile,
      moduleId,
      sourceFiles,
      classes,
      functions,
      methods,
      imports,
      variables,
      decorators,
      calls,
      assignments,
      diagnostics,
    };

    walkModule(ctx, tree.rootNode, moduleId);
  }

  return {
    version: PYTHON_SEMANTIC_MODEL_VERSION,
    root: input.root,
    files: sourceFiles,
    classes,
    functions,
    methods,
    imports,
    variables,
    decorators,
    calls,
    assignments,
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

function walkModule(ctx: FileContext, moduleNode: SyntaxNode, ownerId: string): void {
  for (let i = 0; i < moduleNode.namedChildCount; i++) {
    const child = moduleNode.namedChild(i)!;
    processTopLevelNode(ctx, child, ownerId);
  }
}

function processTopLevelNode(ctx: FileContext, node: SyntaxNode, ownerId: string): void {
  switch (node.type) {
    case "import_statement":
      processImportStatement(ctx, node);
      break;
    case "import_from_statement":
      processImportFromStatement(ctx, node);
      break;
    case "class_definition":
      processClassDefinition(ctx, node, ownerId, []);
      break;
    case "function_definition":
      processFunctionDefinition(ctx, node, ownerId, [], undefined);
      break;
    case "decorated_definition":
      processDecoratedDefinition(ctx, node, ownerId);
      break;
    case "expression_statement": {
      const expr = node.namedChild(0);
      if (expr?.type === "assignment") {
        processAssignment(ctx, expr, ownerId);
      } else if (expr?.type === "call") {
        processCall(ctx, expr, ownerId);
      }
      break;
    }
  }
}

function processImportStatement(ctx: FileContext, node: SyntaxNode): void {
  const names: PythonImportName[] = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "dotted_name") {
      names.push({ name: child.text });
    } else if (child.type === "aliased_import") {
      const nameNode = child.namedChild(0);
      const aliasNode = child.namedChild(1);
      if (nameNode) {
        names.push({
          name: nameNode.text,
          alias: aliasNode?.text,
        });
      }
    }
  }

  for (const n of names) {
    const id = createNodeId({ type: "Import", name: `${ctx.file}:${n.name}`, file: ctx.file });
    ctx.imports.push({
      id,
      file: ctx.file,
      module: n.name,
      names: [{ name: n.name, alias: n.alias }],
      relative: false,
      relativeLevel: 0,
      span: nodeSpan(ctx.file, node),
    });
  }
}

function processImportFromStatement(ctx: FileContext, node: SyntaxNode): void {
  let moduleName = "";
  let relativeLevel = 0;
  let isRelative = false;
  const names: PythonImportName[] = [];

  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)!;
    if (child.type === "relative_import") {
      isRelative = true;
      const prefix = child.childForFieldName("module_name")
        ?? child.namedChildren.find(c => c.type === "import_prefix");
      if (prefix?.type === "import_prefix") {
        relativeLevel = prefix.text.length;
      }
      const dottedName = child.namedChildren.find(c => c.type === "dotted_name");
      if (dottedName) {
        moduleName = dottedName.text;
      }
    } else if (child.type === "dotted_name" && !moduleName) {
      moduleName = child.text;
    } else if (child.type === "dotted_name" && moduleName) {
      names.push({ name: child.text });
    } else if (child.type === "aliased_import") {
      const nameNode = child.namedChild(0);
      const aliasNode = child.namedChild(1);
      if (nameNode) {
        names.push({ name: nameNode.text, alias: aliasNode?.text });
      }
    } else if (child.type === "wildcard_import") {
      names.push({ name: "*" });
    }
  }

  const id = createNodeId({
    type: "Import",
    name: `${ctx.file}:${isRelative ? ".".repeat(relativeLevel) : ""}${moduleName}`,
    file: ctx.file,
  });

  ctx.imports.push({
    id,
    file: ctx.file,
    module: moduleName,
    names,
    relative: isRelative,
    relativeLevel,
    span: nodeSpan(ctx.file, node),
  });
}

function processClassDefinition(
  ctx: FileContext,
  node: SyntaxNode,
  ownerId: string,
  classDecorators: PythonDecorator[],
): void {
  const nameNode = node.namedChildren.find(c => c.type === "identifier");
  if (!nameNode) return;

  const className = nameNode.text;
  const classId = createNodeId({ type: "Class", name: className, file: ctx.file });

  const bases: string[] = [];
  const argList = node.namedChildren.find(c => c.type === "argument_list");
  if (argList) {
    for (let i = 0; i < argList.namedChildCount; i++) {
      const arg = argList.namedChild(i)!;
      if (arg.type === "identifier" || arg.type === "attribute") {
        bases.push(arg.text);
      }
    }
  }

  const cls: PythonClass = {
    id: classId,
    name: className,
    file: ctx.file,
    span: nodeSpan(ctx.file, node),
    bases,
    decorators: classDecorators,
    exported: true,
  };
  ctx.classes.push(cls);

  const block = node.namedChildren.find(c => c.type === "block");
  if (block) {
    walkClassBody(ctx, block, classId, className);
  }
}

function walkClassBody(ctx: FileContext, block: SyntaxNode, classId: string, className: string): void {
  for (let i = 0; i < block.namedChildCount; i++) {
    const child = block.namedChild(i)!;
    if (child.type === "function_definition") {
      processMethodDefinition(ctx, child, classId, className, []);
    } else if (child.type === "decorated_definition") {
      processDecoratedClassMember(ctx, child, classId, className);
    } else if (child.type === "expression_statement") {
      const expr = child.namedChild(0);
      if (expr?.type === "assignment") {
        processAssignment(ctx, expr, classId);
      }
    }
  }
}

function processMethodDefinition(
  ctx: FileContext,
  node: SyntaxNode,
  classId: string,
  className: string,
  methodDecorators: PythonDecorator[],
): void {
  const nameNode = node.namedChildren.find(c => c.type === "identifier");
  if (!nameNode) return;

  const methodName = nameNode.text;
  const fullName = `${className}.${methodName}`;
  const methodId = createNodeId({ type: "Method", name: fullName, file: ctx.file });

  const isAsync = hasAsyncKeyword(node);
  const isStatic = methodDecorators.some(d => d.name === "staticmethod");
  const isClassmethod = methodDecorators.some(d => d.name === "classmethod");
  const isProperty = methodDecorators.some(d => d.name === "property");

  const parameters = extractParameters(node);
  const returnAnnotation = extractReturnAnnotation(node);

  const method: PythonMethod = {
    id: methodId,
    name: fullName,
    classId,
    className,
    methodName,
    file: ctx.file,
    span: nodeSpan(ctx.file, node),
    async: isAsync,
    static: isStatic,
    classmethod: isClassmethod,
    property: isProperty,
    parameters,
    returnAnnotation,
    decorators: methodDecorators,
  };
  ctx.methods.push(method);

  const block = node.namedChildren.find(c => c.type === "block");
  if (block) {
    walkFunctionBody(ctx, block, methodId);
  }
}

function processFunctionDefinition(
  ctx: FileContext,
  node: SyntaxNode,
  ownerId: string,
  funcDecorators: PythonDecorator[],
  _parentClassId: string | undefined,
): void {
  const nameNode = node.namedChildren.find(c => c.type === "identifier");
  if (!nameNode) return;

  const funcName = nameNode.text;
  const funcId = createNodeId({ type: "Function", name: funcName, file: ctx.file });

  const isAsync = hasAsyncKeyword(node);
  const parameters = extractParameters(node);
  const returnAnnotation = extractReturnAnnotation(node);

  const func: PythonFunction = {
    id: funcId,
    name: funcName,
    file: ctx.file,
    span: nodeSpan(ctx.file, node),
    async: isAsync,
    parameters,
    returnAnnotation,
    decorators: funcDecorators,
    exported: true,
  };
  ctx.functions.push(func);

  const block = node.namedChildren.find(c => c.type === "block");
  if (block) {
    walkFunctionBody(ctx, block, funcId);
  }
}

function processDecoratedDefinition(ctx: FileContext, node: SyntaxNode, ownerId: string): void {
  const definitionNode = node.namedChildren.find(
    c => c.type === "function_definition" || c.type === "class_definition",
  );
  if (!definitionNode) return;

  const nameNode = definitionNode.namedChildren.find(c => c.type === "identifier");
  const targetName = nameNode?.text ?? "";
  const targetType = definitionNode.type === "class_definition" ? "Class" as const : "Function" as const;
  const targetId = createNodeId({ type: targetType, name: targetName, file: ctx.file });

  const extractedDecorators = extractDecorators(ctx, node, targetId);

  if (definitionNode.type === "class_definition") {
    processClassDefinition(ctx, definitionNode, ownerId, extractedDecorators);
  } else {
    processFunctionDefinition(ctx, definitionNode, ownerId, extractedDecorators, undefined);
  }
}

function processDecoratedClassMember(
  ctx: FileContext,
  node: SyntaxNode,
  classId: string,
  className: string,
): void {
  const definitionNode = node.namedChildren.find(c => c.type === "function_definition");
  if (!definitionNode) return;

  const nameNode = definitionNode.namedChildren.find(c => c.type === "identifier");
  const methodName = nameNode?.text ?? "";
  const fullName = `${className}.${methodName}`;
  const targetId = createNodeId({ type: "Method", name: fullName, file: ctx.file });

  const extractedDecorators = extractDecorators(ctx, node, targetId);
  processMethodDefinition(ctx, definitionNode, classId, className, extractedDecorators);
}

function extractDecorators(ctx: FileContext, decoratedNode: SyntaxNode, targetId: string): PythonDecorator[] {
  const result: PythonDecorator[] = [];

  for (let i = 0; i < decoratedNode.namedChildCount; i++) {
    const child = decoratedNode.namedChild(i)!;
    if (child.type !== "decorator") continue;

    const content = child.namedChild(0);
    if (!content) continue;

    let name: string;
    let expression: string;
    const args: string[] = [];

    if (content.type === "identifier") {
      name = content.text;
      expression = content.text;
    } else if (content.type === "attribute") {
      name = content.text;
      expression = content.text;
    } else if (content.type === "call") {
      const callee = content.namedChildren.find(c => c.type === "identifier" || c.type === "attribute");
      name = callee?.text ?? content.text;
      expression = content.text;
      const argList = content.namedChildren.find(c => c.type === "argument_list");
      if (argList) {
        for (let j = 0; j < argList.namedChildCount; j++) {
          args.push(argList.namedChild(j)!.text);
        }
      }
    } else {
      name = content.text;
      expression = content.text;
    }

    const decId = createNodeId({
      type: "Decorator",
      name: `${ctx.file}:${name}`,
      file: ctx.file,
      signature: `${targetId}:${name}`,
    });

    const dec: PythonDecorator = {
      id: decId,
      name,
      expression,
      arguments: args,
      targetId,
      file: ctx.file,
      span: nodeSpan(ctx.file, child),
    };
    result.push(dec);
    ctx.decorators.push(dec);
  }

  return result;
}

function processAssignment(ctx: FileContext, node: SyntaxNode, ownerId: string): void {
  const targetNode = node.namedChild(0);
  if (!targetNode) return;
  if (targetNode.type === "attribute") return;

  const target = targetNode.text;

  const typeNode = node.namedChildren.find(c => c.type === "type");
  const annotation = typeNode?.namedChild(0)?.text;

  const valueChildren = node.namedChildren.filter(c => c.type !== "type" && c !== targetNode);
  const valueNode = valueChildren[0];
  const valueExpression = valueNode?.text;

  const assignId = createNodeId({
    type: "Configuration",
    name: `${ctx.file}:${target}`,
    file: ctx.file,
    signature: `${ownerId}:${target}`,
  });

  ctx.assignments.push({
    id: assignId,
    file: ctx.file,
    target,
    annotation,
    valueExpression,
    ownerId,
    span: nodeSpan(ctx.file, node),
  });

  if (ownerId === ctx.moduleId && targetNode.type === "identifier") {
    const varId = createNodeId({ type: "Configuration", name: target, file: ctx.file });
    ctx.variables.push({
      id: varId,
      name: target,
      file: ctx.file,
      span: nodeSpan(ctx.file, node),
      annotation,
      ownerId,
    });
  }
}

function processCall(ctx: FileContext, node: SyntaxNode, ownerId: string): void {
  const callee = node.namedChildren.find(c => c.type === "identifier" || c.type === "attribute");
  if (!callee) return;

  let calleeName: string | undefined;
  let receiverName: string | undefined;
  let methodName: string | undefined;

  if (callee.type === "identifier") {
    calleeName = callee.text;
  } else if (callee.type === "attribute") {
    const parts = callee.text.split(".");
    methodName = parts.pop();
    receiverName = parts.join(".");
    calleeName = callee.text;
  }

  const argList = node.namedChildren.find(c => c.type === "argument_list");
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
    targetId: undefined,
    span: nodeSpan(ctx.file, node),
  });
}

function walkFunctionBody(ctx: FileContext, block: SyntaxNode, ownerId: string): void {
  for (let i = 0; i < block.namedChildCount; i++) {
    const child = block.namedChild(i)!;
    walkForCalls(ctx, child, ownerId);
  }
}

function walkForCalls(ctx: FileContext, node: SyntaxNode, ownerId: string): void {
  if (node.type === "call") {
    processCall(ctx, node, ownerId);
    return;
  }

  if (node.type === "expression_statement") {
    const expr = node.namedChild(0);
    if (expr?.type === "call") {
      processCall(ctx, expr, ownerId);
      return;
    }
    if (expr?.type === "assignment") {
      const valueNode = expr.namedChildren.find(
        c => c.type !== "type" && c !== expr.namedChild(0),
      );
      if (valueNode) walkForCalls(ctx, valueNode, ownerId);
      return;
    }
  }

  if (node.type === "assignment") {
    const children = node.namedChildren;
    for (const c of children) {
      if (c.type === "call") {
        processCall(ctx, c, ownerId);
      }
    }
    return;
  }

  if (node.type === "return_statement" || node.type === "yield") {
    for (let i = 0; i < node.namedChildCount; i++) {
      walkForCalls(ctx, node.namedChild(i)!, ownerId);
    }
    return;
  }

  for (let i = 0; i < node.namedChildCount; i++) {
    walkForCalls(ctx, node.namedChild(i)!, ownerId);
  }
}

function hasAsyncKeyword(funcNode: SyntaxNode): boolean {
  for (let i = 0; i < funcNode.childCount; i++) {
    const child = funcNode.child(i)!;
    if (child.type === "async") return true;
    if (child.type === "def") return false;
  }
  return false;
}

function extractParameters(funcNode: SyntaxNode): PythonParameter[] {
  const paramsNode = funcNode.namedChildren.find(c => c.type === "parameters");
  if (!paramsNode) return [];

  const result: PythonParameter[] = [];
  for (let i = 0; i < paramsNode.namedChildCount; i++) {
    const param = paramsNode.namedChild(i)!;
    switch (param.type) {
      case "identifier":
        result.push({ name: param.text, kind: "positional" });
        break;
      case "typed_parameter": {
        const nameNode = param.namedChildren.find(c => c.type === "identifier");
        const typeNode = param.namedChildren.find(c => c.type === "type");
        result.push({
          name: nameNode?.text ?? param.text,
          annotation: typeNode?.namedChild(0)?.text,
          kind: "positional",
        });
        break;
      }
      case "default_parameter": {
        const nameNode = param.namedChild(0);
        const valueNode = param.namedChild(1);
        result.push({
          name: nameNode?.text ?? param.text,
          defaultValue: valueNode?.text,
          kind: "positional",
        });
        break;
      }
      case "typed_default_parameter": {
        const nameNode = param.namedChildren.find(c => c.type === "identifier");
        const typeNode = param.namedChildren.find(c => c.type === "type");
        const children = param.namedChildren;
        const valueNode = children[children.length - 1];
        const isValueNode = valueNode && valueNode !== nameNode && valueNode !== typeNode;
        result.push({
          name: nameNode?.text ?? param.text,
          annotation: typeNode?.namedChild(0)?.text,
          defaultValue: isValueNode ? valueNode.text : undefined,
          kind: "positional",
        });
        break;
      }
      case "list_splat_pattern":
        result.push({
          name: param.namedChild(0)?.text ?? param.text,
          kind: "star",
        });
        break;
      case "dictionary_splat_pattern":
        result.push({
          name: param.namedChild(0)?.text ?? param.text,
          kind: "double_star",
        });
        break;
      case "keyword_separator":
        break;
      default:
        result.push({ name: param.text, kind: "positional" });
        break;
    }
  }

  return result;
}

function extractReturnAnnotation(funcNode: SyntaxNode): string | undefined {
  const typeNode = funcNode.namedChildren.find(c => c.type === "type");
  if (!typeNode) return undefined;
  return typeNode.namedChild(0)?.text ?? typeNode.text;
}
