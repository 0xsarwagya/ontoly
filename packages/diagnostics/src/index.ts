import {
  createDiagnosticId,
  type DiagnosticSeverity,
  type JsonObject,
  type SoftwareGraphDiagnostic,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";

export interface CreateDiagnosticInput {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly nodeId?: string | undefined;
  readonly edgeId?: string | undefined;
  readonly span?: SourceSpan | undefined;
  readonly metadata?: JsonObject | undefined;
}

export function createDiagnostic(input: CreateDiagnosticInput): SoftwareGraphDiagnostic {
  const location = input.span
    ? `${input.span.file}:${input.span.startLine}:${input.span.startColumn}`
    : input.nodeId ?? input.edgeId ?? "";

  const base: SoftwareGraphDiagnostic = {
    id: createDiagnosticId(input.code, input.message, location),
    code: input.code,
    severity: input.severity,
    message: input.message,
  };

  return withOptionalDiagnosticProperties(base, {
    nodeId: input.nodeId,
    edgeId: input.edgeId,
    span: input.span,
    metadata: input.metadata,
  });
}

export function brokenImportDiagnostic(file: string, specifier: string): SoftwareGraphDiagnostic {
  return createDiagnostic({
    code: "BROKEN_IMPORT",
    severity: "warning",
    message: `Could not resolve import "${specifier}" from ${file}.`,
    metadata: { file, specifier },
  });
}

export function circularImportDiagnostic(path: readonly string[]): SoftwareGraphDiagnostic {
  return createDiagnostic({
    code: "CIRCULAR_IMPORT",
    severity: "warning",
    message: `Circular import detected: ${path.join(" -> ")}.`,
    metadata: { path: [...path] },
  });
}

export function lowConfidenceDiagnostic(
  message: string,
  metadata?: JsonObject,
): SoftwareGraphDiagnostic {
  return createDiagnostic({
    code: "LOW_CONFIDENCE_INFERENCE",
    severity: "info",
    message,
    metadata,
  });
}

function withOptionalDiagnosticProperties(
  target: SoftwareGraphDiagnostic,
  optional: Omit<SoftwareGraphDiagnostic, "id" | "code" | "severity" | "message">,
): SoftwareGraphDiagnostic {
  return {
    ...target,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as SoftwareGraphDiagnostic;
}
