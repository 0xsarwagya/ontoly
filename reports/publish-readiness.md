# Publish Readiness Report

Generated: 2026-07-15T11:20:00Z

## Verdict

PACKAGE ARTIFACTS READY; PUBLIC RC LAUNCH BLOCKED BY WEBSITE DOMAIN

Use [RC_READINESS.md](../RC_READINESS.md) as the authoritative
release-candidate readiness report.

## Package Health

| Check | Status | Evidence |
| --- | --- | --- |
| Package metadata | PASS | `pnpm validate:packages`: 18 packages passed. |
| npm pack artifacts | PASS | `pnpm validate:pack`: 18 publishable packages passed. |
| Release version | PASS | `pnpm validate:release-version`: `1.0.0-rc.1`. |
| License consistency | PASS | `pnpm license:check` passed. |
| CLI bin | PASS | `@0xsarwagya/ontoly-cli` exposes `ontoly` as `./dist/cli.js`. |

## Validation Health

| Check | Status | Evidence |
| --- | --- | --- |
| Build | PASS | `pnpm build` passed. |
| Typecheck | PASS | `pnpm check-types` passed. |
| Tests | PASS | `pnpm test`: 27 files and 120 tests passed. |
| Skills | PASS | `pnpm skills:validate` and `pnpm skills:validate-installed` passed. |
| New user smoke | PASS | `NEW_USER_REPORT.md` passed the source-checkout first-run path. |
| Semantic evaluation | PASS | Semantic Understanding Score 100; regression PASS. |
| Validation lab | PASS | 5/5 repositories measured; average coverage 98.8; average trust 98.8; release gates PASS. |

## Publish Guardrails

- `scripts/publish-npm.mjs` refuses prerelease versions with the `latest`
  dist-tag.
- `scripts/publish-npm.mjs` verifies all publishable packages share one
  version.
- When `RELEASE_VERSION` is set, publishing requires `HEAD` to be tagged with
  `v$RELEASE_VERSION`.
- `.github/workflows/publish-npm.yml` defaults to the `rc` dist-tag and enables
  npm provenance.

## Remaining Blocker

`https://ontoly.sarwagya.wtf` must be attached before launch if it is the
canonical public URL. Until then, public docs and package homepages point to the
live OSS route: `https://oss.sarwagya.wtf/ontoly`.
