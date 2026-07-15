# @0xsarwagya/ontoly-enhancer

## Responsibility

Deterministic Enhancer API for Ontoly.

Enhancers are pure graph transformations. They consume immutable Ontoly artifacts
such as `SoftwareGraph` and `SemanticIndex`, then produce versioned artifacts such
as reports, diagrams, validation output, documentation, or SDK inputs.

Enhancers never parse repositories, mutate the Software Graph, or use AI.

Evidence routing is modeled as the `EvidencePack` artifact and `evidence-pack`
enhancer so agents, MCP, CLI, and Workbench can share the same deterministic
payload without introducing an `ontoly-router` package.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

```ts
import {
  createEnhancerPipeline,
  createDefaultEnhancerContext,
  defineEnhancer,
} from "@0xsarwagya/ontoly-enhancer";
```

See `docs/enhancers.md` for the lifecycle, manifest format, caching model, and
CLI usage.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-enhancer
```

## API

- `defineEnhancer()` declares deterministic graph artifact transformations.
- `runEnhancerPipeline()` executes ordered enhancer DAGs.
- Artifact registry, cache contracts, manifests, validation issues, and test helpers.

## Example

```ts
import { defineEnhancer, runEnhancerPipeline } from "@0xsarwagya/ontoly-enhancer";

const enhancer = defineEnhancer({
  id: "example",
  name: "Example",
  version: "1.0.0",
  requires: [],
  produces: [],
  run: async () => ({ artifacts: [], diagnostics: [] }),
});

await runEnhancerPipeline({ enhancers: [enhancer], context });
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.1. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
