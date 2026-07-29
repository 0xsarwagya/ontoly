# RFC 0005: Graph Diffing

## Status

Draft

## Spec Version

Software Graph Spec 1.0 (consumer)

## Summary

This RFC defines deterministic diffing between two Software Graphs. It
introduces `@0xsarwagya/ontoly-diff`, a small consumer package that
computes added, removed, and modified nodes and added or removed edges
between a base graph and a head graph.

Graph diffing is the primitive that downstream products need to answer
"what changed between commit A and commit B" over deterministic graph
facts rather than raw source text.

## Normative Language

The words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used
as defined by RFC 2119.

## Motivation

Ontoly builds deterministic Software Graphs from a single repository
state. Consumers that want to describe change over time — pull request
review, release notes, drift analysis, agent verification — need a
stable operation over two graphs, not two source trees.

Doing this in every downstream tool separately would fragment semantics.
A rename, a moved file, or a re-ordered node list would produce different
"changes" depending on the consumer. Diffing belongs beside the graph
itself so every consumer agrees on what changed.

## Non-Goals

Graph diffing v1 does not define:

- Rename detection. A symbol renamed within a file MUST be reported as
  one removed node and one added node in this version.
- Move detection. A symbol moved between files MUST be reported as one
  removed node and one added node in this version.
- Diagnostic diffing. Diagnostics MAY change across builds for reasons
  unrelated to source changes and are excluded from diff output in this
  version.
- Semantic interpretation. Diff output MUST NOT include natural-language
  explanations, business-logic labels, or feature attribution. Those are
  the responsibility of downstream consumers.
- Diff-over-a-commit-range. The API accepts exactly two graphs.
- Storage of diff artifacts.

Future RFCs MAY extend this contract with rename detection, move
detection, or higher-level semantic diffing.

## Proposal

### Package

A new package `@0xsarwagya/ontoly-diff` is added to the workspace. It
depends only on `@0xsarwagya/ontoly-core` and exposes one entry point.

### Public API

```ts
export function diffSoftwareGraphs(
  base: SoftwareGraph,
  head: SoftwareGraph,
): GraphDiff;

export interface GraphDiff {
  readonly baseHash: string;
  readonly headHash: string;
  readonly generatedAt: string;
  readonly addedNodes: readonly SoftwareGraphNode[];
  readonly removedNodes: readonly SoftwareGraphNode[];
  readonly modifiedNodes: readonly ModifiedNode[];
  readonly addedEdges: readonly SoftwareGraphEdge[];
  readonly removedEdges: readonly SoftwareGraphEdge[];
  readonly summary: GraphDiffSummary;
}

export interface ModifiedNode {
  readonly id: string;
  readonly before: SoftwareGraphNode;
  readonly after: SoftwareGraphNode;
  readonly changedFields: readonly ModifiedNodeField[];
}

export type ModifiedNodeField =
  | "type"
  | "name"
  | "file"
  | "package"
  | "span"
  | "metadata";

export interface GraphDiffSummary {
  readonly addedNodeCount: number;
  readonly removedNodeCount: number;
  readonly modifiedNodeCount: number;
  readonly addedEdgeCount: number;
  readonly removedEdgeCount: number;
  readonly unchangedNodeCount: number;
  readonly unchangedEdgeCount: number;
}
```

### Identity

Node identity MUST be the `id` field defined by RFC 0001. Two nodes with
the same `id` MUST be treated as the same entity across the two graphs.

Edge identity MUST be the `id` field defined by RFC 0001. Because edge
IDs derive deterministically from `(type, from, to)`, edges whose triple
changes produce distinct IDs and MUST be reported as one removed edge
and one added edge.

### Modified Node Detection

A node is `modified` when both graphs contain a node with the same `id`
and any of the fields listed in `ModifiedNodeField` differ between them.
The `changedFields` array MUST list every field that differs, ordered
lexicographically.

Field comparison MUST use the stable-stringify semantics defined by
`stableStringify` in `@0xsarwagya/ontoly-core`.

Nodes with matching `id` and identical serialized content MUST NOT
appear in `modifiedNodes`.

### Ordering

All arrays in `GraphDiff` MUST be sorted deterministically:

- `addedNodes`, `removedNodes`: by `id`, ascending.
- `modifiedNodes`: by `id`, ascending.
- `addedEdges`, `removedEdges`: by `id`, ascending.
- `changedFields` inside a `ModifiedNode`: lexicographic, ascending.

### Base and Head Hashes

`baseHash` and `headHash` MUST be copied from
`SoftwareGraph.metadata.deterministicHash` on the respective input
graphs. Consumers use these to verify that a diff artifact was
generated from a specific graph pair.

### CLI

The Ontoly CLI gains one command:

```bash
ontoly diff <base-graph.json> <head-graph.json> [--json]
```

The command MUST read both files as JSON, validate that they conform
to the `SoftwareGraph` shape, compute the diff, and print either a
human summary (default) or the full `GraphDiff` JSON (`--json`).

## Determinism

Given two graphs with identical `deterministicHash`, `diffSoftwareGraphs`
MUST produce an empty diff (zero added, removed, or modified entries).

Given two distinct graphs, `diffSoftwareGraphs` MUST produce the same
`GraphDiff` on every invocation regardless of platform, Node.js version,
or wall-clock time. The `generatedAt` field is the only non-deterministic
field and is excluded from equality comparisons in tests.

## Compatibility

`@0xsarwagya/ontoly-diff` is additive. No existing package types, exports,
or behaviors change. Consumers that do not import the new package are
unaffected.

The new package ships at the same version as the rest of the workspace
starting at `1.1.0-alpha.2`.

## Alternatives

**Fold diffing into `@0xsarwagya/ontoly-query`.** Considered and rejected.
Query operates on a single graph and diffing is an operation over two.
Mixing them widens the query package's responsibility and forces
consumers who only need diffing to pull in traversal, indexes, and
statistics they will not use.

**Diff at the source-file level and derive graph deltas from that.**
Rejected. Source-level diffing loses semantic meaning: a symbol moved
between files, or a whitespace-preserving rewrite, produces noisy
source diffs but zero or trivial graph diffs. Consumers of Ontoly want
the graph-level answer.

**Include rename and move detection in this RFC.** Rejected for v1.
Rename and move detection require fuzzy matching heuristics with
tunable thresholds. Including them here would weaken the determinism
guarantee. A future RFC will define them as an opt-in layer over this
primitive.

## Open Questions

- Should modified-edge detection (same triple, different evidence or
  metadata) be added in this RFC or deferred? Current answer: defer.
  Edge evidence changes are rare relative to edge identity changes and
  can be added without breaking this contract.
- Should the diff include repository metadata changes (root, name,
  packageManager)? Current answer: no. Repository-level metadata is
  orthogonal to graph structure and can be compared by consumers using
  the raw `SoftwareGraph.repository` field.
- Should `generatedAt` be optional or omitted entirely to strengthen
  reproducibility? Current answer: keep it, but exclude from diff
  equality semantics.
