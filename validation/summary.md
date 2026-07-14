# Ontoly vs Graphify Validation Summary

Generated: 2026-07-14T20:18:05.550Z
Repositories analyzed: 5/5

## Totals

- Files analyzed: 13098
- Ontoly graph size: 30457 nodes, 63600 edges
- Graphify graph size: 0 nodes, 0 edges
- Average semantic coverage: 98.6
- Average trust score: 98.6
- Regression: PASS

## Benchmark Dashboard

| Repository | Framework | Files | Graphify | Ontoly | Trust | Coverage |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Ovok Core | Express, NestJS | 11574 | 0 nodes / 0 edges | 21696 nodes / 47725 edges | 98 | 98 |
| 0xsarwagya | Next.js, React, Turborepo | 537 | 0 nodes / 0 edges | 1204 nodes / 2095 edges | 95 | 95 |
| Innosphere | NestJS, React, Turborepo, Vite | 874 | 0 nodes / 0 edges | 6981 nodes / 12739 edges | 100 | 100 |
| Ghost | Vite | 58 | 0 nodes / 0 edges | 350 nodes / 657 edges | 100 | 100 |
| durable-local | Vite | 55 | 0 nodes / 0 edges | 226 nodes / 384 edges | 100 | 100 |

## Relationship Coverage

| Relationship | Ontoly Total | Graphify Total | Supported Repos |
| --- | ---: | ---: | ---: |
| CALLS | 4272 | 0 | 0 |
| IMPORTS | 11763 | 0 | 0 |
| EXPORTS | 4451 | 0 | 0 |
| CONTAINS | 25816 | 0 | 0 |
| HANDLES | 503 | 0 | 0 |
| MOUNTS | 500 | 0 | 0 |
| INJECTS | 1008 | 0 | 0 |
| READS | 239 | 0 | 0 |
| WRITES | 0 | 0 | 0 |
| USES | 4116 | 0 | 0 |
| DEPENDS_ON | 586 | 0 | 0 |
| AUTHORIZES | 255 | 0 | 0 |
| REGISTERED_IN | 650 | 0 | 0 |
| IMPLEMENTS | 126 | 0 | 0 |
| EXTENDS | 508 | 0 | 0 |
| REFERENCES | 870 | 0 | 0 |
| CREATES | 617 | 0 | 0 |
| THROWS | 552 | 0 | 0 |
| RETURNS | 1883 | 0 | 0 |
| PUBLISHES | 0 | 0 | 0 |
| SUBSCRIBES | 0 | 0 | 0 |

## Framework Coverage

| Framework | Repos | Ontoly Detected | Graphify Inferred | Avg Coverage |
| --- | ---: | ---: | ---: | ---: |
| Express | 1 | 1 | 0 | 60 |
| NestJS | 2 | 2 | 0 | 100 |
| Next.js | 1 | 1 | 0 | 10 |
| React | 2 | 2 | 0 | 10 |
| Turborepo | 2 | 0 | 0 | 97.5 |
| Vite | 3 | 0 | 0 | 100 |

## Top Strengths

- Configuration: 5
- Deterministic graph validation: 5
- Functions: 5
- Modules: 5
- Packages: 5
- Classes: 4
- Environment Variables: 4
- INJECTS: 4
- Interfaces: 4
- Methods: 3

## Top Weaknesses

- Graphify full semantic extraction: 5
- Graph validation warnings: 3
- Vite detection: 3
- Turborepo detection: 2

## Highest Priority Improvements

- High 0xsarwagya: 3 graph validation issue(s) with code SELF_RELATIONSHIP. Suggested fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- High Innosphere: 1 graph validation issue(s) with code PROVIDER_WITHOUT_CONSUMERS. Suggested fix: Improve provider consumer detection or mark intentionally public/root providers with explicit metadata.
- High Innosphere: 1 graph validation issue(s) with code SELF_RELATIONSHIP. Suggested fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- High Ovok Core: 11 graph validation issue(s) with code CONTROLLER_MISSING_MODULE. Suggested fix: Resolve framework module declarations and register controllers under their declaring module.
- High Ovok Core: 4 graph validation issue(s) with code DUPLICATE_CONTROLLER. Suggested fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- High Ovok Core: 69 graph validation issue(s) with code PROVIDER_WITHOUT_CONSUMERS. Suggested fix: Improve provider consumer detection or mark intentionally public/root providers with explicit metadata.
- Medium 0xsarwagya: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium 0xsarwagya: Turborepo was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Turborepo framework detector or map existing package evidence to a Framework node.
- Medium durable-local: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium durable-local: Vite was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Medium Ghost: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium Ghost: Vite was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Medium Innosphere: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium Innosphere: Turborepo was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Turborepo framework detector or map existing package evidence to a Framework node.
- Medium Innosphere: Vite was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Medium Ovok Core: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Regression

Status: PASS
- No failures.
- WARN: ovok-core: Ontoly analysis time increased by 76.67%.
- WARN: 0xsarwagya: Ontoly analysis time increased by 123.38%.
- WARN: innosphere: Ontoly analysis time increased by 62.83%.
- WARN: durable-local: Ontoly analysis time increased by 39.67%.
