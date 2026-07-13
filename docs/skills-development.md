# Skills Development

Create a skill under:

```text
skills/<skill-name>/
```

Required files:

```text
SKILL.md
README.md
examples.md
templates/
reference/
```

`SKILL.md` must use YAML frontmatter with `name` and `description`, and the
name must match the directory.

## Metadata

Use Ontoly metadata keys:

```yaml
metadata:
  ontoly.skill.version: "0.1.0-alpha.1"
  ontoly.min.version: "0.1.0-alpha.1"
  ontoly.capabilities: "ExplainArchitecture, GraphStatistics"
  ontoly.category: "architecture"
  ontoly.deprecated: "false"
```

## Reference Files

The source repository keeps authoring copies under `skills/shared/`, but each
installed skill must be self-contained. Every skill must include and reference:

- `reference/workflow.md`
- `reference/graph.md`
- `reference/mcp.md`
- `reference/best-practices.md`
- `reference/fallbacks.md`
- `reference/capabilities.md`

Do not link from `SKILL.md` to `../shared/*`. That works in the source tree but
breaks independent skill installation.

## Boundaries

Skills may describe how to invoke Ontoly. Skills must not implement graph
understanding, query behavior, parser logic, framework logic, or code generation.
