---
name: dead-code-analysis
description: Find potentially unused functions, methods, services, routes, or features using Ontoly dead-code and entrypoint capabilities. Use when asked what code appears unreachable or safe to remove.
license: MIT
compatibility: Portable Agent Skills format; requires Ontoly CLI and MCP-capable or CLI-capable coding agent.
metadata:
  ontoly.skill.version: "0.1.0-alpha.4"
  ontoly.min.version: "0.1.0-alpha.12"
  ontoly.capabilities: "FindDeadCode, FindUnusedFeature, FindEntrypoints, FindDependents, EvidencePack"
  ontoly.category: "static-analysis"
  ontoly.enhancement: "LLM Enhancement"
  ontoly.deprecated: "false"
---

# Dead Code Analysis

Use this skill when the user asks for dead code analysis using Ontoly evidence.

## Required Workflow

Follow [the shared Ontoly workflow](reference/workflow.md). Also read [graph evidence rules](reference/graph.md), [MCP usage](reference/mcp.md), [best practices](reference/best-practices.md), and [fallback rules](reference/fallbacks.md) when the task requires detail.

## Ontoly Capabilities

Use these capabilities first: `FindDeadCode`, `FindUnusedFeature`, `FindEntrypoints`, `FindDependents`, `EvidencePack`.

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
- [Prompt template](templates/dependency-review.md)
- [Capability notes](reference/capabilities.md)
