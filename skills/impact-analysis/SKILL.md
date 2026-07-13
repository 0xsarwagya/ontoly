---
name: impact-analysis
description: Analyze change impact using Ontoly dependency and dependent traversal. Use when asked what breaks if a symbol, service, route, package, or repository node changes or is removed.
license: MIT
compatibility: Portable Agent Skills format; requires Ontoly CLI and MCP-capable or CLI-capable coding agent.
metadata:
  ontoly.skill.version: "0.1.0-alpha.1"
  ontoly.min.version: "0.1.0-alpha.1"
  ontoly.capabilities: "ImpactAnalysis, FindDependents, FindDependencies, FindNode"
  ontoly.category: "change-analysis"
  ontoly.deprecated: "false"
---

# Impact Analysis

Use this skill when the user asks for impact analysis using Ontoly evidence.

## Required Workflow

Follow [the shared Ontoly workflow](reference/workflow.md). Also read [graph evidence rules](reference/graph.md), [MCP usage](reference/mcp.md), [best practices](reference/best-practices.md), and [fallback rules](reference/fallbacks.md) when the task requires detail.

## Ontoly Capabilities

Use these capabilities first: `ImpactAnalysis`, `FindDependents`, `FindDependencies`, `FindNode`.

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
- [Prompt template](templates/impact-analysis.md)
- [Capability notes](reference/capabilities.md)
