import { COMPILER_STAGE_IDS, type CompilerPass, type CompilerStageId, type PassExecutionRecord, type PassManager } from "../types";

export function createPassManager(passes: readonly CompilerPass[]): PassManager {
  const orderedPasses = orderPasses(passes);

  return {
    passesForStage: (stage) => orderedPasses.filter((pass) => pass.stage === stage),
    runStage: async (stage, context, state) => {
      const records: PassExecutionRecord[] = [];

      for (const pass of orderedPasses.filter((item) => item.stage === stage)) {
        const result = await pass.run(context, state);

        for (const diagnostic of result.diagnostics ?? []) {
          context.diagnostics.add(diagnostic);
        }

        records.push({ passId: pass.id, stage, result });
      }

      return records;
    },
  };
}

export function orderPasses(passes: readonly CompilerPass[]): readonly CompilerPass[] {
  validatePasses(passes);

  const passesById = new Map(passes.map((pass) => [pass.id, pass] as const));
  const edges = new Map<string, Set<string>>();

  for (const pass of passes) {
    edges.set(pass.id, edges.get(pass.id) ?? new Set<string>());
  }

  for (const pass of passes) {
    for (const required of pass.requires ?? []) {
      addOrderingEdge(edges, required, pass.id);
    }

    for (const after of pass.after ?? []) {
      addOrderingEdge(edges, after, pass.id);
    }

    for (const before of pass.before ?? []) {
      addOrderingEdge(edges, pass.id, before);
    }
  }

  const stageRank = new Map(COMPILER_STAGE_IDS.map((stage, index) => [stage, index] as const));
  const sortedIds = topologicalSort([...passesById.keys()].sort(), edges, passesById, stageRank);

  return sortedIds.map((id) => {
    const pass = passesById.get(id);

    if (!pass) {
      throw new Error(`Unknown pass ${id}.`);
    }

    return pass;
  });
}

function validatePasses(passes: readonly CompilerPass[]): void {
  const seen = new Set<string>();

  for (const pass of passes) {
    if (seen.has(pass.id)) {
      throw new Error(`Duplicate compiler pass id: ${pass.id}`);
    }

    seen.add(pass.id);

    if (!COMPILER_STAGE_IDS.includes(pass.stage)) {
      throw new Error(`Compiler pass ${pass.id} targets unknown stage ${pass.stage}.`);
    }
  }

  for (const pass of passes) {
    for (const dependency of [...(pass.requires ?? []), ...(pass.before ?? []), ...(pass.after ?? [])]) {
      if (!seen.has(dependency)) {
        throw new Error(`Compiler pass ${pass.id} references unknown pass ${dependency}.`);
      }
    }
  }
}

function addOrderingEdge(edges: Map<string, Set<string>>, from: string, to: string): void {
  const outgoing = edges.get(from) ?? new Set<string>();
  outgoing.add(to);
  edges.set(from, outgoing);
}

function topologicalSort(
  ids: readonly string[],
  edges: ReadonlyMap<string, ReadonlySet<string>>,
  passesById: ReadonlyMap<string, CompilerPass>,
  stageRank: ReadonlyMap<CompilerStageId, number>,
): readonly string[] {
  const incomingCount = new Map<string, number>(ids.map((id) => [id, 0] as const));

  for (const targets of edges.values()) {
    for (const target of targets) {
      incomingCount.set(target, (incomingCount.get(target) ?? 0) + 1);
    }
  }

  const ready = ids.filter((id) => incomingCount.get(id) === 0).sort((left, right) =>
    comparePassIds(left, right, passesById, stageRank),
  );
  const sorted: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift();

    if (!id) {
      continue;
    }

    sorted.push(id);

    for (const target of [...(edges.get(id) ?? [])].sort((left, right) =>
      comparePassIds(left, right, passesById, stageRank),
    )) {
      const nextCount = (incomingCount.get(target) ?? 0) - 1;
      incomingCount.set(target, nextCount);

      if (nextCount === 0) {
        ready.push(target);
        ready.sort((left, right) => comparePassIds(left, right, passesById, stageRank));
      }
    }
  }

  if (sorted.length !== ids.length) {
    const unresolved = ids.filter((id) => !sorted.includes(id)).sort();
    throw new Error(`Compiler pass dependency cycle: ${unresolved.join(", ")}`);
  }

  return sorted;
}

function comparePassIds(
  left: string,
  right: string,
  passesById: ReadonlyMap<string, CompilerPass>,
  stageRank: ReadonlyMap<CompilerStageId, number>,
): number {
  const leftPass = passesById.get(left);
  const rightPass = passesById.get(right);
  const leftStageRank = leftPass ? stageRank.get(leftPass.stage) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  const rightStageRank = rightPass ? stageRank.get(rightPass.stage) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;

  if (leftStageRank !== rightStageRank) {
    return leftStageRank - rightStageRank;
  }

  return left.localeCompare(right);
}
