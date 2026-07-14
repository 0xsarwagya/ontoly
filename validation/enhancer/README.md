# Enhancer Validation

This directory is the validation home for Ontoly Enhancers.

Current checks are covered by package tests and CLI validation:

```sh
pnpm --filter @0xsarwagya/ontoly-enhancer test
pnpm ontoly enhancer validate --ci
pnpm ontoly enhancer graph --format json
```

Future validation entries should add:

- fixture Software Graphs
- golden artifact snapshots
- deterministic pipeline snapshots
- incremental cache snapshots
- performance measurements

Enhancer validation must never require reparsing repositories. It should consume
Software Graph fixtures and existing Ontoly artifacts only.
