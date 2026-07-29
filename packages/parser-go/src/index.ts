import {
  stableHash,
  stableStringify,
} from "@0xsarwagya/ontoly-core";
import type { CompilerPass } from "@0xsarwagya/ontoly-compiler";
import {
  analyzeGoProject,
  GO_ANALYZER_NAME,
  GO_ANALYZER_VERSION,
  type GoProject,
} from "@0xsarwagya/ontoly-go";
import {
  createDefaultGoFrameworkRegistry,
  generateGoCompilerArtifacts,
  type DetectionResult,
  type GenerateGoCompilerArtifactsResult,
  type GoFrameworkRegistry,
  type SemanticFact,
} from "@0xsarwagya/ontoly-semantic-go";

export const GO_FRONTEND_NAME = GO_ANALYZER_NAME;
export const GO_FRONTEND_PASS_ID = "@0xsarwagya/ontoly-parser-go:frontend";
export const GO_FRONTEND_VERSION = GO_ANALYZER_VERSION;
export const GO_FRONTEND_CACHE_VERSION = "1.0.0";

export interface GoFrontendResult {
  readonly symbols: GenerateGoCompilerArtifactsResult["symbols"];
  readonly relationships: GenerateGoCompilerArtifactsResult["relationships"];
  readonly diagnostics: GenerateGoCompilerArtifactsResult["diagnostics"];
  readonly fileCount: number;
  readonly parserVersion: string;
  readonly semanticModel: GoProject;
  readonly frameworkDetections: readonly DetectionResult[];
  readonly semanticFacts: readonly SemanticFact[];
}

export interface GoFrontendPassOptions {
  readonly id?: string | undefined;
  readonly files?: readonly string[] | undefined;
  readonly registry?: GoFrameworkRegistry | undefined;
}

export function createGoFrontendPass(
  options: GoFrontendPassOptions = {},
): CompilerPass {
  const passId = options.id ?? GO_FRONTEND_PASS_ID;

  return {
    id: passId,
    version: GO_FRONTEND_VERSION,
    cacheKey: stableHash(stableStringify({
      version: GO_FRONTEND_CACHE_VERSION,
      analyzerVersion: GO_FRONTEND_VERSION,
      files: options.files,
    })),
    kind: "parser",
    stage: "frontend-parsing",
    semantic: true,
    reads: ["source-inventory"],
    writes: [
      "go-semantic-model",
      "go-framework-semantic-facts",
      "compiler-symbols:go",
      "compiler-relationships:go",
    ],
    run: async (context, state) => {
      const allFiles = options.files
        ?? state.sources?.sources.map((source) => source.path)
        ?? [];

      const goFiles = allFiles.filter((f) => f.endsWith(".go"));

      if (goFiles.length === 0) {
        return {
          symbols: [],
          relationships: [],
          diagnostics: [],
          parserVersions: {
            [GO_FRONTEND_NAME]: GO_FRONTEND_VERSION,
          },
          output: { files: 0, symbols: 0, relationships: 0, skipped: true },
          products: {},
        };
      }

      const provider = context.invocation.sourceProvider;
      const result = parseGoFrontend({
        root: context.invocation.root,
        files: goFiles,
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
          [GO_FRONTEND_NAME]: result.parserVersion,
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
          "go-semantic-model": result.semanticModel,
        },
      };
    },
  };
}

export interface ParseGoFrontendInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly sourceProvider?: ((path: string) => string | undefined) | undefined;
  readonly registry?: GoFrameworkRegistry | undefined;
}

export function parseGoFrontend(input: ParseGoFrontendInput): GoFrontendResult {
  const semanticModel = analyzeGoProject({
    root: input.root,
    files: input.files,
    sourceProvider: input.sourceProvider,
  });

  const registry = input.registry ?? createDefaultGoFrameworkRegistry();
  const artifacts = generateGoCompilerArtifacts({
    project: semanticModel,
    registry,
  });

  return {
    symbols: artifacts.symbols,
    relationships: artifacts.relationships,
    diagnostics: artifacts.diagnostics,
    fileCount: semanticModel.files.length,
    parserVersion: GO_FRONTEND_VERSION,
    semanticModel,
    frameworkDetections: artifacts.detections,
    semanticFacts: artifacts.facts,
  };
}

export {
  createDefaultGoFrameworkRegistry,
  generateGoCompilerArtifacts,
  type DetectionResult,
  type GoFrameworkAnalyzer,
  type GoFrameworkRegistry,
  type SemanticFact,
} from "@0xsarwagya/ontoly-semantic-go";

export {
  analyzeGoProject,
  type GoProject,
} from "@0xsarwagya/ontoly-go";
