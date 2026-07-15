# Ontoly 0.1.0-alpha.15 Public Preview Readiness Audit

Generated: 2026-07-15

## Verdict

READY TO PUBLISH `v0.1.0-alpha.15` THROUGH GITHUB ACTIONS

The core architecture, graph generation, semantic evaluation, skills, package
metadata, docs links, npm pack surface, and new-user command path are healthy.
The Public Preview performance investigation resolved the prior validation-lab blocker
without refreshing the baseline.

## Audit 1: Deletion Audit

Mission: delete everything that does not deserve to ship.

Result: no tracked files were deleted during this pass.

Evidence:

- No safe dead package was found. All 16 published package/plugin manifests
  validated with `node validation/tools/validate-packages.mjs`.
- No duplicate traversal, ranking, serialization, diagnostic, or confidence
  utility was clearly removable without changing behavior.
- `validation/graphify-version.stdout.log` and
  `validation/graphify-version.stderr.log` are written by
  `validation/tools/run-validation.mjs`, so they are validation evidence rather
  than scratch files.
- Existing alpha reports under `reports/` are linked from `README.md`, so they
  should be updated or replaced before stable v1 instead of deleted silently.
- Empty local directories were found at `apps/docs`, `apps/playground`, and
  `benchmark`, but they are not tracked files.

Deletion candidates before stable v1:

| Candidate | Status | Recommendation |
| --- | --- | --- |
| Alpha readiness reports | Linked | Replace with v1 Public Preview readiness reports or move to historical release notes. |
| CLI package `export *` aggregator | Public surface | Decide whether `@0xsarwagya/ontoly-cli` is intentionally a meta-package. If not, remove broad re-exports before v1. |
| Empty local directories | Untracked | Remove locally or add purposeful files if these directories are part of the public roadmap. |

## Audit 2: Public API Audit

Public export count:

- Package/plugin `src/index.ts` files scanned: 16
- Exported symbols before this audit branch: 265
- Exported symbols after this audit branch: 265
- Delta: 0

Public API concern:

`@0xsarwagya/ontoly-cli` re-exports several package surfaces with `export *`.
That makes CLI package imports convenient, but it also widens the public API.

Public Preview decision: keep the CLI package as an intentional public aggregate API. This
preserves existing behavior and avoids a public-preview breaking change.

No exported symbol was removed in this pass.

## Audit 3: Package Audit

Package validation:

```text
Package validation: PASS (16 packages)
```

Current package boundaries remain coherent:

- Core graph contracts remain in `@0xsarwagya/ontoly-core`.
- Compiler orchestration remains in `@0xsarwagya/ontoly-compiler`.
- Query, capabilities, MCP, enhancers, analyzers, cache, frontends, and plugins
  retain separate responsibilities.

Tiny packages such as diagnostics, cache, and mermaid still provide meaningful
release boundaries because they isolate contracts, persistence, and optional
rendering.

Post-Public Preview maintainability candidates:

- Split large single-file modules after Public Preview without changing public APIs:
  `packages/cli/src/cli.ts`, `packages/capabilities/src/index.ts`,
  `packages/typescript/src/index.ts`, `packages/semantic/src/index.ts`,
  `plugins/html/src/index.ts`, and `packages/query/src/index.ts`.

## Audit 4: New User Audit

Commands executed against `examples/basic`:

```sh
node packages/cli/dist/cli.js build examples/basic --output /tmp/ontoly-rr-audit/ontoly-output --no-color
node packages/cli/dist/cli.js search UserService --root examples/basic --json --no-color
node packages/cli/dist/cli.js impact UserService --root examples/basic --json --no-color
node packages/cli/dist/cli.js implementation-plan "change UserService" --root examples/basic --max-nodes 10 --json --no-color
```

Results:

- Build: PASS
- Bundle output: PASS, 51 files generated
- HTML explorer output: PASS
- Search `UserService`: PASS, confidence `0.948`
- Impact `UserService`: PASS, graph evidence returned
- Implementation plan `change UserService`: PASS, bounded PARTIAL output

New-user findings after Worker 2 Public Preview docs/DX pass:

| Finding | Severity | Evidence | Status |
| --- | --- | --- | --- |
| Weak demo query | Medium | `search UserService --root examples/basic` is now the documented first-run query. | Addressed in `README.md` and getting-started docs. |
| CLI help indentation drift | Medium | Command help and global help are space-indented consistently; focused CLI test guards command help against tabs. | Addressed in `packages/cli/src/cli.ts` and `packages/cli/tests/cli-dx.test.ts`. |

## Audit 5: Release Audit

Checks executed:

```text
pnpm install --frozen-lockfile: PASS
pnpm check-types: PASS
pnpm test: PASS
pnpm build: PASS
Package validation: PASS (16 packages)
License check: PASS
Markdown link check: PASS
Markdown style check: PASS
Source skills validation: PASS (14/14)
Installed skills validation: PASS
Semantic evaluation: PASS (Ontoly score 100, regression PASS)
Agent workflow validation: PASS (15/15 corpus queries, 2/2 stress profiles, 3/3 skill clients)
Validation Lab: PASS
Release Gates: PASS
Stress test: PASS
npm pack --dry-run: PASS (16 packages)
```

Release files present:

- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `SECURITY.md`
- `SUPPORT.md`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `ROADMAP.md`
- `ARCHITECTURE.md`
- `RFC_INDEX.md`
- `ALPHA_CHECKLIST.md`
- GitHub issue templates
- Pull request template
- Funding config
- Release config

Release sequencing checks for `v0.1.0-alpha.15`:

| Check | Evidence | Status |
| --- | --- | --- |
| Local release gates | `pnpm release:gates` passed on the public-preview worktree. | PASS |
| Package dry-run | `npm pack --dry-run --json` passed for all 16 publishable package/plugin manifests. | PASS |
| GitHub npm publishing | `.github/workflows/publish-npm.yml` reruns typecheck, tests, build, package validation, npm auth, and package publication. | Source of truth |
| Website redirect deployment | `site/manifest.json` declares the legacy `https://oss.sarwagya.wtf/ontoly` redirect target. | Deployment verification remains external to npm publication. |

## Final Recommendation

Do not start another architecture or compiler sprint.

Publish `v0.1.0-alpha.15` through the GitHub workflow, then verify npm install
smoke tests against the published packages.
