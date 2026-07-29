import type { JsonObject, SourceSpan } from "@0xsarwagya/ontoly-core";

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

export function analyzePythonProject(_input: AnalyzePythonProjectInput): PythonProject {
  return {
    version: PYTHON_SEMANTIC_MODEL_VERSION,
    root: _input.root,
    files: [],
    classes: [],
    functions: [],
    methods: [],
    imports: [],
    variables: [],
    decorators: [],
    calls: [],
    assignments: [],
    diagnostics: [],
    metadata: { fileCount: 0, parseErrors: 0 },
  };
}
