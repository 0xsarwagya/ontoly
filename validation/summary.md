# Ontoly vs Graphify Validation Summary

Generated: 2026-07-13T12:13:41.318Z
Repositories analyzed: 5/5

## Totals

- Files analyzed: 12812
- Ontoly graph size: 30218 nodes, 62521 edges
- Graphify graph size: 33071 nodes, 69834 edges
- Average semantic coverage: 98.6
- Average trust score: 98.6
- Regression: PASS

## Benchmark Dashboard

| Repository | Framework | Files | Graphify | Ontoly | Trust | Coverage |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Ovok Core | Express, NestJS | 11407 | 27444 nodes / 57572 edges | 21696 nodes / 47312 edges | 98 | 98 |
| 0xsarwagya | Next.js, React, Turborepo | 446 | 1071 nodes / 1811 edges | 1202 nodes / 2082 edges | 95 | 95 |
| Innosphere | NestJS, React, Turborepo, Vite | 846 | 4178 nodes / 9594 edges | 6744 nodes / 12091 edges | 100 | 100 |
| Ghost | Vite | 58 | 211 nodes / 553 edges | 350 nodes / 655 edges | 100 | 100 |
| durable-local | Vite | 55 | 167 nodes / 304 edges | 226 nodes / 381 edges | 100 | 100 |

## Relationship Coverage

| Relationship | Ontoly Total | Graphify Total | Supported Repos |
| --- | ---: | ---: | ---: |
| CALLS | 3613 | 5838 | 5 |
| IMPORTS | 11730 | 11790 | 5 |
| EXPORTS | 4410 | 0 | 0 |
| CONTAINS | 25605 | 25599 | 5 |
| HANDLES | 499 | 0 | 0 |
| MOUNTS | 496 | 0 | 0 |
| INJECTS | 1007 | 0 | 0 |
| READS | 236 | 0 | 0 |
| WRITES | 0 | 0 | 0 |
| USES | 4060 | 0 | 0 |
| DEPENDS_ON | 586 | 0 | 0 |
| AUTHORIZES | 254 | 0 | 0 |
| REGISTERED_IN | 645 | 0 | 0 |
| IMPLEMENTS | 126 | 64 | 2 |
| EXTENDS | 508 | 259 | 3 |
| REFERENCES | 864 | 2888 | 2 |
| CREATES | 617 | 0 | 0 |
| THROWS | 549 | 0 | 0 |
| RETURNS | 1862 | 0 | 0 |
| PUBLISHES | 0 | 0 | 0 |
| SUBSCRIBES | 0 | 0 | 0 |

## Framework Coverage

| Framework | Repos | Ontoly Detected | Graphify Inferred | Avg Coverage |
| --- | ---: | ---: | ---: | ---: |
| Express | 1 | 1 | 1 | 60 |
| NestJS | 2 | 2 | 2 | 100 |
| Next.js | 1 | 1 | 1 | 10 |
| React | 2 | 2 | 2 | 10 |
| Turborepo | 2 | 0 | 2 | 97.5 |
| Vite | 3 | 0 | 0 | 100 |

## Top Strengths

- Deterministic graph validation: 5
- Packages: 5
- INJECTS: 4
- AUTHORIZES: 2
- HANDLES: 2
- MOUNTS: 2
- REGISTERED_IN: 2
- Routes: 2
- Environment Variables: 1
- Interfaces: 1

## Top Weaknesses

- Graphify full semantic extraction: 5
- Graph validation warnings: 3
- Vite detection: 3
- EXTENDS: 2
- REFERENCES: 2
- Turborepo detection: 2
- Classes: 1
- Environment Variables: 1
- Interfaces: 1
- Methods: 1

## Highest Priority Improvements

- High 0xsarwagya: 3 graph validation issue(s) with code SELF_RELATIONSHIP. Suggested fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- High Innosphere: 1 graph validation issue(s) with code PROVIDER_WITHOUT_CONSUMERS. Suggested fix: Improve provider consumer detection or mark intentionally public/root providers with explicit metadata.
- High Innosphere: 1 graph validation issue(s) with code SELF_RELATIONSHIP. Suggested fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- High Ovok Core: 11 graph validation issue(s) with code CONTROLLER_MISSING_MODULE. Suggested fix: Resolve framework module declarations and register controllers under their declaring module.
- High Ovok Core: 4 graph validation issue(s) with code DUPLICATE_CONTROLLER. Suggested fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- High Ovok Core: 69 graph validation issue(s) with code PROVIDER_WITHOUT_CONSUMERS. Suggested fix: Improve provider consumer detection or mark intentionally public/root providers with explicit metadata.
- Medium 0xsarwagya: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium 0xsarwagya: Ontoly did not emit EXTENDS, while Graphify emitted 55. Suggested fix: Add or extend relationship extraction for EXTENDS and cover it with deterministic snapshots.
- Medium 0xsarwagya: Turborepo was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Turborepo framework detector or map existing package evidence to a Framework node.
- Medium durable-local: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium durable-local: Ontoly did not emit REFERENCES, while Graphify emitted 4. Suggested fix: Add or extend relationship extraction for REFERENCES and cover it with deterministic snapshots.
- Medium durable-local: Vite was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Medium Ghost: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium Ghost: Ontoly did not emit EXTENDS, while Graphify emitted 20. Suggested fix: Add or extend relationship extraction for EXTENDS and cover it with deterministic snapshots.
- Medium Ghost: Ontoly did not emit REFERENCES, while Graphify emitted 10. Suggested fix: Add or extend relationship extraction for REFERENCES and cover it with deterministic snapshots.
- Medium Ghost: Vite was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Medium Innosphere: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.
- Medium Innosphere: Turborepo was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Turborepo framework detector or map existing package evidence to a Framework node.
- Medium Innosphere: Vite was inferred from repository metadata but not detected by Ontoly. Suggested fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Medium Ovok Core: Graphify full semantic extraction was unavailable without an LLM backend. Suggested fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Regression

Status: PASS
- No failures.
- WARN: No previous baseline existed. Current results were written as regression-baseline.json.
