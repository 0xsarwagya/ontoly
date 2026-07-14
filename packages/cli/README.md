# @0xsarwagya/ontoly-cli

CLI and public convenience API for Ontoly.

This package is part of [Ontoly](https://github.com/0xsarwagya/ontoly), a TypeScript-native software intelligence engine that builds a deterministic Software Graph.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-cli
```

## Usage

```bash
ontoly build .
ontoly build --remote https://github.com/0xsarwagya/ontoly.git
ontoly build . --output .ontoly
ontoly graph --format html > graph.html
```

`ontoly build .` writes a deterministic `ontoly-output/` folder with graph
JSON, report JSON, per-type node and relationship files, graph communities, and
offline HTML explorers.

## Status

Alpha package for Ontoly v0.1.0-alpha.4. The public API is versioned with the Software Graph and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
