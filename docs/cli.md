# CLI

The CLI builds, inspects, validates, and benchmarks the Software Graph.

Start with help:

```sh
ontoly --help
ontoly build --help
ontoly output --help
ontoly inspect --help
ontoly trace --help
ontoly evaluate --help
```

Common workflow:

```sh
ontoly build .
ontoly inspect src/service.ts
ontoly trace fn:src/index.ts:main
ontoly coverage
ontoly doctor
ontoly evaluate
ontoly leaderboard
ontoly skills validate
```

## Commands

- `ontoly build [root]`
- `ontoly output [root]`
- `ontoly analyze [root]`
- `ontoly semantic [root]`
- `ontoly frameworks [root]`
- `ontoly inspect [file-or-node]`
- `ontoly trace <node-id-or-name>`
- `ontoly stats [root]`
- `ontoly architecture [root]`
- `ontoly coverage [root]`
- `ontoly report [summary|api|dependencies|configuration|framework|frameworks|controllers|routes|modules|providers|workspace]`
- `ontoly graph [root]`
- `ontoly query <operation> [target]`
- `ontoly doctor [root]`
- `ontoly mcp`
- `ontoly skills <list|validate|doctor>`
- `ontoly validate [all|repository|framework]`
- `ontoly evaluate [repository]`
- `ontoly leaderboard`
- `ontoly diff <old.graph> <new.graph>`
- `ontoly benchmark semantic`
- `ontoly benchmark performance`

Most commands support `--json`.

## Output Bundle

`ontoly build .` creates a deterministic `ontoly-output/` folder for inspection,
agent consumption, website assets, and release artifacts by default:

```sh
ontoly build .
ontoly output .
ontoly output . --output ontoly-output
ontoly output . --json
```

The bundle includes canonical graph JSON, diagnostics, indexes, statistics,
semantic coverage, quality, semantic model, report JSONs, node files split by
type, relationship files split by type, graph community files, and offline HTML
explorers:

```text
ontoly-output/
  SoftwareGraph.json
  manifest.json
  reports/
  nodes/by-type/
  relationships/by-type/
  communities/
  html/graph.html
  html/architecture.html
```

Use `ontoly build . --output .ontoly` when you only want the compact cache-style
graph artifacts. Use `ontoly build . --output .ontoly --bundle` when you want
both `.ontoly/` and `ontoly-output/`. Use `--no-html` to skip HTML files and
`--no-semantic` to skip `semantic-model.json`.

## Logging

Human logs are pretty by default. Automation can request structured logs:

```sh
ontoly build . --log-json
ontoly build . --debug
ontoly build . --trace
```

Supported log levels:

- `info`
- `success`
- `warning`
- `error`
- `debug`
- `trace`

Use `--no-color` to disable ANSI colors.

## Errors

CLI errors include:

- stable error code
- friendly message
- suggested fix
- documentation path
- root cause when available

Example:

```text
ONTOLY1003

Ambiguous node "AuthService".

Suggestion:
Use one of these stable ids: class:src/auth.service.ts:AuthService
```

`ontoly analyze` writes the TypeScript Semantic Model to
`.ontoly/semantic-model.json`.

`ontoly semantic` reads `.ontoly/semantic-model.json` when present and prints a
summary by default. Use `--format json` or `--json` to print the canonical JSON
representation.

`ontoly frameworks` runs the default framework registry against the semantic
model and reports detected frameworks, analyzer versions, analyzer coverage, and
graph coverage.

`ontoly graph` supports:

- `--format summary`
- `--format json`
- `--format mermaid`
- `--format dot`
- `--format graphml`
- `--format html`

HTML output opens the Software Graph Explorer: an offline graph debugger with
Architecture, Dependency, Call Graph, and Full Graph modes.

`ontoly query` supports:

- `find`
- `callers`
- `callees`
- `dependencies`
- `dependents`
- `related`
- `impact`
- `routes`
- `frameworks`
- `configuration`
- `cycles`

`ontoly architecture` supports:

- `--json`
- `--format mermaid`
- `--format html`
- `--max-nodes`
- `--max-edges`

HTML architecture output opens the same Software Graph Explorer with
Architecture mode selected first.

`ontoly coverage` supports:

- `--json`
- `--format human`
- `--format markdown`
- `--format json`

It writes `.ontoly/coverage.json` and `.ontoly/quality.json`.

`ontoly report` supports:

- `--format markdown`
- `--format json`
- `--format mermaid`

Framework reports include:

- `framework`
- `controllers`
- `routes`
- `modules`
- `providers`

## Semantic Evaluation

`ontoly evaluate` runs the deterministic Semantic Evaluation Harness against
the persisted validation corpus. It writes per-repository reports, aggregate
leaderboards, performance data, and semantic regression results under
`validation/semantic/`.

```sh
ontoly evaluate
ontoly evaluate ovok-core
ontoly evaluate --ci
ontoly leaderboard
ontoly benchmark semantic
```

Use `--ci` to fail the command when the current semantic results regress against
`validation/semantic/regression-baseline.json`.

## Validation Lab

`ontoly validate` runs the permanent validation lab. It uses
`validation/repositories.json`, writes corpus results under `validation/corpus/`,
and generates dashboards, badges, performance reports, and release-gate results.

```sh
ontoly validate all
ontoly validate ovok-core
ontoly validate nextjs
ontoly validate react
ontoly benchmark performance
ontoly diff old.graph new.graph
```

Use `--ci` to fail on release-gate regressions. Use `--clone` to materialize all
remote catalog entries during `validate all`; explicit remote targets clone when
missing.

## Agent Skills

`ontoly skills` manages the official portable Agent Skills collection.

```sh
ontoly skills list
ontoly skills validate
ontoly skills doctor
```

`ontoly skills validate` checks `SKILL.md` metadata, shared references,
templates, examples, capability requirements, and agent-evaluation expectations.
It writes reports under `validation/skills/`.

## Doctor

`ontoly doctor` checks repository readiness and prints recommendations.

```sh
ontoly doctor .
ontoly doctor . --json
```

Recommendations include next commands such as `ontoly build .` and
`ontoly coverage .`.
