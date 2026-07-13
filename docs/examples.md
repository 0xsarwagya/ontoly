# Examples

Run the Sprint 3 workflow from a repository root:

```sh
ontoly build .
ontoly stats
ontoly architecture
ontoly report
ontoly inspect src/auth.ts
ontoly trace fn:src/index.ts:main
ontoly graph --format mermaid
ontoly report api
ontoly report dependencies
ontoly report configuration
ontoly mcp
```

The graph should contain syntax facts, semantic relationships, repository
metadata, configuration nodes, framework nodes, and API structure when the
repository contains deterministic evidence for them.
