import type {
  CompilerContext,
  CompilerPipelineState,
  CompilerStage,
  CompilerStageId,
  PipelineExecutorResult,
} from "../types";

const CACHEABLE_STAGE_IDS = new Set<CompilerStageId>([
  "frontend-planning",
  "frontend-parsing",
  "fact-normalization",
  "symbol-and-reference-resolution",
  "core-compiler-passes",
  "diagnostics-pipeline",
  "graph-construction",
  "optimization-passes",
]);

export function createInitialPipelineState(): CompilerPipelineState {
  return {
    stageOutputs: new Map(),
    stageTrace: [],
    passResults: [],
    stageProfiles: [],
    products: new Map(),
    fatal: false,
  };
}

export async function executeCompilerPipeline(
  context: CompilerContext,
  stages: readonly CompilerStage[],
): Promise<PipelineExecutorResult> {
  let state = createInitialPipelineState();
  const pipelineStartedAt = performance.now();

  for (const [index, stage] of stages.entries()) {
    if (state.fatal) {
      break;
    }

    const cacheHit = state.cache?.hit === true;
    const skipped = cacheHit && CACHEABLE_STAGE_IDS.has(stage.id);
    await context.onProgress?.({
      stage: stage.id,
      phase: skipped ? "skipped" : "started",
      completedStages: skipped ? index + 1 : index,
      totalStages: stages.length,
      cacheHit,
    });

    const startedAt = performance.now();
    const memoryBefore = process.memoryUsage();
    const result = skipped
      ? { output: { cacheHit: true } }
      : await stage.run(context, state);
    const memoryAfter = process.memoryUsage();
    const profile = {
      stage: stage.id,
      status: skipped ? "skipped" as const : "completed" as const,
      durationMs: roundDuration(performance.now() - startedAt),
      heapUsedDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
      rssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
    };
    state = mergeStageResult(state, stage.id, result, profile);

    if (!skipped) {
      await context.onProgress?.({
        stage: stage.id,
        phase: "completed",
        completedStages: index + 1,
        totalStages: stages.length,
        durationMs: profile.durationMs,
        cacheHit: state.cache?.hit === true,
      });
    }
  }

  return {
    state,
    profile: {
      durationMs: roundDuration(performance.now() - pipelineStartedAt),
      stages: state.stageProfiles,
    },
  };
}

function mergeStageResult(
  state: CompilerPipelineState,
  stageId: CompilerStageId,
  result: Awaited<ReturnType<CompilerStage["run"]>>,
  profile: CompilerPipelineState["stageProfiles"][number],
): CompilerPipelineState {
  const stageOutputs = new Map(state.stageOutputs);
  const products = new Map(state.products);

  if (result.output) {
    stageOutputs.set(stageId, result.output);
  }

  for (const [id, product] of result.products ?? []) {
    products.set(id, product);
  }
  for (const record of result.passResults ?? []) {
    for (const [id, product] of Object.entries(record.result.products ?? {})) {
      products.set(id, product);
    }
  }

  return {
    stageOutputs,
    stageTrace: [...state.stageTrace, stageId],
    passResults: [...state.passResults, ...(result.passResults ?? [])],
    stageProfiles: [...state.stageProfiles, profile],
    products,
    discovery: result.discovery ?? state.discovery,
    sources: result.sources ?? state.sources,
    cache: result.cache ?? state.cache,
    graph: result.graph ?? state.graph,
    validation: result.validation ?? state.validation,
    artifacts: result.artifacts ?? state.artifacts,
    fatal: state.fatal || result.fatal === true,
  };
}

function roundDuration(durationMs: number): number {
  return Math.round(durationMs * 100) / 100;
}
