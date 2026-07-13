# Ovok Core Comparison

## Repository Summary

- Requested path: /Users/shrey/Desktop/work/ovok-core
- Actual path: /Users/shrey/Desktop/work/ovok-core
- Files: 11407
- Source files: 9321
- Packages: 1
- Frameworks: Express, NestJS

## Graph Statistics

| Tool | Nodes | Edges | Diagnostics | Hash |
| --- | ---: | ---: | ---: | --- |
| Ontoly | 21696 | 47312 | 13 | 17ibur0 |
| Graphify | 27444 | 57572 | 0 | 5a36d97a2c02e9a9068b9146cef1210cf19454ae17581a3cc6f6a7f72887129e |

## Semantic Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| Functions | 1272 | 8724 | -7452 | divergent | not measured |
| Methods | 2457 | 2868 | -411 | supported | not measured |
| Classes | 1055 | 2310 | -1255 | divergent | not measured |
| Interfaces | 266 | 70 | 196 | divergent | not measured |
| Routes | 418 | 0 | 418 | graphify_missing | not measured |
| Controllers | 118 | 117 | 1 | supported | not measured |
| Modules | 1970 | 3630 | -1660 | divergent | not measured |
| Services | 237 | 243 | -6 | supported | not measured |
| Providers | 382 | 4 | 378 | divergent | not measured |
| Repositories | 0 | 1 | -1 | ontoly_missing | not measured |
| Packages | 120 | 0 | 120 | graphify_missing | not measured |
| Configuration | 10 | 341 | -331 | divergent | not measured |
| Environment Variables | 162 | 385 | -223 | divergent | not measured |

## Relationship Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| CALLS | 2064 | 4278 | -2214 | divergent | not measured |
| IMPORTS | 10083 | 8948 | 1135 | supported | not measured |
| EXPORTS | 2707 | 0 | 2707 | graphify_missing | not measured |
| CONTAINS | 18486 | 21057 | -2571 | supported | not measured |
| HANDLES | 423 | 0 | 423 | graphify_missing | not measured |
| MOUNTS | 420 | 0 | 420 | graphify_missing | not measured |
| INJECTS | 992 | 0 | 992 | graphify_missing | not measured |
| READS | 159 | 0 | 159 | graphify_missing | not measured |
| WRITES | 0 | 0 | 0 | not_observed | not measured |
| USES | 3037 | 0 | 3037 | graphify_missing | not measured |
| DEPENDS_ON | 142 | 0 | 142 | graphify_missing | not measured |
| AUTHORIZES | 231 | 0 | 231 | graphify_missing | not measured |
| REGISTERED_IN | 555 | 0 | 555 | graphify_missing | not measured |
| IMPLEMENTS | 122 | 62 | 60 | divergent | not measured |
| EXTENDS | 490 | 63 | 427 | divergent | not measured |
| REFERENCES | 795 | 2733 | -1938 | divergent | not measured |
| CREATES | 512 | 0 | 512 | graphify_missing | not measured |
| THROWS | 433 | 0 | 433 | graphify_missing | not measured |
| RETURNS | 1353 | 0 | 1353 | graphify_missing | not measured |
| PUBLISHES | 0 | 0 | 0 | not_observed | not measured |
| SUBSCRIBES | 0 | 0 | 0 | not_observed | not measured |

## Framework Understanding

| Framework | Ontoly Detected | Graphify Inferred | Coverage | Confidence | Missing Concepts | Relationship Gaps |
| --- | --- | --- | ---: | --- | --- | --- |
| Express | yes | yes | 60 | exact | none measured | none measured |
| NestJS | yes | yes | 100 | exact | none measured | none measured |

## Performance

| Tool | Cold Analysis | Peak Memory | Graph Hash |
| --- | ---: | ---: | --- |
| Ontoly | 13865.61ms | 3.2 GB | 17ibur0 |
| Graphify | 31782.69ms | 1.7 GB | 5a36d97a2c02e9a9068b9146cef1210cf19454ae17581a3cc6f6a7f72887129e |

## Diagnostics

- Ontoly compiler diagnostics: 13
- Ontoly graph validation: PASS (84 issues)
- Graphify diagnostics: 3

## Strengths

- Deterministic graph validation: Ontoly trustworthiness is 98 with consistency 100. (measured)
- Routes: Ontoly produced 418 Routes; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Packages: Ontoly produced 120 Packages; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- HANDLES: Ontoly produced 423 HANDLES relationships; Graphify produced 0. (inferred from normalized counts)
- MOUNTS: Ontoly produced 420 MOUNTS relationships; Graphify produced 0. (inferred from normalized counts)
- INJECTS: Ontoly produced 992 INJECTS relationships; Graphify produced 0. (inferred from normalized counts)
- AUTHORIZES: Ontoly produced 231 AUTHORIZES relationships; Graphify produced 0. (inferred from normalized counts)
- REGISTERED_IN: Ontoly produced 555 REGISTERED_IN relationships; Graphify produced 0. (inferred from normalized counts)

## Weaknesses

- Graphify full semantic extraction: Graphify required an LLM backend for docs/images, so the comparison uses a structural code-only fallback graph. (measured)
- Graph validation warnings: 84 validation warnings were reported. (measured)
- Repositories: Graphify produced 1 Repositories; Ontoly produced 0 in the normalized model. (inferred from normalized counts)

## Recommendations

- Priority: High
  Description: 11 graph validation issue(s) with code CONTROLLER_MISSING_MODULE.
  Suggested Fix: Resolve framework module declarations and register controllers under their declaring module.
- Priority: High
  Description: 4 graph validation issue(s) with code DUPLICATE_CONTROLLER.
  Suggested Fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- Priority: High
  Description: 69 graph validation issue(s) with code PROVIDER_WITHOUT_CONSUMERS.
  Suggested Fix: Improve provider consumer detection or mark intentionally public/root providers with explicit metadata.
- Priority: Medium
  Description: Graphify full semantic extraction was unavailable without an LLM backend.
  Suggested Fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Reproducibility

Measured results come from artifacts under this repository's validation folder. Inferred observations are labelled in the Strengths and Weaknesses sections.
