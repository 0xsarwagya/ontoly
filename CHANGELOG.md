# Changelog

All notable Ontoly changes are tracked here.

## 0.1.0-alpha.1

Initial public alpha release candidate.

### Added

- Deterministic Software Graph schema and RFC process.
- TypeScript frontend for modules, functions, classes, interfaces, imports, and exports.
- Compiler pipeline, graph validation hooks, diagnostics, and serialization.
- Query Engine, MCP runtime, CLI, and graph artifact generation.
- Semantic Model, framework analysis surface, validation lab, semantic evaluation harness, and performance lab.
- Official Agent Skills collection with installed-artifact validation.

### Hardened

- MCP capability input validation with structured errors.
- Skill installation so each skill is self-contained when installed independently.
- Package metadata and CI release gates for npm and GitHub readiness.

### Known Limitations

- Ontoly Alpha focuses on TypeScript repositories.
- Framework analyzers are intentionally conservative.
- Binary graph serialization is not part of this release.

See [Known Limitations](docs/known-limitations.md) and [Roadmap](ROADMAP.md).
