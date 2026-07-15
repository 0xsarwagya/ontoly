# @0xsarwagya/ontoly-diagnostics

## Responsibility

`@0xsarwagya/ontoly-diagnostics` keeps diagnostic construction and diagnostic
shape wording consistent across packages. It does not execute compiler passes,
run analyzers, mutate graphs, or render reports.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-diagnostics
```

## API

- Diagnostic constructors shared across packages.
- Stable diagnostic severity, code, and provenance helpers.

## Example

```ts
import { createDiagnostic } from "@0xsarwagya/ontoly-diagnostics";

const diagnostic = createDiagnostic({
  severity: "warning",
  code: "EXAMPLE_WARNING",
  message: "Example graph warning.",
});
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.3. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
