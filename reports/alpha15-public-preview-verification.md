# Ontoly 0.1.0-alpha.15 Public Preview Verification

Generated: 2026-07-15

## Scope

This report verifies the merged local `v0.1.0-alpha.15` public-preview worktree.
This pass did not modify compiler behavior, graph schema, capabilities, or
semantic retrieval logic.

## Release Engineering Audit

| Area | Status | Evidence |
| --- | --- | --- |
| Workflows | PASS | `.github/workflows/semantic-evaluation.yml`, `publish-npm.yml`, and `publish-site.yml` are present. |
| Issue templates | PASS | Bug report and feature request templates are present. |
| Discussions | PASS | Question and idea discussion templates are present. |
| Pull request template | PASS | `.github/PULL_REQUEST_TEMPLATE.md` is present and references release gates. |
| CODEOWNERS | FIXED | `.github/CODEOWNERS` was missing and is now added. |
| SECURITY | PASS | `SECURITY.md` is present with private reporting guidance. |
| SUPPORT | PASS | `SUPPORT.md` is present with issue/discussion/security routing. |
| CONTRIBUTING | PASS | `CONTRIBUTING.md` is present and points to RFC requirements. |
| CODE_OF_CONDUCT | PASS | `CODE_OF_CONDUCT.md` is present. |
| LICENSE | PASS | `LICENSE` is present. |
| CHANGELOG | PASS | `CHANGELOG.md` includes a `0.1.0-alpha.15` entry. |
| ROADMAP | PASS | `ROADMAP.md` is present for public release context. |
| RFC index | PASS | `RFC_INDEX.md` is present and links accepted core RFCs. |

## Focused Verification Commands

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm validate:packages` | PASS | Package validation: PASS (16 packages). |
| `pnpm skills:validate` | PASS | Source skills: 14/14, agent evaluation PASS, regression PASS. |
| `pnpm skills:validate-installed` | PASS | Installed skill validation: PASS. |
| `pnpm docs:check-links && pnpm docs:lint` | PASS | Markdown link check PASS; Markdown style check PASS. |
| `pnpm evaluate` | PASS | Ontoly Semantic Understanding Score: 100; regression PASS. |
| `node validation/tools/validate-agent-workflows.mjs` | PASS | Corpus queries 15/15, stress profiles 2/2, skill clients 3/3. |
| `pnpm install --frozen-lockfile` | PASS | Dependencies installed from the frozen lockfile. |
| `pnpm check-types` | PASS | TypeScript type checks completed. |
| `pnpm test` | PASS | 25 test files and 107 tests passed. |
| `pnpm build` | PASS | All workspace packages built. |
| `pnpm benchmark:semantic` | PASS | Ontoly aggregate semantic-evaluation latency: 0.556ms. |
| `pnpm stress` | PASS | Virtual deterministic stress profiles completed through the 1M-node profile. |
| `npm pack --dry-run --json` for every package/plugin | PASS | 16 package artifacts dry-packed at `0.1.0-alpha.15`. |
| Local CLI smoke | PASS | Build/search/impact/implementation-plan succeeded against `examples/basic`; output bundle generated 51 files with HTML explorers. |
| `pnpm validate:ci` | PASS | Validation lab measured 5/5 repositories; release gates PASS. |
| `node validation/tools/run-validation-lab.mjs gates --ci` | PASS | No failures; only `durable-local` timing variance warning under 1000ms. |

Generated validation, skills, benchmark, and website-asset outputs are kept in
the worktree because the Public Preview prompt requires regenerated release evidence.

## Public GitHub Clean-Room Smoke Test

Source used:

```text
https://github.com/0xsarwagya/ontoly
```

Commands executed in a fresh temporary directory:

```sh
git clone --depth 1 https://github.com/0xsarwagya/ontoly "$tmp/ontoly"
corepack pnpm install --frozen-lockfile
corepack pnpm build
node packages/cli/dist/cli.js build examples/basic --no-color
node packages/cli/dist/cli.js search UserService --root examples/basic --json --no-color
node packages/cli/dist/cli.js impact UserService --root examples/basic --json --no-color
node packages/cli/dist/cli.js implementation-plan "change UserService" --root examples/basic --max-nodes 10 --json --no-color
node packages/cli/dist/cli.js skills validate --ci --no-color
```

Result: PASS for the current public repository state.

Evidence:

- Install completed with pnpm `11.5.3`.
- Build completed.
- `examples/basic` generated a Software Graph with 27 nodes and 38
  relationships.
- Search `UserService` returned confidence `0.948`.
- Impact `UserService` returned high confidence `0.938` with 3 evidence items
  and 0 diagnostics.
- Implementation plan `change UserService` returned bounded output with 3
  evidence items and 2 diagnostics.
- Skills validation passed for 14/14 skills.

Important limitation: this clean-room smoke test validates the public GitHub
commit currently available from `main`, which still reports skill/package
versions as `0.1.0-alpha.14`. It cannot validate the uncommitted local
`v0.1.0-alpha.15` branch changes until those changes are pushed to GitHub.

## Publication Checks

| Check | Owner | Evidence | Status |
| --- | --- | --- | --- |
| Public Preview source push | Publish phase | GitHub is the publication source for this release. | Required before workflow dispatch. |
| npm package smoke test | Publish phase | Public GitHub source smoke passed; npm Public Preview packages are verified after package publication. | Post-publish verification. |

## Worker 3 Verdict

Release engineering structure is healthy after adding CODEOWNERS. Focused
verification commands and release gates passed locally after the Public Preview performance
investigation. The GitHub npm publish workflow is the publication source of
truth and reruns package validation before publishing.
