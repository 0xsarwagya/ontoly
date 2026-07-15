# @0xsarwagya/ontoly-enhancer-semantics

Deterministic Ontoly enhancer that derives feature ownership, domain vocabulary, intent vocabulary, semantic neighborhoods, and a Graphify-style concept graph from an immutable Software Graph.

The enhancer never parses source files, never mutates `SoftwareGraph.json`, and never calls AI services.

```ts
import { createSemanticsEnhancer } from "@0xsarwagya/ontoly-enhancer-semantics";
```

The generated artifact is written by the CLI to:

```text
.ontoly/enhancers/artifacts/semantics.json
```
