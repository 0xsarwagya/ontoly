# NestJS API Example

Uses local decorator stubs so it can be analyzed without installing NestJS.

Run from the repository root.

```sh
pnpm build
pnpm --dir examples/nestjs-api graph
pnpm --dir examples/nestjs-api routes
pnpm --dir examples/nestjs-api mcp
pnpm --dir examples/nestjs-api skills
```

The `mcp` command verifies MCP capability discovery. The `skills` command validates the installed-skill workflow and references from the repository root.
