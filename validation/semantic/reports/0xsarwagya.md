# 0xsarwagya Semantic Evaluation

Repository: 0xsarwagya
Frameworks: Next.js, React, Turborepo

| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ontoly | 5 | 5 | 0 | 0 | 100 | 100 | 100 | 0.978ms |
| Graphify | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 0.003ms |

## Questions

| Question | Category | Ontoly | Graphify | Winner |
| --- | --- | ---: | ---: | --- |
| Is the Ghost package represented in the monorepo? | Packages | PASS (100) | FAIL (0) | Ontoly |
| Is the durable-local package represented in the monorepo? | Packages | PASS (100) | FAIL (0) | Ontoly |
| Does the architecture identify Next.js? | Architecture | PASS (100) | FAIL (0) | Ontoly |
| Does the architecture identify React? | Architecture | PASS (100) | FAIL (0) | Ontoly |
| Is the Turborepo pipeline configuration represented? | Workspace | PASS (100) | FAIL (0) | Ontoly |
