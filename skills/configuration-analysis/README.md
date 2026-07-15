# Configuration Analysis

This is an official Ontoly Agent Skill. It is independently installable and teaches an agent how to use Ontoly for configuration analysis.

## Version

- Skill version: 0.1.0-alpha.16
- Minimum Ontoly version: 0.1.0-alpha.16
- Required capabilities: `FindConfiguration`, `FindConfigurationUsage`, `FindDependencies`, `GraphStatistics`, `EvidencePack`
- Enhancement: LLM Enhancement
- Deprecated: no

## Install

Install this skill with any Agent Skills compatible installer that supports `SKILL.md` directories, or copy this folder into your agent skills directory.

## Use

Ask the agent a task such as:

> Which environment variables are represented?

The agent should build or verify the Ontoly graph, use MCP capabilities, cite evidence, and only inspect files as a fallback.

## Public Docs

- [Agent Skills](https://ontoly.sarwagya.wtf/docs/agent-skills)
- [Skills Overview](https://ontoly.sarwagya.wtf/docs/skills-overview)
- [MCP](https://ontoly.sarwagya.wtf/docs/mcp)
- [Capabilities](https://ontoly.sarwagya.wtf/docs/capabilities)
- [Skills Validation](https://ontoly.sarwagya.wtf/docs/skills-validation)

## Shared References

This skill depends on the shared Ontoly workflow in [reference/workflow.md](reference/workflow.md).
