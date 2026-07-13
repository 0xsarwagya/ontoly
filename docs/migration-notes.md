# Migration Notes

## 0.1.0-alpha.1

This is the first public alpha, so there is no previous public API to migrate from.

## Internal Alpha Changes

If you used earlier local snapshots:

- Reinstall dependencies with `pnpm install --frozen-lockfile`.
- Rebuild packages with `pnpm build`.
- Reinstall Agent Skills so each installed skill has local `reference/` files.
- Rebuild `.ontoly/` artifacts because MCP confidence and provenance depend on current graph metadata.

## Compatibility

Plugins and tools should negotiate against the Software Graph version rather than the Ontoly package version.
