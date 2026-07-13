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
