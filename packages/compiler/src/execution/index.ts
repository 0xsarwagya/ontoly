import { availableParallelism } from "node:os";

const MAX_COMPILER_WORKERS = 32;

export function defaultCompilerWorkerCount(): number {
  return Math.max(1, Math.min(8, availableParallelism()));
}

export function normalizeCompilerWorkerCount(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return defaultCompilerWorkerCount();
  }
  return Math.max(1, Math.min(MAX_COMPILER_WORKERS, Math.floor(value)));
}

/** Runs independent tasks concurrently while preserving input order. */
export async function runDeterministicTasks<Input, Output>(
  inputs: readonly Input[],
  run: (input: Input, index: number) => Promise<Output> | Output,
  concurrency = defaultCompilerWorkerCount(),
): Promise<readonly Output[]> {
  if (inputs.length === 0) {
    return [];
  }

  const results = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const workerCount = Math.min(normalizeCompilerWorkerCount(concurrency), inputs.length);

  const worker = async (): Promise<void> => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await run(inputs[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
