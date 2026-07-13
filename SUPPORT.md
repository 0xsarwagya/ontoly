# Support

Use the support channel that matches the problem:

- Bug reports: open a GitHub issue with a minimal reproduction.
- Security issues: follow [SECURITY.md](SECURITY.md).
- Usage questions: open a GitHub discussion.
- Release blockers: include the failing command, repository path, and generated report.

Before filing:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check-types
pnpm test
```

For graph or validation issues, attach:

- `.ontoly/diagnostics.json`
- `.ontoly/statistics.json`
- relevant `validation/` report

Do not attach private source code unless it is safe to share.
