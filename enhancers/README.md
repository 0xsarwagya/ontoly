# Ontoly Enhancers

Enhancers are deterministic transformations over Ontoly artifacts.

Each enhancer directory contains an `enhancer.json` manifest. The manifest is
the portable contract used by `ontoly enhancer list`, `ontoly enhancer inspect`,
and future published enhancer packages.

Built-in CLI enhancers currently wrap existing Ontoly behavior without changing
compiler output:

- `semantic-index`
- `capability-catalog`
- `validation-report`
- `repository-summary`
- `health-report`
- `risk-report`
- `dead-code-report`
- `architecture-report`
- `markdown-docs`
- `mermaid-diagram`
- `html-graph`
- `evaluation-summary`

See `docs/enhancers.md` for the API, lifecycle, pipeline, caching model, and
manifest format.
