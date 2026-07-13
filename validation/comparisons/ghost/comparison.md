# Ghost Comparison

## Repository Summary

- Requested path: /Users/shrey/Desktop/personal/ghost
- Actual path: /Users/shrey/Desktop/personal/ghost
- Files: 58
- Source files: 37
- Packages: 1
- Frameworks: Vite

## Graph Statistics

| Tool | Nodes | Edges | Diagnostics | Hash |
| --- | ---: | ---: | ---: | --- |
| Ontoly | 350 | 655 | 0 | 1hv7tll |
| Graphify | 211 | 553 | 0 | 77725fa7e50ab4b018959aa78f8bc439e5f3acf57b0c1324cce927ebb4c0fd7e |

## Semantic Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| Functions | 57 | 59 | -2 | supported | not measured |
| Methods | 6 | 9 | -3 | divergent | not measured |
| Classes | 3 | 29 | -26 | divergent | not measured |
| Interfaces | 17 | 0 | 17 | graphify_missing | not measured |
| Routes | 0 | 0 | 0 | not_observed | not measured |
| Controllers | 0 | 0 | 0 | not_observed | not measured |
| Modules | 28 | 28 | 0 | supported | not measured |
| Services | 0 | 0 | 0 | not_observed | not measured |
| Providers | 0 | 0 | 0 | not_observed | not measured |
| Repositories | 0 | 0 | 0 | not_observed | not measured |
| Packages | 7 | 0 | 7 | graphify_missing | not measured |
| Configuration | 5 | 3 | 2 | divergent | not measured |
| Environment Variables | 1 | 4 | -3 | divergent | not measured |

## Relationship Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| CALLS | 82 | 76 | 6 | supported | not measured |
| IMPORTS | 69 | 123 | -54 | divergent | not measured |
| EXPORTS | 105 | 0 | 105 | graphify_missing | not measured |
| CONTAINS | 292 | 170 | 122 | divergent | not measured |
| HANDLES | 0 | 0 | 0 | not_observed | not measured |
| MOUNTS | 0 | 0 | 0 | not_observed | not measured |
| INJECTS | 2 | 0 | 2 | graphify_missing | not measured |
| READS | 1 | 0 | 1 | graphify_missing | not measured |
| WRITES | 0 | 0 | 0 | not_observed | not measured |
| USES | 30 | 0 | 30 | graphify_missing | not measured |
| DEPENDS_ON | 6 | 0 | 6 | graphify_missing | not measured |
| AUTHORIZES | 0 | 0 | 0 | not_observed | not measured |
| REGISTERED_IN | 0 | 0 | 0 | not_observed | not measured |
| IMPLEMENTS | 2 | 2 | 0 | supported | not measured |
| EXTENDS | 0 | 20 | -20 | ontoly_missing | not measured |
| REFERENCES | 0 | 10 | -10 | ontoly_missing | not measured |
| CREATES | 17 | 0 | 17 | graphify_missing | not measured |
| THROWS | 14 | 0 | 14 | graphify_missing | not measured |
| RETURNS | 20 | 0 | 20 | graphify_missing | not measured |
| PUBLISHES | 0 | 0 | 0 | not_observed | not measured |
| SUBSCRIBES | 0 | 0 | 0 | not_observed | not measured |

## Framework Understanding

| Framework | Ontoly Detected | Graphify Inferred | Coverage | Confidence | Missing Concepts | Relationship Gaps |
| --- | --- | --- | ---: | --- | --- | --- |
| Vite | no | no | 100 | n/a | Routes, Controllers, Services, Providers | HANDLES, MOUNTS, AUTHORIZES, REGISTERED_IN |

## Performance

| Tool | Cold Analysis | Peak Memory | Graph Hash |
| --- | ---: | ---: | --- |
| Ontoly | 1171.83ms | 467.5 MB | 1hv7tll |
| Graphify | 609.04ms | 47.7 MB | 77725fa7e50ab4b018959aa78f8bc439e5f3acf57b0c1324cce927ebb4c0fd7e |

## Diagnostics

- Ontoly compiler diagnostics: 0
- Ontoly graph validation: PASS (0 issues)
- Graphify diagnostics: 3

## Strengths

- Deterministic graph validation: Ontoly trustworthiness is 100 with consistency 100. (measured)
- Interfaces: Ontoly produced 17 Interfaces; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Packages: Ontoly produced 7 Packages; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- INJECTS: Ontoly produced 2 INJECTS relationships; Graphify produced 0. (inferred from normalized counts)

## Weaknesses

- Graphify full semantic extraction: Graphify required an LLM backend for docs/images, so the comparison uses a structural code-only fallback graph. (measured)
- EXTENDS: Graphify produced 20 EXTENDS relationships; Ontoly produced 0. (inferred from normalized counts)
- REFERENCES: Graphify produced 10 REFERENCES relationships; Ontoly produced 0. (inferred from normalized counts)
- Vite detection: Repository evidence suggests Vite, but Ontoly did not explicitly detect it. (inferred from package metadata)

## Recommendations

- Priority: Medium
  Description: Ontoly did not emit EXTENDS, while Graphify emitted 20.
  Suggested Fix: Add or extend relationship extraction for EXTENDS and cover it with deterministic snapshots.
- Priority: Medium
  Description: Ontoly did not emit REFERENCES, while Graphify emitted 10.
  Suggested Fix: Add or extend relationship extraction for REFERENCES and cover it with deterministic snapshots.
- Priority: Medium
  Description: Vite was inferred from repository metadata but not detected by Ontoly.
  Suggested Fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Priority: Medium
  Description: Graphify full semantic extraction was unavailable without an LLM backend.
  Suggested Fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Reproducibility

Measured results come from artifacts under this repository's validation folder. Inferred observations are labelled in the Strengths and Weaknesses sections.
