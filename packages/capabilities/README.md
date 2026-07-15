# @0xsarwagya/ontoly-capabilities

## Responsibility

Deterministic software engineering capabilities over the Ontoly Software Graph.

This package owns high-level reasoning such as impact analysis, repository
summary, request tracing, ownership, configuration usage, and implementation
planning. It contains no compiler logic, parser logic, CLI behavior, MCP
transport, LLM calls, embeddings, vector search, or code generation.

`EvidencePack` is the compact graph-backed payload for agent workflows. It is a
capability over existing Ontoly artifacts, not a separate router package.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-capabilities
```

## API

- Default deterministic capability catalog.
- Capability execution contracts, confidence, evidence, diagnostics, and implementation planning results.
- High-level capabilities such as impact analysis, evidence packs, request tracing, and configuration usage.

## Example

```ts
import { createCapabilityRegistry, defaultCapabilities } from "@0xsarwagya/ontoly-capabilities";

const registry = createCapabilityRegistry(context, defaultCapabilities());
const result = await registry.execute("ImpactAnalysis", { target: "AuthService" });
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.1. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
