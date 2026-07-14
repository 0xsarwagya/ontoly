# Ghost Semantic Evaluation

Repository: ghost
Frameworks: React, Vite

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 6 | 6 | 0 | 0 | 100 | 100 | 100 | 0.031ms |
| Graphify | 6 | 0 | 0 | 6 | 0 | 0 | 0 | 0.003ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| What is the browser entrypoint for creating a Ghost identity? | Functions | PASS (100) | FAIL (0) | Ontoly |
| Which public interface represents a Ghost client? | Interfaces | PASS (100) | FAIL (0) | Ontoly |
| Which error class represents Ghost failures? | Classes | PASS (100) | FAIL (0) | Ontoly |
| Which CI environment variable is read? | Environment Variables | PASS (100) | FAIL (0) | Ontoly |
| What is the package name? | Packages | PASS (100) | FAIL (0) | Ontoly |
| Does loading or creating a record call createGhostId? | Call Graph | PASS (100) | FAIL (0) | Ontoly |
