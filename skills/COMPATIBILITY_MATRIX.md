# Compatibility Matrix

All official Ontoly skills use the portable Agent Skills `SKILL.md` layout and
require Ontoly CLI plus either MCP access or CLI fallback access.

| Skill | Skill Version | Minimum Ontoly | Enhancement | Required Capabilities | Deprecated |
| --- | --- | --- | --- | --- | --- |
| architecture-review | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `ExplainArchitecture`, `GraphStatistics`, `FindCycles`, `FindDependencies` | no |
| codebase-onboarding | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `ExplainArchitecture`, `FindEntrypoints`, `GraphStatistics`, `FindFeatureOwner` | no |
| configuration-analysis | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `FindConfiguration`, `FindConfigurationUsage`, `FindDependencies`, `GraphStatistics` | no |
| dead-code-analysis | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `FindDeadCode`, `FindUnusedFeature`, `FindEntrypoints`, `FindDependents` | no |
| dependency-analysis | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `FindDependencies`, `FindDependents`, `FindCycles`, `GraphStatistics` | no |
| documentation | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `ExplainArchitecture`, `TraceRequestLifecycle`, `InspectModule`, `GraphStatistics` | no |
| framework-analysis | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `ExplainArchitecture`, `GraphStatistics`, `FindNode`, `FindFeatureOwner` | no |
| impact-analysis | 0.1.0-alpha.3 | 0.1.0-alpha.6 | LLM Enhancement | `ImpactAnalysis`, `FindDependents`, `FindDependencies`, `FindNode` | no |
| migration-analysis | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `ExplainArchitecture`, `ImpactAnalysis`, `FindConfigurationUsage`, `FindDependencies` | no |
| performance-analysis | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `TraceExecution`, `TraceRequestLifecycle`, `FindDependencies`, `GraphStatistics` | no |
| refactoring | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `ImpactAnalysis`, `FindDependencies`, `FindDependents`, `FindCycles` | no |
| request-tracing | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `TraceRequestLifecycle`, `FindResponsibleFunction`, `TraceExecution`, `FindNode` | no |
| sdk-generation | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `ExplainArchitecture`, `TraceRequestLifecycle`, `FindResponsibleFunction`, `GraphStatistics` | no |
| security-review | 0.1.0-alpha.1 | 0.1.0-alpha.1 | LLM Enhancement | `FindAuthenticationFlow`, `FindResponsibleFunction`, `TraceRequestLifecycle`, `FindConfigurationUsage` | no |
