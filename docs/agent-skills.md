# Ontoly Agent Skills

Ontoly Agent Skills are portable `SKILL.md` packages that teach coding agents how
to use Ontoly before searching source files.

The skill layer contains workflow only. It does not contain compiler logic,
query logic, framework logic, SDK generation, or AI reasoning. Every claim about
a repository must come from Ontoly artifacts, the Query Engine, or Ontoly MCP.

## Install

```bash
pnpm add -D @0xsarwagya/ontoly-cli
ontoly build .
ontoly mcp
```

Then install a skill folder with an Agent Skills compatible installer. After the
repository is public, a single skill can be installed with:

```bash
npx skills add 0xsarwagya/ontoly --skill architecture-review
```

For local release testing, use the repository path:

```bash
npx skills add /path/to/ontoly --skill architecture-review --copy
```

Each installed skill is self-contained. Its `reference/` directory includes the
standard workflow, graph, MCP, best-practice, fallback, and capability guidance.

## Catalog

Start with the [Skills Overview](skills-overview.md) for the full skill list,
source links, install commands, and capability mapping.

Release assets:

- [Skill catalog](../skills/SKILL_CATALOG.md)
- [Skill matrix](../skills/SKILL_MATRIX.md)
- [Capability matrix](../skills/CAPABILITY_MATRIX.md)
- [Compatibility matrix](../skills/COMPATIBILITY_MATRIX.md)
- [Installation guide](../skills/INSTALLATION.md)

## Workflow

Every official installed skill points to `reference/workflow.md`:

1. Verify `.ontoly/SoftwareGraph.json`.
2. Run `ontoly build .` if the graph is missing.
3. Check graph trust with `ontoly coverage .`.
4. Use Ontoly MCP.
5. Invoke the task-specific capability.
6. Inspect files only when Ontoly cannot answer.
7. Cite node ids, relationship types, source spans, graph hash, and confidence.

## Commands

```bash
ontoly skills list
ontoly skills validate
ontoly skills doctor
```

`ontoly skills validate` writes:

```text
validation/skills/report.md
validation/skills/report.json
validation/skills/agent-evaluation.md
validation/skills/agent-evaluation.json
```

## Versioning

Each skill declares:

- skill version
- minimum Ontoly version
- required MCP capabilities
- category
- deprecation status

Compatibility is validated against both source skills and installed artifacts
before release.
