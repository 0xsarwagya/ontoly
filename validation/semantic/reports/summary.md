# Semantic Evaluation Summary

Generated: 2026-07-13T15:37:42.502Z

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 29 | 29 | 0 | 0 | 100 | 100 | 100 | 0.337ms |
| Graphify | 29 | 16 | 0 | 13 | 55.17 | 55.17 | 55.17 | 0.172ms |

## Category Scores

| Category | Ontoly | Graphify |
| --- | ---: | ---: |
| Functions | 100 | 0 |
| Classes | 100 | 100 |
| Interfaces | 100 | 100 |
| Routes | 100 | 0 |
| Controllers | 100 | 100 |
| Services | 100 | 100 |
| Modules | 100 | 100 |
| Packages | 100 | 50 |
| Dependency Injection | 100 | 0 |
| Environment Variables | 100 | 0 |
| Call Graph | 100 | 100 |
| Workspace | 100 | 0 |
| Database | 100 | 100 |
| Architecture | 100 | 50 |

## Repositories

# 0xsarwagya Semantic Evaluation

Repository: 0xsarwagya
Frameworks: Next.js, React, Turborepo

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 5 | 5 | 0 | 0 | 100 | 100 | 100 | 1.035ms |
| Graphify | 5 | 3 | 0 | 2 | 60 | 60 | 60 | 0.065ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| Is the Ghost package represented in the monorepo? | Packages | PASS (100) | PASS (100) | Tie |
| Is the durable-local package represented in the monorepo? | Packages | PASS (100) | PASS (100) | Tie |
| Does the architecture identify Next.js? | Architecture | PASS (100) | FAIL (0) | Ontoly |
| Does the architecture identify React? | Architecture | PASS (100) | PASS (100) | Tie |
| Is the Turborepo pipeline configuration represented? | Workspace | PASS (100) | FAIL (0) | Ontoly |

# durable-local Semantic Evaluation

Repository: durable-local
Frameworks: React, Vite

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 6 | 6 | 0 | 0 | 100 | 100 | 100 | 0.026ms |
| Graphify | 6 | 2 | 0 | 4 | 33.33 | 33.33 | 33.33 | 0.009ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| What function creates a durable local store? | Functions | PASS (100) | FAIL (0) | Ontoly |
| Which public interface represents the durable store? | Interfaces | PASS (100) | PASS (100) | Tie |
| What is the package name? | Packages | PASS (100) | FAIL (0) | Ontoly |
| Which CI environment variable is read? | Environment Variables | PASS (100) | FAIL (0) | Ontoly |
| Which dependency provides IndexedDB tests? | Dependency Injection | PASS (100) | FAIL (0) | Ontoly |
| Does withReadWrite call openDatabase? | Call Graph | PASS (100) | PASS (100) | Tie |

# Ghost Semantic Evaluation

Repository: ghost
Frameworks: React, Vite

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 6 | 6 | 0 | 0 | 100 | 100 | 100 | 0.018ms |
| Graphify | 6 | 3 | 0 | 3 | 50 | 50 | 50 | 0.012ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| What is the browser entrypoint for creating a Ghost identity? | Functions | PASS (100) | FAIL (0) | Ontoly |
| Which public interface represents a Ghost client? | Interfaces | PASS (100) | PASS (100) | Tie |
| Which error class represents Ghost failures? | Classes | PASS (100) | PASS (100) | Tie |
| Which CI environment variable is read? | Environment Variables | PASS (100) | FAIL (0) | Ontoly |
| What is the package name? | Packages | PASS (100) | FAIL (0) | Ontoly |
| Does loading or creating a record call createGhostId? | Call Graph | PASS (100) | PASS (100) | Tie |

# Innosphere Semantic Evaluation

Repository: innosphere
Frameworks: NestJS, React, Turborepo, Vite

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 6 | 6 | 0 | 0 | 100 | 100 | 100 | 0.178ms |
| Graphify | 6 | 5 | 0 | 1 | 83.33 | 83.33 | 83.33 | 0.122ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| Which controller handles auth? | Controllers | PASS (100) | PASS (100) | Tie |
| Which route returns the current authenticated user? | Routes | PASS (100) | FAIL (0) | Ontoly |
| Which module owns auth behavior? | Modules | PASS (100) | PASS (100) | Tie |
| Which environment variable points to the database? | Database | PASS (100) | PASS (100) | Tie |
| Which service models Ovok integration? | Services | PASS (100) | PASS (100) | Tie |
| Which module is the Nest application root? | Modules | PASS (100) | PASS (100) | Tie |

# Ovok Core Semantic Evaluation

Repository: ovok-core
Frameworks: NestJS, Express

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 6 | 6 | 0 | 0 | 100 | 100 | 100 | 0.545ms |
| Graphify | 6 | 3 | 0 | 3 | 50 | 50 | 50 | 0.635ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| Which controller handles authentication? | Controllers | PASS (100) | PASS (100) | Tie |
| Which service backs the authentication controller? | Services | PASS (100) | PASS (100) | Tie |
| Is AuthService injected into AuthController? | Dependency Injection | PASS (100) | FAIL (0) | Ontoly |
| Which route handles the FHIR R4 proxy? | Routes | PASS (100) | FAIL (0) | Ontoly |
| Which Nest module owns the authentication area? | Modules | PASS (100) | PASS (100) | Tie |
| Which environment variable controls the default FHIR version? | Environment Variables | PASS (100) | FAIL (0) | Ontoly |
