# @0xsarwagya/ontoly-cli

CLI and public convenience API for Ontoly.

This package is part of [Ontoly](https://github.com/0xsarwagya/ontoly), a TypeScript-native software intelligence engine that builds a deterministic Software Graph.

## Responsibility

`@0xsarwagya/ontoly-cli` is the user-facing composition boundary. It wires the
compiler, cache, query engine, capabilities, MCP, enhancers, and plugins into
commands, prompts, validation commands, and formatted output. Package-internal
semantics stay with the packages that own them.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-cli
```

## Usage

```bash
ontoly build
ontoly build .
ontoly build --remote https://github.com/0xsarwagya/ontoly.git
ontoly build . --output .ontoly
ontoly evidence "what owns authentication?"
ontoly graph --format html > graph.html
```

`ontoly build .` writes a deterministic `ontoly-output/` folder with graph
JSON, report JSON, per-type node and relationship files, graph communities, and
offline HTML explorers.

In an interactive terminal, bare `ontoly build` asks which folder to index.
Pass a root path, `--remote`, `--json`, `--no-prompt`, or `--yes` to keep
automation noninteractive.

## Status

Public Preview package for Ontoly v0.1.0-alpha.18. The public API is versioned with the Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.sarwagya.wtf)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
