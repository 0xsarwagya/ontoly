# Repository History Validation

This directory defines deterministic repository-evolution questions for the
History enhancer and temporal intelligence APIs.

The corpus validates that Ontoly can answer:

- who owns a node
- which nodes are hotspots
- which files evolve together
- what changed most recently
- which services are unstable
- which features are drifting

The expected answers are graph-backed and Git-backed. They do not depend on
LLMs, embeddings, vector search, or source reparsing.
