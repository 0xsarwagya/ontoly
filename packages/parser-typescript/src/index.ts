import ts from "typescript";
import type { SoftwareGraphDiagnostic } from "@0xsarwagya/ontoly-core";
import type {
  CompilerPass,
  CompilerRelationship,
  CompilerSymbol,
} from "@0xsarwagya/ontoly-compiler";
import {
  createDefaultFrameworkRegistry,
  generateCompilerArtifacts,
  type DetectionResult,
  type SemanticFact,
} from "@0xsarwagya/ontoly-semantic";
import {
  analyzeTypeScriptProject,
  createInMemoryCompilerHost,
  TYPESCRIPT_ANALYZER_NAME,
  TYPESCRIPT_ANALYZER_VERSION,
  type TypeScriptProject,
} from "@0xsarwagya/ontoly-typescript";

export const TYPESCRIPT_FRONTEND_NAME = TYPESCRIPT_ANALYZER_NAME;
export const TYPESCRIPT_FRONTEND_PASS_ID = "@0xsarwagya/ontoly-parser-typescript:frontend";
export const TYPESCRIPT_FRONTEND_VERSION = TYPESCRIPT_ANALYZER_VERSION;

export interface ParseTypeScriptFrontendInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly compilerOptions?: ts.CompilerOptions | undefined;
  readonly host?: ts.CompilerHost | undefined;
}

export interface TypeScriptFrontendResult {
  readonly symbols: readonly CompilerSymbol[];
  readonly relationships: readonly CompilerRelationship[];
  readonly diagnostics: readonly SoftwareGraphDiagnostic[];
  readonly fileCount: number;
  readonly parserVersion: string;
  readonly semanticModel: TypeScriptProject;
  readonly frameworkDetections: readonly DetectionResult[];
  readonly semanticFacts: readonly SemanticFact[];
}

export interface TypeScriptFrontendPassOptions {
  readonly id?: string | undefined;
  readonly compilerOptions?: ts.CompilerOptions | undefined;
  readonly files?: readonly string[] | undefined;
}

export function createTypeScriptFrontendPass(
  options: TypeScriptFrontendPassOptions = {},
): CompilerPass {
  const passId = options.id ?? TYPESCRIPT_FRONTEND_PASS_ID;

  return {
    id: passId,
    kind: "parser",
    stage: "frontend-parsing",
    semantic: true,
    reads: ["source-inventory"],
    writes: [
      "typescript-semantic-model",
      "framework-semantic-facts",
      "compiler-symbols:typescript",
      "compiler-relationships:typescript",
    ],
    run: async (context, state) => {
      const files = options.files ?? state.sources?.sources.map((source) => source.path) ?? [];
      const provider = context.invocation.sourceProvider;
      const host = provider
        ? createInMemoryCompilerHost(context.invocation.root, provider, options.compilerOptions ?? {})
        : undefined;
      const result = parseTypeScriptFrontend({
        root: context.invocation.root,
        files,
        compilerOptions: options.compilerOptions,
        host,
      });
      const symbols = result.symbols.map((symbol) => ({
        ...symbol,
        provenance: {
          ...symbol.provenance,
          passId,
        },
      }));

      return {
        symbols,
        relationships: result.relationships,
        diagnostics: result.diagnostics,
        parserVersions: {
          [TYPESCRIPT_FRONTEND_NAME]: result.parserVersion,
        },
        output: {
          files: result.fileCount,
          symbols: result.symbols.length,
          relationships: result.relationships.length,
          parserVersion: result.parserVersion,
          semanticModelVersion: result.semanticModel.version,
          frameworkDetections: result.frameworkDetections.filter((item) => item.detected).map((item) => item.framework),
          semanticFacts: result.semanticFacts.length,
        },
      };
    },
  };
}

export function parseTypeScriptFrontend(
  input: ParseTypeScriptFrontendInput,
): TypeScriptFrontendResult {
  const semanticModel = analyzeTypeScriptProject({
    root: input.root,
    files: input.files,
    compilerOptions: input.compilerOptions,
    host: input.host,
  });
  const artifacts = generateCompilerArtifacts({
    project: semanticModel,
    registry: createDefaultFrameworkRegistry(),
  });

  return {
    symbols: artifacts.symbols,
    relationships: artifacts.relationships,
    diagnostics: artifacts.diagnostics,
    fileCount: semanticModel.files.length,
    parserVersion: TYPESCRIPT_FRONTEND_VERSION,
    semanticModel,
    frameworkDetections: artifacts.detections,
    semanticFacts: artifacts.facts,
  };
}

export {
  createDefaultFrameworkRegistry,
  generateCompilerArtifacts,
  type DetectionResult,
  type SemanticFact,
};

export {
  analyze,
  analyzeTypeScriptProject,
  deserializeTypeScriptProject,
  serializeTypeScriptProject,
  validateTypeScriptSemanticModel,
  writeTypeScriptSemanticModel,
  type TypeScriptProject,
} from "@0xsarwagya/ontoly-typescript";
