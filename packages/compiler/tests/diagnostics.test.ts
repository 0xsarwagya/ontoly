import { describe, expect, it } from "vitest";
import { compilerDiagnostic, createDiagnosticSink } from "../src/index";

describe("compiler diagnostics", () => {
  it("deduplicates diagnostics by stable id", () => {
    const sink = createDiagnosticSink();
    const diagnostic = compilerDiagnostic({
      code: "TEST_DIAGNOSTIC",
      message: "The same diagnostic.",
    });

    sink.add(diagnostic);
    sink.add(diagnostic);

    expect(sink.list()).toEqual([diagnostic]);
    expect(sink.hasErrors()).toBe(false);
  });
});
