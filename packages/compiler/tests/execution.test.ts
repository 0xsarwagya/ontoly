import { describe, expect, it } from "vitest";
import { normalizeCompilerWorkerCount, runDeterministicTasks } from "../src/index";

describe("deterministic compiler task pool", () => {
  it("preserves input order when tasks complete out of order", async () => {
    const completions: number[] = [];
    const results = await runDeterministicTasks(
      [30, 5, 15],
      async (delay, index) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        completions.push(index);
        return `result-${index}`;
      },
      3,
    );

    expect(completions).not.toEqual([0, 1, 2]);
    expect(results).toEqual(["result-0", "result-1", "result-2"]);
  });

  it("bounds invalid worker counts", () => {
    expect(normalizeCompilerWorkerCount(0)).toBe(1);
    expect(normalizeCompilerWorkerCount(10_000)).toBe(32);
  });
});
