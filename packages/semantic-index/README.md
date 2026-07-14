# @0xsarwagya/ontoly-semantic-index

Deterministic Semantic Index and intent resolution for Ontoly Software Graph
artifacts.

The package consumes `SoftwareGraph` JSON only. It does not parse source files,
call language models, create embeddings, or depend on the compiler, query
engine, MCP runtime, or capabilities package.

## API

```ts
import { createSemanticIndex, resolveIntent } from "@0xsarwagya/ontoly-semantic-index";

const index = createSemanticIndex(graph);
const result = resolveIntent(index, "sleep thresholds");
```

The result contains ranked graph candidates, matched concepts, explainable score
factors, and a recommended deterministic capability.
