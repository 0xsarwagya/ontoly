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
