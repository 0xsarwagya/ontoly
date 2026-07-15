# New User Report

Generated: 2026-07-15T11:21:58.772Z
Repository: /Users/shrey/Documents/Codex/2026-07-13/product-requirements-document-prd-ontoly-repository

## Verdict

PASS

## Workflow

| Step | Exit | Duration | Notes |
| --- | ---: | ---: | --- |
| CLI help | 0 | 125ms | Ontoly |
| Build Software Graph | 0 | 510ms | { |
| Search UserService | 0 | 361ms | { |
| Impact UserService | 0 | 368ms | { |
| Build Semantics | 0 | 384ms | { |
| Evidence authentication | 0 | 363ms | { |
| List MCP capabilities | 0 | 6260ms | [ |
| Validate Skills | 0 | 148ms | Ontoly Skills Validation |

## Confusing Steps

- None observed in the source-checkout smoke path.

## Scope

- Uses the built source checkout CLI at `packages/cli/dist/cli.js`.
- Copies `examples/basic` into a temporary directory so the example tree stays clean.
- Exercises install-adjacent first-run behavior after `pnpm install` and `pnpm build` have completed.
- Does not start a long-running MCP server; it verifies capability listing with `ontoly mcp --list`.

