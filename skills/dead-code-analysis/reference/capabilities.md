# Dead Code Analysis Capability Notes

Primary capabilities: `FindDeadCode`, `FindUnusedFeature`, `FindEntrypoints`, `FindDependents`, `EvidencePack`.

Use [../reference/mcp.md](../reference/mcp.md) for common capability behavior and fallback CLI equivalents.

## Required Evidence

- capability name
- graph hash
- node ids and types
- relationship types and direction
- source spans when present
- confidence

## Compatibility

- Skill version: 0.1.0-alpha.3
- Minimum Ontoly version: 0.1.0-alpha.11
- Deprecation status: active
