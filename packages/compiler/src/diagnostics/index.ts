import type { JsonObject, SoftwareGraphDiagnostic, SourceSpan } from "@0xsarwagya/ontoly-core";
import { createDiagnostic } from "@0xsarwagya/ontoly-diagnostics";
import type { DiagnosticSink } from "../types";

export function createDiagnosticSink(): DiagnosticSink {
  const diagnostics = new Map<string, SoftwareGraphDiagnostic>();

  return {
    add: (diagnostic) => {
      diagnostics.set(diagnostic.id, diagnostic);
      return diagnostic;
    },
    list: () => [...diagnostics.values()].sort((left, right) => left.id.localeCompare(right.id)),
    hasErrors: () => [...diagnostics.values()].some((diagnostic) => diagnostic.severity === "error"),
  };
}

export function compilerDiagnostic(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "info" | "warning" | "error" | undefined;
  readonly nodeId?: string | undefined;
  readonly edgeId?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}): SoftwareGraphDiagnostic {
  return createDiagnostic({
    code: input.code,
    severity: input.severity ?? "warning",
    message: input.message,
    nodeId: input.nodeId,
    edgeId: input.edgeId,
    span: input.span,
    metadata: input.metadata,
  });
}
