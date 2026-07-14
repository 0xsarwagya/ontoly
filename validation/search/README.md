# Semantic Index Search Validation

This corpus validates deterministic intent resolution over Ontoly Software Graph
artifacts.

The corpus intentionally measures search quality rather than graph size. Every
question is a software-engineering phrase that should resolve to graph evidence
through `@0xsarwagya/ontoly-core`.

## Run

```bash
pnpm --filter @0xsarwagya/ontoly-core build
node validation/search/evaluate-search.mjs --graph .ontoly/SoftwareGraph.json
```

The evaluator writes `validation/search/reports/latest.json` with Top-1
accuracy, Top-5 accuracy, latency, and per-question results.
