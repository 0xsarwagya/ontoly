# Alpha Release Notes

## v0.1.0-alpha.1

This release candidate prepares Ontoly for its first public alpha.

## What Works

- Build a Software Graph from TypeScript examples.
- Inspect graph nodes, relationships, diagnostics, and statistics.
- Query the graph through the Query Engine and CLI.
- Start MCP and call deterministic graph capabilities.
- Install Ontoly Agent Skills as self-contained folders.
- Run validation, semantic evaluation, package checks, docs checks, and release gates.

## What Changed in the RC Pass

- Skill installation no longer depends on a sibling `skills/shared` folder after install.
- Installed skill artifacts are validated in CI.
- MCP capabilities validate required inputs and return structured errors.
- MCP responses include provenance and deterministic confidence derived from graph evidence.
- Package metadata is normalized for npm publishing.
- GitHub templates and release docs are present.

## Read Next

- [README](../README.md)
- [Known Limitations](known-limitations.md)
- [Compatibility Matrix](compatibility-matrix.md)
- [Feature Matrix](feature-matrix.md)
