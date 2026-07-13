import type {
  CompilerContext,
  CompilerPipelineState,
  CompilerStage,
  CompilerStageId,
  PipelineExecutorResult,
} from "../types";

export function createInitialPipelineState(): CompilerPipelineState {
  return {
    stageOutputs: new Map(),
    stageTrace: [],
    passResults: [],
    fatal: false,
  };
}

export async function executeCompilerPipeline(
  context: CompilerContext,
  stages: readonly CompilerStage[],
): Promise<PipelineExecutorResult> {
  let state = createInitialPipelineState();

  for (const stage of stages) {
    if (state.fatal) {
      break;
    }

    const result = await stage.run(context, state);
    state = mergeStageResult(state, stage.id, result);
  }

  return { state };
}

function mergeStageResult(
  state: CompilerPipelineState,
  stageId: CompilerStageId,
  result: Awaited<ReturnType<CompilerStage["run"]>>,
): CompilerPipelineState {
  const stageOutputs = new Map(state.stageOutputs);

  if (result.output) {
    stageOutputs.set(stageId, result.output);
  }

  return {
    stageOutputs,
    stageTrace: [...state.stageTrace, stageId],
    passResults: [...state.passResults, ...(result.passResults ?? [])],
    discovery: result.discovery ?? state.discovery,
    sources: result.sources ?? state.sources,
    cache: result.cache ?? state.cache,
    graph: result.graph ?? state.graph,
    validation: result.validation ?? state.validation,
    artifacts: result.artifacts ?? state.artifacts,
    fatal: state.fatal || result.fatal === true,
  };
}
