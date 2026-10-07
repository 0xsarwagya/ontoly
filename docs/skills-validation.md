---
title: "Skills Validation"
description: "Validate Ontoly Agent Skill metadata, references, templates, examples, installed artifacts, and release-gate behavior."
---

Run:

```bash
ontoly skills validate
```

This validates the project's `skills/` directory, or `.agents/skills/` when the
skills are installed into the project. An installed skills directory also holds
other skills, so only skills whose `SKILL.md` metadata has `ontoly.*` keys are
validated. Other skills are ignored.

To validate the skills installed for your agent with `npx skills add -g`, run:

```bash
ontoly skills validate --global
```

`--global` checks `~/.claude/skills` (or `$CLAUDE_CONFIG_DIR/skills`),
`~/.agents/skills`, and `~/.codex/skills` (or `$CODEX_HOME/skills`). It prints
one result for each directory that holds Ontoly skills. With `--json`, it prints
an array of those results.

CI should run:

```bash
ontoly skills validate --ci
```

The validator checks:

- `SKILL.md` exists
- frontmatter is valid
- skill name matches directory
- required metadata exists
- skill enhancement is the mandatory `LLM Enhancement`
- capability requirements are known Ontoly MCP capabilities
- `ontoly.min.version` is not newer than the running CLI
- README, examples, templates, and reference files exist
- local Markdown links resolve
- local installed-artifact references are used
- templates include repository, question, capabilities, evidence, and confidence
- examples cover Ovok Core, Ghost, durable-local, 0xsarwagya, and Innosphere
- agent evaluation passes

Agent evaluation verifies that each skill:

- uses Ontoly
- uses MCP
- avoids unnecessary repository search
- requires LLM Enhancement
- produces evidence
- produces confidence
- falls back gracefully

Reports are written only when you pass `--output <dir>`. The command then
writes `report.md`, `report.json`, `agent-evaluation.md`, and
`agent-evaluation.json` to that directory, and compares the agent evaluation
with `<dir>/regression-baseline.json`. In the Ontoly repository,
`pnpm skills:validate` writes them to `validation/skills/`.

CI also runs installed-artifact validation. It installs a single skill and the
full skill collection into temporary workspaces, then validates those installed
folders rather than only the source repository.
