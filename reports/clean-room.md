# Clean Room Installation Report

Generated: 2026-07-13T15:35:06.668Z

## Environment

- Source: local source export from /Users/shrey/Documents/Codex/2026-07-13/product-requirements-document-prd-ontoly-repository
- Clean room: /tmp/ontoly-clean-room-kt2qcy
- Reason source export was used: the current working tree is not committed to a public remote yet, so a literal git clone would not contain the public-preview files.
- Package manager: 11.7.0
- Node: v24.16.0

## Commands Executed

```sh
pnpm install --frozen-lockfile
pnpm build
node packages/cli/dist/cli.js build examples/basic --no-color
printf '{"capability":"GraphStatistics","input":{}}\n' | node packages/cli/dist/cli.js mcp --root examples/basic
npx skills add /path/to/ontoly --skill architecture-review --agent codex --copy --yes
node /path/to/ontoly/packages/cli/dist/cli.js skills validate --ci --no-color
```

## Timings

| Step | Elapsed |
| ---- | ------: |
| Source export | 5242ms |
| Install | 5845ms |
| Build | 15257ms |
| First successful graph | 15527ms |
| MCP graph statistics | 15670ms |
| Skill installed | 16021ms |
| First successful Skill | 16160ms |

## Results

- Install: PASS
- Build: PASS
- Generate graph: PASS
- Run MCP: PASS
- Install Skill: PASS
- Validate installed Skill: PASS

## Evidence

First graph output ended with:

```text
info    Hash: 1a8j3ud
success Build completed in 0.00s
info    Graph: /private/tmp/ontoly-clean-room-kt2qcy/ontoly/examples/basic/.ontoly/SoftwareGraph.json
info    Diagnostics: /private/tmp/ontoly-clean-room-kt2qcy/ontoly/examples/basic/.ontoly/diagnostics.json
info    Statistics: /private/tmp/ontoly-clean-room-kt2qcy/ontoly/examples/basic/.ontoly/statistics.json
```

MCP startup stderr:

```text
info    Ontoly MCP runtime started. Send one JSON request per line.
```

Skill installation output ended with:

```text
Installed 1 skill:
- architecture-review (copied)
- ./.agents/skills/architecture-review
```

Skill validation output began with:

```text
Ontoly Skills Validation

Status: PASS
Skills: 1/1
Agent evaluation: PASS
Regression: PASS

Skills:
  architecture-review (0.1.0-alpha.1) -> ExplainArchitecture, GraphStatistics, FindCycles, FindDependencies

Issues:
  none
```

## Confusing Steps

- Public GitHub installation cannot be fully verified until the public-preview files are pushed to the public repository.
- The documented package name is scoped as `@0xsarwagya/ontoly-cli`; future docs may add a short unscoped `ontoly` package if that distribution alias is created.

## Unexpected Assumptions

- A source checkout must run `pnpm build` before invoking `node packages/cli/dist/cli.js`.
- Agent Skill installation is validated through the installed `.agents/skills` artifact, not only the source `skills/` folder.

## Suggested Improvements

- Publish the repository before the final external install test and rerun with `git clone https://github.com/0xsarwagya/ontoly`.
- Add npm-published package smoke tests after the first alpha package is available.
