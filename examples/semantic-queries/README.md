# Semantic Queries Example

Builds a graph for the TypeScript library fixture and queries it programmatically.

Run from the repository root.

```sh
pnpm build
pnpm --dir examples/semantic-queries graph
pnpm --dir examples/semantic-queries query
pnpm --dir examples/semantic-queries mcp
pnpm --dir examples/semantic-queries skills
```

The `mcp` command verifies MCP capability discovery. The `skills` command validates the installed-skill workflow and references from the repository root.
