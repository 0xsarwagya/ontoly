# Ontoly Basic Example

Minimal TypeScript project for the first graph build.

Run from the repository root.

```sh
pnpm build
pnpm --dir examples/basic graph
ls examples/basic/ontoly-output
pnpm ontoly search UserService --root examples/basic
pnpm ontoly impact UserService --root examples/basic
pnpm ontoly evidence UserService --root examples/basic
pnpm --dir examples/basic mcp
pnpm --dir examples/basic skills
```

The `graph` command writes `examples/basic/ontoly-output/`. The `search`,
`impact`, and `evidence` commands verify the first useful graph-backed query
loop. The `mcp` command verifies MCP capability discovery. The `skills` command
validates the installed-skill workflow and references from the repository root.
