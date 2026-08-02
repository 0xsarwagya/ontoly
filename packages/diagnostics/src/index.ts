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

export function unusedExportDiagnostic(
  file: string,
  exportName: string,
  nodeId?: string,
  span?: SourceSpan,
): SoftwareGraphDiagnostic {
  return createDiagnostic({
    code: "UNUSED_EXPORT",
    severity: "warning",
    message: `Export "${exportName}" in ${file} is not imported by any other module in the graph. Consider removing it or marking it as internal.`,
    nodeId,
    span,
    metadata: { file, exportName },
  });
}

export function largeModuleDiagnostic(
  file: string,
  lineCount: number,
  threshold: number,
  nodeId?: string,
): SoftwareGraphDiagnostic {
  return createDiagnostic({
    code: "LARGE_MODULE",
    severity: "info",
    message: `Module ${file} has ${lineCount} lines (threshold: ${threshold}). Large modules increase cognitive load — consider splitting into smaller, focused modules.`,
    nodeId,
    metadata: { file, lineCount, threshold },
  });
}

export function deepNestingDiagnostic(
  file: string,
  depth: number,
  maxDepth: number,
  nodeId?: string,
  span?: SourceSpan,
): SoftwareGraphDiagnostic {
  return createDiagnostic({
    code: "DEEP_NESTING",
    severity: "warning",
    message: `Detected nesting depth of ${depth} in ${file} (max recommended: ${maxDepth}). Consider extracting nested logic into separate functions.`,
    nodeId,
    span,
    metadata: { file, depth, maxDepth },
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
