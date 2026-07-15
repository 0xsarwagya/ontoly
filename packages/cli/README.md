# @0xsarwagya/ontoly-cli

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

## API

- The `ontoly` binary.
- Public CLI orchestration for build, output, search, impact, evidence, semantics, MCP, skills, validation, and release commands.
- Convenience exports from the CLI package entrypoint for embedding Ontoly workflows.

## Example

```bash
ontoly build .
ontoly search authentication
ontoly impact AuthService --json
ontoly semantics build .
```

## Status

Release Candidate package for Ontoly v1.0.0-rc.1. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
