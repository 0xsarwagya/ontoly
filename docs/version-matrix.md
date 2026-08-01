# Version Matrix

Current release: **v1.2.0**.

## Ontoly packages

| Component | Package | Version |
| --------- | ------- | ------- |
| Core | `@0xsarwagya/ontoly-core` | 1.2.0 |
| Compiler | `@0xsarwagya/ontoly-compiler` | 1.2.0 |
| CLI | `@0xsarwagya/ontoly-cli` | 1.2.0 |
| Query Engine | `@0xsarwagya/ontoly-query` | 1.2.0 |
| Capabilities | `@0xsarwagya/ontoly-capabilities` | 1.2.0 |
| Intelligence | `@0xsarwagya/ontoly-intelligence` | 1.2.0 |
| Cache | `@0xsarwagya/ontoly-cache` | 1.2.0 |
| Diff | `@0xsarwagya/ontoly-diff` | 1.2.0 |
| Diagnostics | `@0xsarwagya/ontoly-diagnostics` | 1.2.0 |
| Analyzers | `@0xsarwagya/ontoly-analyzers` | 1.2.0 |
| MCP runtime | `@0xsarwagya/ontoly-mcp` | 1.2.0 |
| Enhancer API | `@0xsarwagya/ontoly-enhancer` | 1.2.0 |
| Semantics enhancer | `@0xsarwagya/ontoly-enhancer-semantics` | 1.2.0 |
| History enhancer | `@0xsarwagya/ontoly-enhancer-history` | 1.2.0 |

## Language frontends

| Language | Parser package | Semantic package | Framework analyzers |
| -------- | -------------- | ---------------- | ------------------- |
| TypeScript | `@0xsarwagya/ontoly-parser-typescript` 1.2.0 | `@0xsarwagya/ontoly-typescript` 1.2.0, `@0xsarwagya/ontoly-semantic` 1.2.0 | 17 |
| Python | `@0xsarwagya/ontoly-parser-python` 1.2.0 | `@0xsarwagya/ontoly-python` 1.2.0, `@0xsarwagya/ontoly-semantic-python` 1.2.0 | 6 |
| Go | `@0xsarwagya/ontoly-parser-go` 1.2.0 | `@0xsarwagya/ontoly-go` 1.2.0, `@0xsarwagya/ontoly-semantic-go` 1.2.0 | 6 |
| OpenAPI (experimental) | `@0xsarwagya/ontoly-parser-openapi` 1.2.0 | — | — |

## Plugins

| Plugin | Package | Version |
| ------ | ------- | ------- |
| HTML graph | `@0xsarwagya/ontoly-plugin-html` | 1.2.0 |
| Mermaid | `@0xsarwagya/ontoly-plugin-mermaid` | 1.2.0 |

## Specs and runtimes

| Component | Version |
| --------- | ------- |
| Software Graph Spec | 1.0 draft |
| Agent Skills catalog | 1.2.0 |
| Node.js engine | ≥ 22 |
| pnpm engine | ≥ 10 |
| TypeScript (dev) | 5.9 |

The Software Graph version is negotiated independently from Ontoly package
versions. See the [Compatibility Matrix](compatibility-matrix.md) for spec
and runtime compatibility.
