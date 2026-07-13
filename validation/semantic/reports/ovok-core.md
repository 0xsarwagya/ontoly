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
