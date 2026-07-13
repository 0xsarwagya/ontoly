# Dead Code Analysis

This is an official Ontoly Agent Skill. It is independently installable and teaches an agent how to use Ontoly for dead code analysis.

## Version

- Skill version: 0.1.0-alpha.1
- Minimum Ontoly version: 0.1.0-alpha.1
- Required capabilities: `FindDeadCode`, `FindUnusedFeature`, `FindEntrypoints`, `FindDependents`
- Deprecated: no

## Install

Install this skill with any Agent Skills compatible installer that supports `SKILL.md` directories, or copy this folder into your agent skills directory.

## Use

Ask the agent a task such as:

> Which nodes lack inbound usage?

The agent should build or verify the Ontoly graph, use MCP capabilities, cite evidence, and only inspect files as a fallback.

## Shared References

This skill depends on the shared Ontoly workflow in [reference/workflow.md](reference/workflow.md).
