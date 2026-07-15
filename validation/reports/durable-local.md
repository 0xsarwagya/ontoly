# durable-local Comparison

## Repository Summary

- Requested path: /Users/shrey/Desktop/personal/durable-local
- Actual path: /Users/shrey/Desktop/personal/durable-local
- Files: 56
- Source files: 30
- Packages: 1
- Frameworks: Vite

## Graph Statistics

| Tool | Nodes | Edges | Diagnostics | Hash |
| --- | ---: | ---: | ---: | --- |
| Ontoly | 226 | 384 | 0 | 1xd5unc |
| Graphify | 0 | 0 | 0 | e36634175223f5b2f5abd7582c60155c47fc3947ec8ae82165c8dcbe7d7ae4b2 |

## Semantic Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| Functions | 35 | 0 | 35 | graphify_missing | not measured |
| Methods | 0 | 0 | 0 | not_observed | not measured |
| Classes | 1 | 0 | 1 | graphify_missing | not measured |
| Interfaces | 9 | 0 | 9 | graphify_missing | not measured |
| Routes | 0 | 0 | 0 | not_observed | not measured |
| Controllers | 0 | 0 | 0 | not_observed | not measured |
| Modules | 21 | 0 | 21 | graphify_missing | not measured |
| Services | 0 | 0 | 0 | not_observed | not measured |
| Providers | 0 | 0 | 0 | not_observed | not measured |
| Repositories | 0 | 0 | 0 | not_observed | not measured |
| Packages | 8 | 0 | 8 | graphify_missing | not measured |
| Configuration | 5 | 0 | 5 | graphify_missing | not measured |
| Environment Variables | 1 | 0 | 1 | graphify_missing | not measured |

## Relationship Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| CALLS | 41 | 0 | 41 | graphify_missing | not measured |
| IMPORTS | 38 | 0 | 38 | graphify_missing | not measured |
| EXPORTS | 54 | 0 | 54 | graphify_missing | not measured |
| CONTAINS | 175 | 0 | 175 | graphify_missing | not measured |
| HANDLES | 0 | 0 | 0 | not_observed | not measured |
| MOUNTS | 0 | 0 | 0 | not_observed | not measured |
| INJECTS | 2 | 0 | 2 | graphify_missing | not measured |
| READS | 1 | 0 | 1 | graphify_missing | not measured |
| WRITES | 0 | 0 | 0 | not_observed | not measured |
| USES | 28 | 0 | 28 | graphify_missing | not measured |
| DEPENDS_ON | 7 | 0 | 7 | graphify_missing | not measured |
| AUTHORIZES | 0 | 0 | 0 | not_observed | not measured |
| REGISTERED_IN | 0 | 0 | 0 | not_observed | not measured |
| IMPLEMENTS | 0 | 0 | 0 | not_observed | not measured |
| EXTENDS | 1 | 0 | 1 | graphify_missing | not measured |
| REFERENCES | 0 | 0 | 0 | not_observed | not measured |
| CREATES | 7 | 0 | 7 | graphify_missing | not measured |
| THROWS | 5 | 0 | 5 | graphify_missing | not measured |
| RETURNS | 11 | 0 | 11 | graphify_missing | not measured |
| PUBLISHES | 0 | 0 | 0 | not_observed | not measured |
| SUBSCRIBES | 0 | 0 | 0 | not_observed | not measured |

## Framework Understanding

| Framework | Ontoly Detected | Graphify Inferred | Coverage | Confidence | Missing Concepts | Relationship Gaps |
| --- | --- | --- | ---: | --- | --- | --- |
| Vite | no | no | 100 | n/a | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, AUTHORIZES, REGISTERED_IN |

## Performance

| Tool | Cold Analysis | Peak Memory | Graph Hash |
| --- | ---: | ---: | --- |
| Ontoly | 965ms | 539.9 MB | 1xd5unc |
| Graphify | 126.84ms | 40.4 MB | e36634175223f5b2f5abd7582c60155c47fc3947ec8ae82165c8dcbe7d7ae4b2 |

## Diagnostics

- Ontoly compiler diagnostics: 0
- Ontoly graph validation: PASS (0 issues)
- Graphify diagnostics: 3

## Strengths

- Deterministic graph validation: Ontoly trustworthiness is 100 with consistency 100. (measured)
- Functions: Ontoly produced 35 Functions; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Classes: Ontoly produced 1 Classes; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Interfaces: Ontoly produced 9 Interfaces; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Modules: Ontoly produced 21 Modules; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Packages: Ontoly produced 8 Packages; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Configuration: Ontoly produced 5 Configuration; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Environment Variables: Ontoly produced 1 Environment Variables; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- INJECTS: Ontoly produced 2 INJECTS relationships; Graphify produced 0. (inferred from normalized counts)

## Weaknesses

- Graphify full semantic extraction: Graphify required an LLM backend for docs/images, so the comparison uses a structural code-only fallback graph. (measured)
- Vite detection: Repository evidence suggests Vite, but Ontoly did not explicitly detect it. (inferred from package metadata)

## Recommendations

- Priority: Medium
  Description: Vite was inferred from repository metadata but not detected by Ontoly.
  Suggested Fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Priority: Medium
  Description: Graphify full semantic extraction was unavailable without an LLM backend.
  Suggested Fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Reproducibility

Measured results come from artifacts under this repository's validation folder. Inferred observations are labelled in the Strengths and Weaknesses sections.
