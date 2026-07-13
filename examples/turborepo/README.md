# Turborepo Example

Small workspace fixture for package and workspace graph reporting.

Run from the repository root.

```sh
pnpm build
pnpm --dir examples/turborepo graph
pnpm --dir examples/turborepo workspace
pnpm --dir examples/turborepo mcp
pnpm --dir examples/turborepo skills
```

The `mcp` command verifies MCP capability discovery. The `skills` command validates the installed-skill workflow and references from the repository root.
