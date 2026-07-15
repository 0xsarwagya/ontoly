# Migration Notes

## 0.1.0-alpha.16

This is the first Public Preview. Projects upgrading from
`0.1.0-alpha.14` do not need a Software Graph schema migration.

Recommended upgrade steps:

1. Upgrade Ontoly packages together to `0.1.0-alpha.16`.
2. Rebuild the repository graph.
3. Rerun semantic evaluation, skills validation, and release gates for your
   repository.
4. Reinstall Agent Skills so installed artifacts match the Public Preview source.

## 0.1.0-alpha.1

This was the first public alpha, so there was no previous public API to migrate
from.

## Internal Alpha Changes

If you used earlier local snapshots:

- Reinstall dependencies with `pnpm install --frozen-lockfile`.
- Rebuild packages with `pnpm build`.
- Reinstall Agent Skills so each installed skill has local `reference/` files.
- Rebuild `.ontoly/` artifacts because MCP confidence and provenance depend on current graph metadata.

## Compatibility

Plugins and tools should negotiate against the Software Graph version rather than the Ontoly package version.
