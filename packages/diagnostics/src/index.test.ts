import { describe, it, expect } from "vitest";
import {
  createDiagnostic,
  brokenImportDiagnostic,
  circularImportDiagnostic,
  lowConfidenceDiagnostic,
  unusedExportDiagnostic,
  largeModuleDiagnostic,
  deepNestingDiagnostic,
} from "./index";

describe("createDiagnostic", () => {
  it("creates a diagnostic with required fields", () => {
    const d = createDiagnostic({
      code: "TEST_CODE",
      severity: "error",
      message: "Something went wrong",
    });
    expect(d.code).toBe("TEST_CODE");
    expect(d.severity).toBe("error");
    expect(d.message).toBe("Something went wrong");
    expect(d.id).toBeTruthy();
  });

  it("includes optional nodeId when provided", () => {
    const d = createDiagnostic({
      code: "TEST",
      severity: "warning",
      message: "Test",
      nodeId: "node-123",
    });
    expect(d.nodeId).toBe("node-123");
  });
});

describe("brokenImportDiagnostic", () => {
  it("creates a warning for unresolved imports", () => {
    const d = brokenImportDiagnostic("src/app.ts", "./missing");
    expect(d.code).toBe("BROKEN_IMPORT");
    expect(d.severity).toBe("warning");
    expect(d.message).toContain("./missing");
    expect(d.message).toContain("src/app.ts");
  });
});

describe("circularImportDiagnostic", () => {
  it("creates a warning with the circular path", () => {
    const d = circularImportDiagnostic(["a.ts", "b.ts", "a.ts"]);
    expect(d.code).toBe("CIRCULAR_IMPORT");
    expect(d.severity).toBe("warning");
    expect(d.message).toContain("a.ts -> b.ts -> a.ts");
  });
});

describe("lowConfidenceDiagnostic", () => {
  it("creates an info diagnostic", () => {
    const d = lowConfidenceDiagnostic("Could not determine type");
    expect(d.code).toBe("LOW_CONFIDENCE_INFERENCE");
    expect(d.severity).toBe("info");
  });
});

describe("unusedExportDiagnostic", () => {
  it("creates a warning for unused exports", () => {
    const d = unusedExportDiagnostic("src/utils.ts", "parseConfig");
    expect(d.code).toBe("UNUSED_EXPORT");
    expect(d.severity).toBe("warning");
    expect(d.message).toContain("parseConfig");
    expect(d.message).toContain("src/utils.ts");
    expect(d.message).toContain("internal");
  });
});

describe("largeModuleDiagnostic", () => {
  it("creates an info diagnostic for large files", () => {
    const d = largeModuleDiagnostic("src/monolith.ts", 800, 500);
    expect(d.code).toBe("LARGE_MODULE");
    expect(d.severity).toBe("info");
    expect(d.message).toContain("800");
    expect(d.message).toContain("500");
  });
});

describe("deepNestingDiagnostic", () => {
  it("creates a warning for deep nesting", () => {
    const d = deepNestingDiagnostic("src/parser.ts", 8, 5);
    expect(d.code).toBe("DEEP_NESTING");
    expect(d.severity).toBe("warning");
    expect(d.message).toContain("8");
    expect(d.message).toContain("5");
    expect(d.message).toContain("extracting");
  });
});
