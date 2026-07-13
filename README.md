# Ontoly

Ontoly is a TypeScript-native software intelligence engine.

It turns a repository into a deterministic Software Graph that developer tools
can query instead of repeatedly searching files, parsing ASTs, and rebuilding
partial context.

Ontoly builds understanding. It does not answer questions, call AI models, or
generate code.

## Quick Start

```sh
pnpm add -D @0xsarwagya/ontoly-cli
```

```sh
ontoly init
```

```sh
ontoly build .
```

```sh
ontoly inspect AuthService
```

```sh
ontoly coverage .
```

Build artifacts are written to `.ontoly/`:

```text
SoftwareGraph.json
diagnostics.json
indexes.json
metadata.json
statistics.json
```

## Programmatic Usage

```ts
import { buildSoftwareGraph } from "@0xsarwagya/ontoly-compiler";
import { createQueryEngine } from "@0xsarwagya/ontoly-query";

const graph = await buildSoftwareGraph({ root: process.cwd() });
const query = createQueryEngine(graph);

const services = query.services();
const callers = query.callers("fn:src/auth/login.ts:login");
```

## CLI

```sh
ontoly --help
ontoly build --help
ontoly inspect --help
ontoly trace --help
ontoly evaluate --help
```

Useful commands:

- `ontoly build .`
- `ontoly inspect AuthService`
- `ontoly trace AuthController.login`
- `ontoly coverage .`
- `ontoly evaluate`
- `ontoly leaderboard`
- `ontoly skills validate`
- `ontoly validate all`
- `ontoly benchmark performance`

## MCP

```sh
ontoly mcp --list
ontoly mcp
```

The MCP package exposes deterministic capabilities such as dependency trees,
impact analysis, route tracing, and module explanation on top of the same query
engine.

## Agent Skills

Ontoly ships portable Agent Skills under `skills/`. They teach coding agents to
build the graph, use Ontoly MCP, cite evidence, report confidence, and inspect
files only as a fallback.

```sh
ontoly skills list
ontoly skills validate
ontoly skills doctor
```

Start with `skills/SKILL_CATALOG.md` and `docs/agent-skills.md`.

## Examples

Runnable examples live in `examples/`:

- `examples/typescript-library`
- `examples/nestjs-api`
- `examples/turborepo`
- `examples/cli-usage`
- `examples/mcp`
- `examples/semantic-queries`

## Boundaries

- **Not a chat interface.** Ontoly does not talk to users.
- **Not an AI agent.** Ontoly never uses model output to build the graph.
- **Not vector search.** Ontoly produces structural data, not embeddings.
- **Not code generation.** Plugins can generate things; the graph compiler does not.

## Packages

- `@0xsarwagya/ontoly-cli` - primary CLI and public convenience API.
- `@0xsarwagya/ontoly-core` - Software Graph schema, IDs, indexes, graph helpers.
- `@0xsarwagya/ontoly-parser-typescript` - TypeScript parser and relationship extractor.
- `@0xsarwagya/ontoly-compiler` - repository discovery, graph build, watch mode.
- `@0xsarwagya/ontoly-query` - deterministic graph query engine.
- `@0xsarwagya/ontoly-cache` - local graph artifact persistence.
- `@0xsarwagya/ontoly-diagnostics` - shared diagnostic constructors.
- `@0xsarwagya/ontoly-mcp` - structured MCP-style capabilities.
- `@0xsarwagya/ontoly-plugin-mermaid` - example plugin that renders graph diagrams.

## Documentation

Start here:

- `docs/getting-started/installation.mdx`
- `docs/getting-started/build-a-graph.mdx`
- `docs/cli.md`
- `docs/agent-skills.md`
- `docs/skills-validation.md`
- `docs/faq.md`
- `docs/troubleshooting.md`
- `docs/validation-lab.md`

## Status

Alpha-ready validation infrastructure is in place. The Software Graph and public
APIs are still experimental until the v1 specification is finalized.

## License

MIT.
