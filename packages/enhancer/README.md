# @0xsarwagya/ontoly-enhancer

Deterministic Enhancer API for Ontoly.

Enhancers are pure graph transformations. They consume immutable Ontoly artifacts
such as `SoftwareGraph` and `SemanticIndex`, then produce versioned artifacts such
as reports, diagrams, validation output, documentation, or SDK inputs.

Enhancers never parse repositories, mutate the Software Graph, or use AI.

Evidence routing is modeled as the `EvidencePack` artifact and `evidence-pack`
enhancer so agents, MCP, CLI, and Workbench can share the same deterministic
payload without introducing an `ontoly-router` package.

```ts
import {
  createEnhancerPipeline,
  createDefaultEnhancerContext,
  defineEnhancer,
} from "@0xsarwagya/ontoly-enhancer";
```

See `docs/enhancers.md` for the lifecycle, manifest format, caching model, and
CLI usage.
