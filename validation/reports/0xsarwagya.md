# 0xsarwagya Comparison

## Repository Summary

- Requested path: /Users/shrey/Desktop/personal/0xsarwagya
- Actual path: /Users/shrey/Desktop/personal/0xsarwagya
- Files: 446
- Source files: 189
- Packages: 10
- Frameworks: Next.js, React, Turborepo

## Graph Statistics

| Tool | Nodes | Edges | Diagnostics | Hash |
| --- | ---: | ---: | ---: | --- |
| Ontoly | 1202 | 2082 | 13 | 02tafm2 |
| Graphify | 1071 | 1811 | 0 | 9320c522532a9d05da5b4963dd90eadd96facf9f29587db8d0acb95f8a0f7204 |

## Semantic Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| Functions | 205 | 215 | -10 | supported | not measured |
| Methods | 0 | 0 | 0 | not_observed | not measured |
| Classes | 0 | 86 | -86 | ontoly_missing | not measured |
| Interfaces | 0 | 1 | -1 | ontoly_missing | not measured |
| Routes | 0 | 0 | 0 | not_observed | not measured |
| Controllers | 0 | 0 | 0 | not_observed | not measured |
| Modules | 140 | 146 | -6 | supported | not measured |
| Services | 0 | 0 | 0 | not_observed | not measured |
| Providers | 0 | 0 | 0 | not_observed | not measured |
| Repositories | 0 | 0 | 0 | not_observed | not measured |
| Packages | 29 | 0 | 29 | graphify_missing | not measured |
| Configuration | 44 | 31 | 13 | divergent | not measured |
| Environment Variables | 0 | 27 | -27 | ontoly_missing | not measured |

## Relationship Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| CALLS | 201 | 104 | 97 | divergent | not measured |
| IMPORTS | 300 | 353 | -53 | supported | not measured |
| EXPORTS | 186 | 0 | 186 | graphify_missing | not measured |
| CONTAINS | 951 | 882 | 69 | supported | not measured |
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
| EXTENDS | 0 | 55 | -55 | ontoly_missing | not measured |
| REFERENCES | 0 | 0 | 0 | not_observed | not measured |
| CREATES | 4 | 0 | 4 | graphify_missing | not measured |
| THROWS | 2 | 0 | 2 | graphify_missing | not measured |
| RETURNS | 53 | 0 | 53 | graphify_missing | not measured |
| PUBLISHES | 0 | 0 | 0 | not_observed | not measured |
| SUBSCRIBES | 0 | 0 | 0 | not_observed | not measured |

## Framework Understanding

| Framework | Ontoly Detected | Graphify Inferred | Coverage | Confidence | Missing Concepts | Relationship Gaps |
| --- | --- | --- | ---: | --- | --- | --- |
| Next.js | yes | yes | 10 | exact | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, INJECTS, AUTHORIZES, REGISTERED_IN |
| React | yes | yes | 10 | exact | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, INJECTS, AUTHORIZES, REGISTERED_IN |
| Turborepo | no | yes | 95 | n/a | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, INJECTS, AUTHORIZES, REGISTERED_IN |

## Performance

| Tool | Cold Analysis | Peak Memory | Graph Hash |
| --- | ---: | ---: | --- |
| Ontoly | 5026.11ms | 1.6 GB | 02tafm2 |
| Graphify | 1449.78ms | 66.7 MB | 9320c522532a9d05da5b4963dd90eadd96facf9f29587db8d0acb95f8a0f7204 |

## Diagnostics

- Ontoly compiler diagnostics: 13
- Ontoly graph validation: PASS (3 issues)
- Graphify diagnostics: 3

## Strengths

- Deterministic graph validation: Ontoly trustworthiness is 95 with consistency 100. (measured)
- Packages: Ontoly produced 29 Packages; Graphify produced 0 in the normalized model. (inferred from normalized counts)

## Weaknesses

- Graphify full semantic extraction: Graphify required an LLM backend for docs/images, so the comparison uses a structural code-only fallback graph. (measured)
- Graph validation warnings: 3 validation warnings were reported. (measured)
- Classes: Graphify produced 86 Classes; Ontoly produced 0 in the normalized model. (inferred from normalized counts)
- Interfaces: Graphify produced 1 Interfaces; Ontoly produced 0 in the normalized model. (inferred from normalized counts)
- Environment Variables: Graphify produced 27 Environment Variables; Ontoly produced 0 in the normalized model. (inferred from normalized counts)
- EXTENDS: Graphify produced 55 EXTENDS relationships; Ontoly produced 0. (inferred from normalized counts)
- Turborepo detection: Repository evidence suggests Turborepo, but Ontoly did not explicitly detect it. (inferred from package metadata)

## Recommendations

- Priority: High
  Description: 3 graph validation issue(s) with code SELF_RELATIONSHIP.
  Suggested Fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- Priority: Medium
  Description: Ontoly did not emit EXTENDS, while Graphify emitted 55.
  Suggested Fix: Add or extend relationship extraction for EXTENDS and cover it with deterministic snapshots.
- Priority: Medium
  Description: Turborepo was inferred from repository metadata but not detected by Ontoly.
  Suggested Fix: Add a Turborepo framework detector or map existing package evidence to a Framework node.
- Priority: Medium
  Description: Graphify full semantic extraction was unavailable without an LLM backend.
  Suggested Fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Reproducibility

Measured results come from artifacts under this repository's validation folder. Inferred observations are labelled in the Strengths and Weaknesses sections.
