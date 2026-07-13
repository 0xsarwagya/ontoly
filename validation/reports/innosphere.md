# Innosphere Comparison

## Repository Summary

- Requested path: /Users/shrey/Desktop/work/innosphere
- Actual path: /Users/shrey/Desktop/work/innosphere
- Files: 846
- Source files: 561
- Packages: 8
- Frameworks: NestJS, React, Turborepo, Vite

## Graph Statistics

| Tool | Nodes | Edges | Diagnostics | Hash |
| --- | ---: | ---: | ---: | --- |
| Ontoly | 6744 | 12091 | 12 | 0e26ua1 |
| Graphify | 4178 | 9594 | 0 | 2f69ca2830543e71bc79a188fa37107b4220f8687d7e66b1598ea82482948273 |

## Semantic Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| Functions | 1307 | 1357 | -50 | supported | not measured |
| Methods | 269 | 291 | -22 | supported | not measured |
| Classes | 63 | 850 | -787 | divergent | not measured |
| Interfaces | 512 | 1 | 511 | divergent | not measured |
| Routes | 76 | 0 | 76 | graphify_missing | not measured |
| Controllers | 15 | 15 | 0 | supported | not measured |
| Modules | 514 | 520 | -6 | supported | not measured |
| Services | 19 | 18 | 1 | supported | not measured |
| Providers | 23 | 0 | 23 | graphify_missing | not measured |
| Repositories | 0 | 0 | 0 | not_observed | not measured |
| Packages | 124 | 0 | 124 | graphify_missing | not measured |
| Configuration | 23 | 36 | -13 | divergent | not measured |
| Environment Variables | 76 | 272 | -196 | divergent | not measured |

## Relationship Comparison

| Item | Ontoly | Graphify | Delta | Status | Incorrect |
| --- | ---: | ---: | ---: | --- | --- |
| CALLS | 1228 | 1355 | -127 | supported | not measured |
| IMPORTS | 1240 | 2319 | -1079 | divergent | not measured |
| EXPORTS | 1358 | 0 | 1358 | graphify_missing | not measured |
| CONTAINS | 5701 | 3350 | 2351 | divergent | not measured |
| HANDLES | 76 | 0 | 76 | graphify_missing | not measured |
| MOUNTS | 76 | 0 | 76 | graphify_missing | not measured |
| INJECTS | 11 | 0 | 11 | graphify_missing | not measured |
| READS | 75 | 0 | 75 | graphify_missing | not measured |
| WRITES | 0 | 0 | 0 | not_observed | not measured |
| USES | 810 | 0 | 810 | graphify_missing | not measured |
| DEPENDS_ON | 275 | 0 | 275 | graphify_missing | not measured |
| AUTHORIZES | 23 | 0 | 23 | graphify_missing | not measured |
| REGISTERED_IN | 90 | 0 | 90 | graphify_missing | not measured |
| IMPLEMENTS | 2 | 0 | 2 | graphify_missing | not measured |
| EXTENDS | 17 | 101 | -84 | divergent | not measured |
| REFERENCES | 69 | 141 | -72 | divergent | not measured |
| CREATES | 77 | 0 | 77 | graphify_missing | not measured |
| THROWS | 95 | 0 | 95 | graphify_missing | not measured |
| RETURNS | 425 | 0 | 425 | graphify_missing | not measured |
| PUBLISHES | 0 | 0 | 0 | not_observed | not measured |
| SUBSCRIBES | 0 | 0 | 0 | not_observed | not measured |

## Framework Understanding

| Framework | Ontoly Detected | Graphify Inferred | Coverage | Confidence | Missing Concepts | Relationship Gaps |
| --- | --- | --- | ---: | --- | --- | --- |
| NestJS | yes | yes | 100 | exact | none measured | none measured |
| React | yes | yes | 10 | exact | none measured | none measured |
| Turborepo | no | yes | 100 | n/a | none measured | none measured |
| Vite | no | no | 100 | n/a | none measured | none measured |

## Performance

| Tool | Cold Analysis | Peak Memory | Graph Hash |
| --- | ---: | ---: | --- |
| Ontoly | 8249.8ms | 1.9 GB | 0e26ua1 |
| Graphify | 3963.02ms | 214.3 MB | 2f69ca2830543e71bc79a188fa37107b4220f8687d7e66b1598ea82482948273 |

## Diagnostics

- Ontoly compiler diagnostics: 12
- Ontoly graph validation: PASS (2 issues)
- Graphify diagnostics: 3

## Strengths

- Deterministic graph validation: Ontoly trustworthiness is 100 with consistency 100. (measured)
- Routes: Ontoly produced 76 Routes; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Providers: Ontoly produced 23 Providers; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- Packages: Ontoly produced 124 Packages; Graphify produced 0 in the normalized model. (inferred from normalized counts)
- HANDLES: Ontoly produced 76 HANDLES relationships; Graphify produced 0. (inferred from normalized counts)
- MOUNTS: Ontoly produced 76 MOUNTS relationships; Graphify produced 0. (inferred from normalized counts)
- INJECTS: Ontoly produced 11 INJECTS relationships; Graphify produced 0. (inferred from normalized counts)
- AUTHORIZES: Ontoly produced 23 AUTHORIZES relationships; Graphify produced 0. (inferred from normalized counts)
- REGISTERED_IN: Ontoly produced 90 REGISTERED_IN relationships; Graphify produced 0. (inferred from normalized counts)

## Weaknesses

- Graphify full semantic extraction: Graphify required an LLM backend for docs/images, so the comparison uses a structural code-only fallback graph. (measured)
- Graph validation warnings: 2 validation warnings were reported. (measured)
- Turborepo detection: Repository evidence suggests Turborepo, but Ontoly did not explicitly detect it. (inferred from package metadata)
- Vite detection: Repository evidence suggests Vite, but Ontoly did not explicitly detect it. (inferred from package metadata)

## Recommendations

- Priority: High
  Description: 1 graph validation issue(s) with code PROVIDER_WITHOUT_CONSUMERS.
  Suggested Fix: Improve provider consumer detection or mark intentionally public/root providers with explicit metadata.
- Priority: High
  Description: 1 graph validation issue(s) with code SELF_RELATIONSHIP.
  Suggested Fix: Add a deterministic fixture for this validation issue and repair the graph construction invariant.
- Priority: Medium
  Description: Turborepo was inferred from repository metadata but not detected by Ontoly.
  Suggested Fix: Add a Turborepo framework detector or map existing package evidence to a Framework node.
- Priority: Medium
  Description: Vite was inferred from repository metadata but not detected by Ontoly.
  Suggested Fix: Add a Vite framework detector or map existing package evidence to a Framework node.
- Priority: Medium
  Description: Graphify full semantic extraction was unavailable without an LLM backend.
  Suggested Fix: For release validation, configure a deterministic Graphify semantic backend or keep the structural fallback as a separate benchmark lane.

## Reproducibility

Measured results come from artifacts under this repository's validation folder. Inferred observations are labelled in the Strengths and Weaknesses sections.
