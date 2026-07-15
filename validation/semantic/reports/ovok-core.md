# Ovok Core Semantic Evaluation

Repository: ovok-core
Frameworks: NestJS, Express

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 6 | 6 | 0 | 0 | 100 | 100 | 100 | 0.784ms |
| Graphify | 6 | 0 | 0 | 6 | 0 | 0 | 0 | 0.002ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| Which controller handles authentication? | Controllers | PASS (100) | FAIL (0) | Ontoly |
| Which service backs the authentication controller? | Services | PASS (100) | FAIL (0) | Ontoly |
| Is AuthService injected into AuthController? | Dependency Injection | PASS (100) | FAIL (0) | Ontoly |
| Which route handles the FHIR R4 proxy? | Routes | PASS (100) | FAIL (0) | Ontoly |
| Which Nest module owns the authentication area? | Modules | PASS (100) | FAIL (0) | Ontoly |
| Which environment variable controls the default FHIR version? | Environment Variables | PASS (100) | FAIL (0) | Ontoly |
