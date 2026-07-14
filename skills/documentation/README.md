# Documentation

This is an official Ontoly Agent Skill. It is independently installable and teaches an agent how to use Ontoly for documentation.

## Version

- Skill version: 0.1.0-alpha.13
- Minimum Ontoly version: 0.1.0-alpha.13
- Required capabilities: `ExplainArchitecture`, `TraceRequestLifecycle`, `InspectModule`, `GraphStatistics`, `EvidencePack`
- Enhancement: LLM Enhancement
- Deprecated: no

## Install

Install this skill with any Agent Skills compatible installer that supports `SKILL.md` directories, or copy this folder into your agent skills directory.

## Use

Ask the agent a task such as:

> What documentation section is needed?

The agent should build or verify the Ontoly graph, use MCP capabilities, cite evidence, and only inspect files as a fallback.

## Public Docs

- [Agent Skills](https://oss.sarwagya.wtf/ontoly/docs/agent-skills)
- [Skills Overview](https://oss.sarwagya.wtf/ontoly/docs/skills-overview)
- [MCP](https://oss.sarwagya.wtf/ontoly/docs/mcp)
- [Capabilities](https://oss.sarwagya.wtf/ontoly/docs/capabilities)
- [Skills Validation](https://oss.sarwagya.wtf/ontoly/docs/skills-validation)

## Shared References

This skill depends on the shared Ontoly workflow in [reference/workflow.md](reference/workflow.md).
