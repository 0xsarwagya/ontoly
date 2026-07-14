---
title: "Capabilities"
description: "Deterministic software-engineering capabilities over the Ontoly Software Graph."
order: 22
---

# Capabilities

Capabilities are deterministic operations over a `SoftwareGraph`.

The `@0xsarwagya/ontoly-capabilities` package owns high-level software
engineering answers such as impact analysis, request tracing, ownership,
repository health, risk analysis, and implementation planning. The CLI and MCP
server call this package. They do not reimplement capability logic.

Capabilities do not parse source code, mutate the graph, inspect parser ASTs, or
perform AI reasoning. They compose the Query Engine, graph indexes, graph
relationships, diagnostics, and provenance into a shared result schema.

## Shared Result Schema

Every high-level capability returns:

- `summary`
- `evidence`
- `affectedNodes`
- `affectedFiles`
- `affectedPackages`
- `statistics`
- `confidence`
- `diagnostics`
- `recommendations`
- `graph`

This shape is used by:

- `ontoly explain`
- `ontoly impact`
- `ontoly implementation-plan`
- `ontoly ownership`
- `ontoly health`
- `ontoly repository-summary`
- `ontoly risk`
- `ontoly request-trace`
- Ontoly MCP semantic capabilities
- Agent Skills that consume MCP

## High-Level Capabilities

- `RepositorySummary`
- `ArchitectureSummary`
- `ImpactAnalysis`
- `ImplementationPlan`
- `RequestTrace`
- `DependencyAnalysis`
- `OwnershipAnalysis`
- `AuthenticationFlow`
- `AuthorizationFlow`
- `ConfigurationUsage`
- `EnvironmentUsage`
- `CallHierarchy`
- `DependencyHierarchy`
- `ProviderGraph`
- `ModuleOverview`
- `ServiceOverview`
- `PackageOverview`
- `RepositoryHealth`
- `DeadCode`
- `CircularDependencies`
- `EntryPoints`
- `FrameworkSummary`
- `RiskAnalysis`
- `DataFlow`
- `FeatureTouchpoints`

## MCP Primitive Capabilities

The MCP server also exposes lower-level primitives for agent workflows:

- `FindFunction`
- `FindNode`
- `FindDependencies`
- `FindDependents`
- `TraceExecution`
- `InspectFile`
- `InspectModule`
- `InspectClass`
- `InspectFunction`
- `FindCycles`
- `FindDeadCode`
- `FindEntrypoints`
- `FindConfiguration`
- `FindResponsibleFunction`
- `ExplainArchitecture`
- `TraceRequestLifecycle`
- `FindFeatureOwner`
- `FindAuthenticationFlow`
- `FindDatabaseAccess`
- `FindConfigurationUsage`
- `FindUnusedFeature`
- `GraphStatistics`

Primitive capabilities remain available for Skills that need exact graph facts.
High-level capabilities are preferred when the user asks a software-engineering
question.

## Related Docs

- [Capability API](/ontoly/docs/capability-api)
- [Capability Registry](/ontoly/docs/capability-registry)
- [Evidence Model](/ontoly/docs/evidence-model)
- [Confidence Model](/ontoly/docs/confidence-model)
- [Implementation Planning](/ontoly/docs/implementation-planning)
- [Question Corpus](/ontoly/docs/question-corpus)
- [Benchmark Methodology](/ontoly/docs/benchmark-methodology)
- [Agent Skills](/ontoly/docs/agent-skills)
