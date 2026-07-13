# Contributing

Thanks for helping make Ontoly better.

Start with the project workflow in [docs/contributing.md](docs/contributing.md).

## Local Setup

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check-types
pnpm test
```

## Release Gates

Before opening a pull request:

```sh
pnpm release:gates
```

## RFC Required

Open an RFC before changing:

- Software Graph schema.
- Compiler pipeline architecture.
- Query API.
- Plugin API.
- Public node, edge, diagnostic, or serialization semantics.

See [RFC_INDEX.md](RFC_INDEX.md).
