# @0xsarwagya/ontoly-intelligence

Deterministic intelligence APIs over Ontoly artifacts.

```ts
import { createIntelligence } from "@0xsarwagya/ontoly-intelligence";

const intelligence = createIntelligence(graph, { semanticIndex, semantics });
const evidence = intelligence.evidence("sleep duration thresholds");
```

The package consumes `SoftwareGraph`, `SemanticIndex`, and `Semantics`. It does not parse repositories, mutate graph output, call LLMs, generate embeddings, or use vector search.
