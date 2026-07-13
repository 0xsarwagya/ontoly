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
