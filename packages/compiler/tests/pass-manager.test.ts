import { describe, expect, it } from "vitest";
import { createNoopPass, orderPasses } from "../src/index";

describe("pass manager", () => {
  it("orders passes by declared dependencies and stage order", () => {
    const first = createNoopPass({ id: "example:first", stage: "frontend-planning" });
    const second = {
      ...createNoopPass({ id: "example:second", stage: "core-compiler-passes" }),
      requires: ["example:first"],
    };
    const third = {
      ...createNoopPass({ id: "example:third", stage: "core-compiler-passes" }),
      after: ["example:second"],
    };

    expect(orderPasses([third, second, first]).map((pass) => pass.id)).toEqual([
      "example:first",
      "example:second",
      "example:third",
    ]);
  });

  it("rejects dependency cycles", () => {
    const left = {
      ...createNoopPass({ id: "example:left", stage: "core-compiler-passes" }),
      after: ["example:right"],
    };
    const right = {
      ...createNoopPass({ id: "example:right", stage: "core-compiler-passes" }),
      after: ["example:left"],
    };

    expect(() => orderPasses([left, right])).toThrow(/cycle/);
  });
});
