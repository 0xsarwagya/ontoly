# @0xsarwagya/ontoly-enhancer-semantics

## Responsibility

Deterministic Ontoly enhancer that derives feature ownership, domain vocabulary, intent vocabulary, semantic neighborhoods, and a Graphify-style concept graph from an immutable Software Graph.

The enhancer never parses source files, never mutates `SoftwareGraph.json`, and never calls AI services.

```ts
import { createSemanticsEnhancer } from "@0xsarwagya/ontoly-enhancer-semantics";
```

The generated artifact is written by the CLI to:

```text
.ontoly/enhancers/artifacts/semantics.json
```

## Installation

```bash
pnpm add @0xsarwagya/ontoly-enhancer-semantics
```

## API

- `createSemanticsEnhancer()` creates the official Semantics enhancer.
- Semantics artifact types for feature ownership, vocabulary, confidence, neighborhoods, and concept graphs.
- `validateSemanticsArtifact()` verifies artifact compatibility with a graph.

## Example

```ts
import { createSemanticsEnhancer } from "@0xsarwagya/ontoly-enhancer-semantics";

const semantics = createSemanticsEnhancer();
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.2. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
