# Ontoly vs Graphify Validation Summary

Generated: 2026-07-15T11:19:25.842Z
Repositories analyzed: 5/5

## Totals

- Files analyzed: 13117
- Ontoly graph size: 30195 nodes, 68007 edges
- Graphify graph size: 0 nodes, 0 edges
- Average semantic coverage: 98.8
- Average trust score: 98.8
- Regression: PASS

## Benchmark Dashboard

| Repository | Framework | Files | Graphify | Ontoly | Trust | Coverage |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Ovok Core | Express, NestJS | 11601 | 0 nodes / 0 edges | 21686 nodes / 52365 edges | 98 | 99 |
| 0xsarwagya | Next.js, React, Turborepo | 555 | 0 nodes / 0 edges | 1191 nodes / 2087 edges | 96 | 95 |
| Innosphere | NestJS, React, Turborepo, Vite | 846 | 0 nodes / 0 edges | 6742 nodes / 12510 edges | 100 | 100 |
| Ghost | Vite | 59 | 0 nodes / 0 edges | 350 nodes / 661 edges | 100 | 100 |
| durable-local | Vite | 56 | 0 nodes / 0 edges | 226 nodes / 384 edges | 100 | 100 |

## Relationship Coverage

| Relationship | Ontoly Total | Graphify Total | Supported Repos |
| --- | ---: | ---: | ---: |
| CALLS | 7580 | 0 | 0 |
| IMPORTS | 11685 | 0 | 0 |
| EXPORTS | 4412 | 0 | 0 |
| CONTAINS | 25559 | 0 | 0 |
| HANDLES | 505 | 0 | 0 |
| MOUNTS | 502 | 0 | 0 |
| INJECTS | 1944 | 0 | 0 |
| READS | 243 | 0 | 0 |
| WRITES | 2 | 0 | 0 |
| USES | 3974 | 0 | 0 |
| DEPENDS_ON | 532 | 0 | 0 |
| AUTHORIZES | 255 | 0 | 0 |
| REGISTERED_IN | 652 | 0 | 0 |
| IMPLEMENTS | 126 | 0 | 0 |
| EXTENDS | 508 | 0 | 0 |
| REFERENCES | 870 | 0 | 0 |
| CREATES | 616 | 0 | 0 |
| THROWS | 551 | 0 | 0 |
| RETURNS | 1859 | 0 | 0 |
| PUBLISHES | 0 | 0 | 0 |
| SUBSCRIBES | 2 | 0 | 0 |

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
- Environment Variables: 5
- Functions: 5
- Interfaces: 5
- Modules: 5
- Packages: 5
- Classes: 4
- INJECTS: 4
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

