# Known Limitations

Ontoly v1.3.0 is intentionally conservative. Deterministic graph facts beat
speculative ones. This page enumerates what Ontoly does not do so you know
where the graph ends.

## Language support

- **JavaScript / TypeScript, Python, and Go** are supported by first-class
  frontends. Every frontend produces the same node kinds, relationship kinds,
  stable IDs, and query behavior.
- **OpenAPI** ships as an experimental parser (`@0xsarwagya/ontoly-parser-openapi`)
  that emits schema-driven facts.
- **Prisma, Drizzle, tRPC, GraphQL SDL, and SQL** — Prisma and Drizzle ship
  in v1.3.0 as JS/TS analyzers. GraphQL SDL parsing and SQL schema parsing
  remain roadmap work.
- Runtime-generated module names, computed CommonJS exports, dynamically
  constructed import specifiers, and metaprogrammed decorators are not
  resolvable statically and are surfaced as low-confidence facts or
  diagnostics.
- Cross-language relationships (a Python service that calls a Go service
  over HTTP, or a TypeScript client that imports a Python-declared schema)
  are not modelled automatically — each language frontend produces its own
  subgraph.

## Framework support

- Every shipped framework analyzer performs complete semantic extraction —
  the placeholder-analyzer tier was removed in v1.1.0-alpha.2. See the
  [Framework Matrix](framework-matrix.md) for the full list.
- Analyzers report deterministic evidence only. Unsupported framework
  behavior produces diagnostics or lowers coverage instead of guessed graph
  facts.
- Dynamic runtime wiring (e.g. plugins registered at boot from environment
  variables) is out of reach for static analysis and is reported as
  unresolved.

## Graph artifacts

- Canonical JSON is the only supported serialization format. Binary formats
  are intentionally out of scope until the Software Graph specification is
  stable.
- The `.ontoly` cache directory and the `ontoly-output/` bundle are both
  fully deterministic — same source in, same bytes out.
- Large validation outputs (Validation Lab, benchmarks) are release evidence,
  not a substitute for source analysis.

## Agent skills

- Skills teach workflow only. Ontoly does not run LLMs; a skill orchestrates
  an agent to query Ontoly for evidence and reason with that evidence.
- Skills must use Ontoly MCP or graph artifacts for understanding.
- Skills should inspect source files only when Ontoly cannot answer with
  evidence.
- LLM-facing usage requires [LLM Enhancement](llm-enhancement.md); Ontoly
  does not provide LLM reasoning itself.

## Not goals

- Not a chat interface, coding agent, or copilot.
- Not vector search or embeddings.
- Not a hosted service.
- Not a code generator by default.
- Not a replacement for TypeScript, ESLint, pytest, `go vet`, or any test
  suite.

Plugins may build AI-facing tools, SDK generators, docs, diagrams, or
reports on top of the graph. The compiler itself remains deterministic and
AI-free.
