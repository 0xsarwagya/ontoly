# @0xsarwagya/ontoly-intelligence

## Responsibility

Deterministic intelligence APIs over Ontoly artifacts.

```ts
import { createIntelligence } from "@0xsarwagya/ontoly-intelligence";

const intelligence = createIntelligence(graph, { semanticIndex, semantics });
const evidence = intelligence.evidence("sleep duration thresholds");
```

The package consumes `SoftwareGraph`, `SemanticIndex`, and `Semantics`. It does not parse repositories, mutate graph output, call LLMs, generate embeddings, or use vector search.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-intelligence
```

## API

- `createIntelligence(graph, artifacts)` creates deterministic intelligence helpers.
- Query expansion, intent resolution, feature ownership, related-node lookup, and bounded evidence.

## Example

```ts
import { createIntelligence } from "@0xsarwagya/ontoly-intelligence";

const intelligence = createIntelligence(graph, { semanticIndex, semantics });
const evidence = intelligence.evidence("sleep duration thresholds");
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.3. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
