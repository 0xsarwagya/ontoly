---
name: migration-analysis
description: Plan migrations using Ontoly architecture, dependency, impact, and configuration evidence. Use when asked to migrate frameworks, packages, APIs, modules, or runtime configuration.
license: MIT
compatibility: Portable Agent Skills format; requires Ontoly CLI and MCP-capable or CLI-capable coding agent.
metadata:
  ontoly.skill.version: "0.1.0-alpha.1"
  ontoly.min.version: "0.1.0-alpha.1"
  ontoly.capabilities: "ExplainArchitecture, ImpactAnalysis, FindConfigurationUsage, FindDependencies"
  ontoly.category: "migration"
  ontoly.deprecated: "false"
---

# Migration Analysis

Use this skill when the user asks for migration analysis using Ontoly evidence.

## Required Workflow

Follow [the shared Ontoly workflow](reference/workflow.md). Also read [graph evidence rules](reference/graph.md), [MCP usage](reference/mcp.md), [best practices](reference/best-practices.md), and [fallback rules](reference/fallbacks.md) when the task requires detail.

## Ontoly Capabilities

Use these capabilities first: `ExplainArchitecture`, `ImpactAnalysis`, `FindConfigurationUsage`, `FindDependencies`.

## Output Contract

Return:

- answer or plan
- capabilities invoked
- graph evidence with node ids, edge types, source spans, and graph hash when available
- confidence: high, medium, or low
- fallback reason if repository files were inspected

## Boundaries

Do not implement compiler, query, MCP, SDK, or business logic in the skill. Do not search repository files until Ontoly cannot answer or evidence must be confirmed.

## Resources

- [Examples](examples.md)
- [Prompt template](templates/refactoring-plan.md)
- [Capability notes](reference/capabilities.md)
