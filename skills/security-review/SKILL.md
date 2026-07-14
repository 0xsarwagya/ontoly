---
name: security-review
description: Review authentication, authorization, and security-sensitive flows using Ontoly graph evidence. Use when asked about auth ownership, protected routes, permissions, guards, or security risk.
license: MIT
compatibility: Portable Agent Skills format; requires Ontoly CLI and MCP-capable or CLI-capable coding agent.
metadata:
  ontoly.skill.version: "0.1.0-alpha.2"
  ontoly.min.version: "0.1.0-alpha.10"
  ontoly.capabilities: "FindAuthenticationFlow, FindResponsibleFunction, TraceRequestLifecycle, FindConfigurationUsage, EvidencePack"
  ontoly.category: "security"
  ontoly.enhancement: "LLM Enhancement"
  ontoly.deprecated: "false"
---

# Security Review

Use this skill when the user asks for security review using Ontoly evidence.

## Required Workflow

Follow [the shared Ontoly workflow](reference/workflow.md). Also read [graph evidence rules](reference/graph.md), [MCP usage](reference/mcp.md), [best practices](reference/best-practices.md), and [fallback rules](reference/fallbacks.md) when the task requires detail.

## Ontoly Capabilities

Use these capabilities first: `FindAuthenticationFlow`, `FindResponsibleFunction`, `TraceRequestLifecycle`, `FindConfigurationUsage`, `EvidencePack`.

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
- [Prompt template](templates/security-review.md)
- [Capability notes](reference/capabilities.md)
