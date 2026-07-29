import {
  stableHash,
  stableStringify,
} from "@0xsarwagya/ontoly-core";
import type { CompilerPass } from "@0xsarwagya/ontoly-compiler";
import {
  analyzePythonProject,
  PYTHON_ANALYZER_NAME,
  PYTHON_ANALYZER_VERSION,
  type PythonProject,
} from "@0xsarwagya/ontoly-python";
import {
  createDefaultPythonFrameworkRegistry,
  generatePythonCompilerArtifacts,
  type DetectionResult,
  type GeneratePythonCompilerArtifactsResult,
  type PythonFrameworkRegistry,
  type SemanticFact,
} from "@0xsarwagya/ontoly-semantic-python";

export const PYTHON_FRONTEND_NAME = PYTHON_ANALYZER_NAME;
export const PYTHON_FRONTEND_PASS_ID = "@0xsarwagya/ontoly-parser-python:frontend";
export const PYTHON_FRONTEND_VERSION = PYTHON_ANALYZER_VERSION;
export const PYTHON_FRONTEND_CACHE_VERSION = "1.0.0";

export interface PythonFrontendResult {
  readonly symbols: GeneratePythonCompilerArtifactsResult["symbols"];
  readonly relationships: GeneratePythonCompilerArtifactsResult["relationships"];
  readonly diagnostics: GeneratePythonCompilerArtifactsResult["diagnostics"];
  readonly fileCount: number;
  readonly parserVersion: string;
  readonly semanticModel: PythonProject;
  readonly frameworkDetections: readonly DetectionResult[];
  readonly semanticFacts: readonly SemanticFact[];
}

export interface PythonFrontendPassOptions {
  readonly id?: string | undefined;
  readonly files?: readonly string[] | undefined;
  readonly registry?: PythonFrameworkRegistry | undefined;
}

export function createPythonFrontendPass(
  options: PythonFrontendPassOptions = {},
): CompilerPass {
  const passId = options.id ?? PYTHON_FRONTEND_PASS_ID;

  return {
    id: passId,
    version: PYTHON_FRONTEND_VERSION,
    cacheKey: stableHash(stableStringify({
      version: PYTHON_FRONTEND_CACHE_VERSION,
      analyzerVersion: PYTHON_FRONTEND_VERSION,
      files: options.files,
    })),
    kind: "parser",
    stage: "frontend-parsing",
    semantic: true,
    reads: ["source-inventory"],
    writes: [
      "python-semantic-model",
      "python-framework-semantic-facts",
      "compiler-symbols:python",
      "compiler-relationships:python",
    ],
    run: async (context, state) => {
      const allFiles = options.files
        ?? state.sources?.sources.map((source) => source.path)
        ?? [];

      const pyFiles = allFiles.filter((f) => f.endsWith(".py"));

      if (pyFiles.length === 0) {
        return {
          symbols: [],
          relationships: [],
          diagnostics: [],
          parserVersions: {
            [PYTHON_FRONTEND_NAME]: PYTHON_FRONTEND_VERSION,
          },
          output: { files: 0, symbols: 0, relationships: 0, skipped: true },
          products: {},
        };
      }

      const provider = context.invocation.sourceProvider;
      const result = parsePythonFrontend({
        root: context.invocation.root,
        files: pyFiles,
        sourceProvider: provider ? (path: string) => provider.readFile(path) : undefined,
        registry: options.registry,
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
          [PYTHON_FRONTEND_NAME]: result.parserVersion,
        },
        output: {
          files: result.fileCount,
          symbols: result.symbols.length,
          relationships: result.relationships.length,
          parserVersion: result.parserVersion,
          frameworkDetections: result.frameworkDetections
            .filter((item) => item.detected)
            .map((item) => item.framework),
          semanticFacts: result.semanticFacts.length,
        },
        products: {
          "python-semantic-model": result.semanticModel,
        },
      };
    },
  };
}

export interface ParsePythonFrontendInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly sourceProvider?: ((path: string) => string | undefined) | undefined;
  readonly registry?: PythonFrameworkRegistry | undefined;
}

export function parsePythonFrontend(input: ParsePythonFrontendInput): PythonFrontendResult {
  const semanticModel = analyzePythonProject({
    root: input.root,
    files: input.files,
    sourceProvider: input.sourceProvider,
  });

  const registry = input.registry ?? createDefaultPythonFrameworkRegistry();
  const artifacts = generatePythonCompilerArtifacts({
    project: semanticModel,
    registry,
  });

  return {
    symbols: artifacts.symbols,
    relationships: artifacts.relationships,
    diagnostics: artifacts.diagnostics,
    fileCount: semanticModel.files.length,
    parserVersion: PYTHON_FRONTEND_VERSION,
    semanticModel,
    frameworkDetections: artifacts.detections,
    semanticFacts: artifacts.facts,
  };
}

export {
  createDefaultPythonFrameworkRegistry,
  generatePythonCompilerArtifacts,
  type DetectionResult,
  type PythonFrameworkAnalyzer,
  type PythonFrameworkRegistry,
  type SemanticFact,
} from "@0xsarwagya/ontoly-semantic-python";

export {
  analyzePythonProject,
  type PythonProject,
} from "@0xsarwagya/ontoly-python";
