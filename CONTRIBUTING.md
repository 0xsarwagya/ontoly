# Contributing

Thanks for helping make Ontoly better.

Start with the project workflow in [docs/contributing.md](docs/contributing.md).

## Local Setup

```sh
corepack enable
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

For docs-only changes, run at least:

```sh
pnpm docs:check-links
pnpm docs:lint
```

For package metadata changes, run:

```sh
pnpm validate:packages
pnpm validate:pack
pnpm license:check
```

## RFC Required

Open an RFC before changing:

- Software Graph schema.
- Compiler pipeline architecture.
- Query API.
- Plugin API.
- Public node, edge, diagnostic, or serialization semantics.

See [RFC_INDEX.md](RFC_INDEX.md).

## Contribution License

By submitting a contribution, you agree to the
[Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md). The CLA lets
Ontoly remain available under AGPL-3.0 while allowing the creator to offer
commercial licenses.

Signed-off commits are welcome but not required unless a future governance
change says otherwise.
