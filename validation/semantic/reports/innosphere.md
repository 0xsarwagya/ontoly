# Innosphere Semantic Evaluation

Repository: innosphere
Frameworks: NestJS, React, Turborepo, Vite

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 6 | 6 | 0 | 0 | 100 | 100 | 100 | 0.282ms |
| Graphify | 6 | 0 | 0 | 6 | 0 | 0 | 0 | 0.001ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| Which controller handles auth? | Controllers | PASS (100) | FAIL (0) | Ontoly |
| Which route returns the current authenticated user? | Routes | PASS (100) | FAIL (0) | Ontoly |
| Which module owns auth behavior? | Modules | PASS (100) | FAIL (0) | Ontoly |
| Which environment variable points to the database? | Database | PASS (100) | FAIL (0) | Ontoly |
| Which service models Ovok integration? | Services | PASS (100) | FAIL (0) | Ontoly |
| Which module is the Nest application root? | Modules | PASS (100) | FAIL (0) | Ontoly |
