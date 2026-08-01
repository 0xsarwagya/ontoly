# Go Support

Ontoly analyzes Go with a first-class deterministic frontend that emits the
same Software Graph node kinds, relationship kinds, stable IDs, diagnostics,
and query behavior as the JavaScript/TypeScript and Python frontends.

No Go toolchain is required to build the graph — Ontoly parses `.go` source
directly.

## Packages

| Layer | Package |
| ----- | ------- |
| Parser | `@0xsarwagya/ontoly-parser-go` |
| Language model | `@0xsarwagya/ontoly-go` |
| Semantic + framework registry | `@0xsarwagya/ontoly-semantic-go` |

## Source files

The frontend discovers:

- `.go`

Go graph symbols use `language: "go"`. Test files (`_test.go`) are indexed
and marked as tests; they participate in the graph but do not gate coverage.

## Modules and packages

Go's package system maps naturally to graph modules:

- module nodes correspond to Go packages
- imports become `IMPORTS` edges with the resolved target when found in
  `go.mod` or the module's vendored tree
- unresolved imports are reported, never guessed

## Structs, interfaces, functions, methods

The Go frontend emits:

- package nodes
- struct nodes (with fields, tags, `EMBEDS` edges for embedded types)
- interface nodes (with `IMPLEMENTS` edges for structs that satisfy them)
- function nodes (with receiver types where present)
- method nodes bound to their receiver
- constant, variable, and type-alias nodes
- `exported` flags derived from Go's capitalization convention
- call edges (`CALLS`) for statically resolvable calls

## Configuration

Ontoly reads:

- `go.mod` — module path, Go version, dependencies
- `go.sum` — dependency hashes for provenance
- workspace files (`go.work`) — multi-module workspaces are treated as one
  graph roll-up

Discovered dependencies feed framework detection (Gin, Echo, Fiber, Chi,
gRPC, GORM) through the same registry contract as JS/TS and Python.

## Frameworks

The default Go registry ships 6 analyzers. See the
[Framework Matrix](framework-matrix.md) for the full list of facts each
analyzer emits.

- **Gin** — routes, groups, middleware, handler bindings.
- **Echo** — routes, groups, middleware, handler bindings.
- **Fiber** — routes, groups, middleware, handler bindings.
- **Chi** — routes, mounts, middleware, handler bindings.
- **gRPC** — service definitions, method signatures, streams, interceptors.
- **GORM** — model structs, tags, associations, migrations, hooks.

Each analyzer registers deterministic facts through
[Framework Analyzer API](framework-analyzer-api.md).

## Determinism

Go sources are sorted before analysis. Package IDs, symbol IDs, source
spans, and evidence are stable across builds. An identical repository
produces the same graph hash every time.

## Static boundaries

Ontoly resolves imports that are statically present in source. Build tags,
`go:generate` directives, plugin loading (`plugin.Open`), reflection-heavy
code, and `unsafe` pointer plays cannot always be proven and are surfaced
as unresolved or low-confidence facts — never guessed.

Generics are supported at the declaration level — a `func F[T any]` and its
type parameters are modelled, and instantiations are recorded when they are
statically resolvable.
