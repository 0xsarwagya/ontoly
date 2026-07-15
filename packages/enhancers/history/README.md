# @0xsarwagya/ontoly-enhancer-history

## Responsibility

Deterministic Ontoly enhancer that derives repository history, ownership, hotspots, co-change relationships, churn, stability, and architectural drift from Git history and an immutable Software Graph.

The enhancer never parses source files, never mutates `SoftwareGraph.json`, and never calls AI services.

```ts
import { createHistoryEnhancer } from "@0xsarwagya/ontoly-enhancer-history";
```

Generated artifacts are written by the CLI to:

```text
.ontoly/enhancers/artifacts/history.json
.ontoly/enhancers/artifacts/ownership.json
.ontoly/enhancers/artifacts/hotspots.json
.ontoly/enhancers/artifacts/cochanges.json
.ontoly/enhancers/artifacts/drift.json
```

## Installation

```bash
pnpm add @0xsarwagya/ontoly-enhancer-history
```

## API

- `createHistoryEnhancer()` creates the official History enhancer.
- `createHistoryArtifact()` derives deterministic temporal intelligence from graph nodes and Git events.
- `collectGitHistory()` reads Git history using `git log --numstat`.
- `validateHistoryArtifact()` verifies artifact compatibility with a graph.

## Example

```ts
import { createHistoryEnhancer } from "@0xsarwagya/ontoly-enhancer-history";

const history = createHistoryEnhancer();
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.2. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
