import { persistCompilerCache, persistGraph } from "@0xsarwagya/ontoly-cache";
import { stableHash, stableStringify } from "@0xsarwagya/ontoly-core";
import { compilerDiagnostic } from "../diagnostics";
import { createCompilerGraphBuilder } from "../graph";
import { discoverRepository, createSourceInventory } from "../repository";
import {
  COMPILER_STAGE_IDS,
  COMPILER_PIPELINE_VERSION,
  type CompilerContext,
  type CompilerGraphBuilder,
  type CompilerPipelineState,
  type CompilerPassResult,
  type CompilerStage,
  type CompilerStageId,
  type PassExecutionRecord,
} from "../types";
import { validateGraph } from "../validation";

export function createDefaultCompilerStages(): readonly CompilerStage[] {
  return COMPILER_STAGE_IDS.map((id) => createDefaultStage(id));
}

function createDefaultStage(id: CompilerStageId): CompilerStage {
  return {
    id,
    run: async (context, state) => {
      const passRecords = await context.passManager.runStage(id, context, state);
      const withPassRecords = <T extends object>(result: T): T & { readonly passResults: typeof passRecords } => ({
        ...result,
        passResults: passRecords,
      });

      switch (id) {
        case "invocation":
          return withPassRecords({
            output: {
              mode: context.invocation.mode,
              write: context.invocation.write,
              passes: passRecords.length,
            },
          });

        case "context-initialization":
          return withPassRecords({
            output: {
              namespaces: [...context.extensions.namespaces],
              passes: passRecords.length,
            },
          });

        case "configuration-loading":
          return withPassRecords({
            output: {
              configured: Object.keys(context.config).sort(),
              passes: passRecords.length,
            },
          });

        case "repository-discovery": {
          const discovery = await discoverRepository(
            context.invocation.root,
            context.invocation.sourceProvider,
            context.config.exclude ?? [],
          );
          return withPassRecords({
            discovery,
            output: {
              root: discovery.root,
              name: discovery.name,
              files: discovery.files.length,
              passes: passRecords.length,
            },
          });
        }

        case "source-inventory": {
          const sources = await createSourceInventory(
            context.invocation.root,
            context.invocation.sourceProvider,
            context.config.exclude ?? [],
          );
          return withPassRecords({
            sources,
            output: {
              sources: sources.sources.length,
              passes: passRecords.length,
            },
          });
        }

        case "cache-loading-and-compatibility":
          return withPassRecords({
            cache: {
              compatible: true,
              entries: new Map<string, unknown>(),
            },
            output: {
              compatible: true,
              passes: passRecords.length,
            },
          });

        case "graph-construction": {
          const builder = createCompilerGraphBuilder();
          const parserVersions: Record<string, string> = {};

          addPassProducts(builder, state.passResults, parserVersions);
          addPassProducts(builder, passRecords, parserVersions);

          for (const diagnostic of context.diagnostics.list()) {
            builder.addDiagnostic(diagnostic);
          }

          const graph = builder.build({
            repository: context.repository,
            fileCount: state.sources?.sources.length ?? state.discovery?.files.length ?? 0,
            parserVersions,
          });

          return withPassRecords({
            graph,
            output: {
              nodes: graph.nodes.length,
              edges: graph.edges.length,
              diagnostics: graph.diagnostics.length,
              passes: passRecords.length,
            },
          });
        }

        case "graph-validation": {
          if (!state.graph) {
            const diagnostic = context.diagnostics.add(
              compilerDiagnostic({
                code: "GRAPH_VALIDATION_MISSING_GRAPH",
                severity: "error",
                message: "Graph validation stage ran before graph construction produced a graph.",
              }),
            );
            return withPassRecords({
              fatal: true,
              output: {
                diagnostic: diagnostic.id,
                passes: passRecords.length,
              },
            });
          }

          const validation = await validateGraph(state.graph, context, context.validationHooks);

          for (const issue of validation.issues) {
            context.diagnostics.add(
              compilerDiagnostic({
                code: `GRAPH_VALIDATION_${issue.code}`,
                severity: issue.severity,
                message: issue.message,
              }),
            );
          }

          return withPassRecords({
            validation,
            fatal: !validation.ok,
            output: {
              ok: validation.ok,
              issues: validation.issues.length,
              passes: passRecords.length,
            },
          });
        }

        case "serialization":
          return withPassRecords({
            output: {
              planned: Boolean(state.graph),
              contentHash: state.graph ? stableHash(stableStringify(state.graph)) : null,
              passes: passRecords.length,
            },
          });

        case "artifact-commit": {
          if (!context.invocation.write || !state.graph || state.validation?.ok === false) {
            return withPassRecords({
              output: {
                committed: false,
                passes: passRecords.length,
              },
            });
          }

          const artifacts = await persistGraph(state.graph, {
            root: context.invocation.root,
            directory: context.invocation.outputDir,
          });
          await persistCompilerCache(
            {
              root: context.invocation.root,
              directory: context.invocation.outputDir,
            },
            {
              pipeline: COMPILER_PIPELINE_VERSION,
              passes: state.passResults.map((record) => record.passId).sort(),
              graphHash: state.graph.metadata.deterministicHash,
            },
          );

          return withPassRecords({
            artifacts,
            output: {
              committed: true,
              graph: artifacts.graph,
              passes: passRecords.length,
            },
          });
        }

        default:
          return withPassRecords({
            output: {
              passes: passRecords.length,
            },
          });
      }
    },
  };
}

function addPassProducts(
  builder: CompilerGraphBuilder,
  records: readonly PassExecutionRecord[],
  parserVersions: Record<string, string>,
): void {
  for (const record of records) {
    addParserVersions(parserVersions, record.result);

    for (const symbol of record.result.symbols ?? []) {
      builder.addSymbol(symbol);
    }

    for (const relationship of record.result.relationships ?? []) {
      builder.addRelationship(relationship);
    }

    for (const node of record.result.nodes ?? []) {
      builder.addNode(node);
    }

    for (const edge of record.result.edges ?? []) {
      builder.addEdge(edge);
    }

    for (const diagnostic of record.result.diagnostics ?? []) {
      builder.addDiagnostic(diagnostic);
    }
  }
}

function addParserVersions(
  target: Record<string, string>,
  result: CompilerPassResult,
): void {
  for (const [name, version] of Object.entries(result.parserVersions ?? {})) {
    target[name] = version;
  }
}
