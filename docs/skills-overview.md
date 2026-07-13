# Skills Overview

Ontoly ships official skills for:

- architecture review
- impact analysis
- codebase onboarding
- request tracing
- dependency analysis
- security review
- configuration analysis
- framework analysis
- documentation
- refactoring
- performance analysis
- dead-code analysis
- migration analysis
- SDK generation planning

The catalog lives in `skills/catalog.json`.

Release assets:

- `skills/SKILL_CATALOG.md`
- `skills/SKILL_MATRIX.md`
- `skills/CAPABILITY_MATRIX.md`
- `skills/COMPATIBILITY_MATRIX.md`
- `skills/INSTALLATION.md`
- `skills/README_SNIPPETS.md`
- `skills/website-assets/`

## Capability Mapping

Skills map to Ontoly MCP capabilities. Examples:

- Architecture Review: `ExplainArchitecture`, `GraphStatistics`
- Dependency Analysis: `FindDependencies`, `FindDependents`
- Impact Analysis: `ImpactAnalysis`
- Request Tracing: `TraceRequestLifecycle`, `TraceExecution`
- Configuration Analysis: `FindConfigurationUsage`
- Security Review: `FindAuthenticationFlow`
- Dead Code Analysis: `FindDeadCode`, `FindUnusedFeature`

The mapping is declarative metadata, not business logic.
