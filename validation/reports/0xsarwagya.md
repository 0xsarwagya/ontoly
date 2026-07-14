# 0xsarwagya Comparison

## Repository Summary

- Requested path: /Users/shrey/Desktop/personal/0xsarwagya
- Actual path: /Users/shrey/Desktop/personal/0xsarwagya
- Files: 537
- Source files: 191
- Packages: 10
- Frameworks: Next.js, React, Turborepo

## Graph Statistics

| Tool | Nodes | Edges | Diagnostics | Hash |
| --- | ---: | ---: | ---: | --- |
| Ontoly | 1204 | 2095 | 13 | 0y006e0 |
| Graphify | 0 | 0 | 0 | e36634175223f5b2f5abd7582c60155c47fc3947ec8ae82165c8dcbe7d7ae4b2 |

## Semantic Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| Functions | 206 | 0 | 206 | graphify_missing | not measured |
| Methods | 0 | 0 | 0 | not_observed | not measured |
| Classes | 0 | 0 | 0 | not_observed | not measured |
| Interfaces | 0 | 0 | 0 | not_observed | not measured |
| Routes | 0 | 0 | 0 | not_observed | not measured |
| Controllers | 0 | 0 | 0 | not_observed | not measured |
| Modules | 140 | 0 | 140 | graphify_missing | not measured |
| Services | 0 | 0 | 0 | not_observed | not measured |
| Providers | 0 | 0 | 0 | not_observed | not measured |
| Repositories | 0 | 0 | 0 | not_observed | not measured |
| Packages | 29 | 0 | 29 | graphify_missing | not measured |
| Configuration | 44 | 0 | 44 | graphify_missing | not measured |
| Environment Variables | 0 | 0 | 0 | not_observed | not measured |

## Relationship Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| CALLS | 211 | 0 | 211 | graphify_missing | not measured |
| IMPORTS | 300 | 0 | 300 | graphify_missing | not measured |
| EXPORTS | 187 | 0 | 187 | graphify_missing | not measured |
| CONTAINS | 953 | 0 | 953 | graphify_missing | not measured |
| HANDLES | 0 | 0 | 0 | not_observed | not measured |
| MOUNTS | 0 | 0 | 0 | not_observed | not measured |
| INJECTS | 0 | 0 | 0 | not_observed | not measured |
| READS | 0 | 0 | 0 | not_observed | not measured |
| WRITES | 0 | 0 | 0 | not_observed | not measured |
| USES | 155 | 0 | 155 | graphify_missing | not measured |
| DEPENDS_ON | 156 | 0 | 156 | graphify_missing | not measured |
| AUTHORIZES | 0 | 0 | 0 | not_observed | not measured |
| REGISTERED_IN | 0 | 0 | 0 | not_observed | not measured |
| IMPLEMENTS | 0 | 0 | 0 | not_observed | not measured |
| EXTENDS | 0 | 0 | 0 | not_observed | not measured |
| REFERENCES | 0 | 0 | 0 | not_observed | not measured |
| CREATES | 4 | 0 | 4 | graphify_missing | not measured |
| THROWS | 2 | 0 | 2 | graphify_missing | not measured |
| RETURNS | 53 | 0 | 53 | graphify_missing | not measured |
| PUBLISHES | 0 | 0 | 0 | not_observed | not measured |
| SUBSCRIBES | 0 | 0 | 0 | not_observed | not measured |

## Framework Understanding

| Framework | Ontoly Detected | Graphify Inferred | Coverage | Confidence | Missing Concepts | Relationship Gaps |
| --- | --- | --- | ---: | --- | --- | --- |
| Next.js | yes | no | 10 | exact | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, INJECTS, AUTHORIZES, REGISTERED_IN |
| React | yes | no | 10 | exact | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, INJECTS, AUTHORIZES, REGISTERED_IN |
| Turborepo | no | no | 95 | n/a | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, INJECTS, AUTHORIZES, REGISTERED_IN |

## Performance

| Tool | Cold Analysis | Peak Memory | Graph Hash |
| --- | ---: | ---: | --- |
| Ontoly | 11227.14ms | 1.7 GB | 0y006e0 |
| Graphify | 389.47ms | 40.5 MB | e36634175223f5b2f5abd7582c60155c47fc3947ec8ae82165c8dcbe7d7ae4b2 |

## Diagnostics

- Ontoly compiler diagnostics: 13
- Ontoly graph validation: PASS (3 issues)
- Graphify diagnostics: 3

## Strengths

- Deterministic graph validation: Ontoly trustworthiness is 95 with consistency 100. (measured)
- Functions: Ontoly produced 206 Functions; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Modules: Ontoly produced 140 Modules; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Packages: Ontoly produced 29 Packages; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Configuration: Ontoly produced 44 Configuration; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Next.js framework understanding: Ontoly detected the framework explicitly; Graphify only exposes framework understanding when it appears in normalized labels/relations. (inferred from framework detections)
- React framework understanding: Ontoly detected the framework explicitly; Graphify only exposes framework understanding when it appears in normalized labels/relations. (inferred from framework detections)

## Weaknesses

- Graphify full semantic extraction: Graphify required an LLM backend for docs/images, so the comparison uses a structural code-only fallback graph. (measured)
- Graph validation warnings: 3 validation warnings were reported. (measured)
- Turborepo detection: Repository evidence suggests Turborepo, but Ontoly did not explicitly detect it. (inferred from package metadata)

## Recommendations

- Priority: High
  Description: 3 graph validation issue(s) with code SELF_RELATIONSHIP.
  Suggested Fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- Priority: Medium
  Description: Turborepo was inferred from repository metadata but not detected by Ontoly.
  Suggested Fix: Add a Turborepo framework detector or map existing package evidence to a Framework node.
- Priority: Medium
  Description: Graphify full semantic extraction was unavailable without an LLM backend.
  Suggested Fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Reproducibility

Measured results come from artifacts under this repository's validation folder. Inferred observations are labelled in the Strengths and Weaknesses sections.
