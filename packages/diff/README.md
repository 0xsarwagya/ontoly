# @0xsarwagya/ontoly-diff

## Responsibility

`@0xsarwagya/ontoly-diff` owns deterministic diffing between two Software
Graphs. It computes added, removed, and modified nodes and added or
removed edges. It does not parse repositories, run capabilities, or
interpret changes semantically.

See RFC 0005 in [`rfcs/0005-graph-diffing.md`](../../rfcs/0005-graph-diffing.md)
for the full contract.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-diff
```

## API

- `diffSoftwareGraphs(base, head)` returns a `GraphDiff` describing
  added, removed, and modified nodes and added or removed edges.

## Example

```ts
import { diffSoftwareGraphs } from "@0xsarwagya/ontoly-diff";

const diff = diffSoftwareGraphs(baseGraph, headGraph);
console.log(diff.summary);
```

## Status

Alpha preview shipped in `1.1.0-alpha.2`. The API follows RFC 0005 and is
governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
