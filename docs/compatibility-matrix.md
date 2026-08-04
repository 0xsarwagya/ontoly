---
title: "Compatibility Matrix"
description: "Runtime, package, Software Graph, Agent Skill, MCP, CLI, and release compatibility for Ontoly v1.3.2."
---

## Runtime

| Surface | Version | Status |
| ------- | ------- | ------ |
| Ontoly packages | 1.3.2 | Stable |
| Node.js | ≥ 22 | Required |
| pnpm | ≥ 10 | Required for source builds |
| Package module format | ESM | Supported |
| TypeScript (dev) | 5.9 | Supported |

Ontoly requires Node.js 22 or newer. Node.js 20 was removed from the CI matrix
in v1.3.2 and is not supported.

## Languages

| Language | Runtime dependency | Extensions | Frontend package |
| -------- | ------------------ | ---------- | ---------------- |
| JavaScript | Node.js ≥ 22 (for Ontoly), any target runtime for the analyzed source | `.js`, `.jsx`, `.mjs`, `.cjs` | `@0xsarwagya/ontoly-semantic` |
| TypeScript | Node.js ≥ 22, TypeScript 5.x | `.ts`, `.tsx`, `.mts`, `.cts` | `@0xsarwagya/ontoly-semantic` |
| Python | No Python runtime needed to build the graph — Ontoly parses `.py` source directly | `.py` | `@0xsarwagya/ontoly-semantic-python` |
| Go | No Go toolchain needed to build the graph — Ontoly parses `.go` source directly | `.go` | `@0xsarwagya/ontoly-semantic-go` |

## Spec and interop

| Surface | Version | Status |
| ------- | ------- | ------ |
| Software Graph Spec | 1.0 draft | Supported |
| Agent Skills format | Vercel-style `SKILL.md` folders | Supported |
| MCP transport | JSON lines through CLI runtime | Stable |
| OpenAPI parser | 3.0 / 3.1 | Experimental |

## Package compatibility

All public packages are published under `@0xsarwagya/ontoly-*` and share
the same major version. Skill packages declare their minimum Ontoly version.

## Skill compatibility

Skills declare:

- Skill version
- Minimum Ontoly version
- Capability requirements

See [skills/COMPATIBILITY_MATRIX.md](../skills/COMPATIBILITY_MATRIX.md) for
the full skill-to-Ontoly compatibility table.

## Deprecations in v1.3.2

- Node.js 20 was removed from CI and is no longer supported.
- `createPlaceholderAnalyzer()` was removed — every framework analyzer now
  performs complete semantic extraction.
