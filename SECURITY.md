# Security Policy

## Supported Versions

Security fixes are accepted for the current release-candidate line.

| Version | Supported |
| ------- | --------- |
| 1.0.0-rc.x | Yes |
| 0.1.x alpha | Security-only when the fix is low risk |
| < 0.1.0-alpha | No |

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories for `0xsarwagya/ontoly`.

Include:

- Affected package or command.
- Reproduction steps.
- Expected impact.
- Whether the issue affects generated graph artifacts, MCP responses, package installation, or CI release gates.
- Whether attached graph artifacts are sanitized.

Do not attach private source code, secrets, production graph artifacts, or
customer repository names unless they are required to reproduce the issue and
safe to disclose privately.

## Response Timeline

- Initial acknowledgement: within 72 hours when possible.
- Triage update: within 7 days.
- Coordinated disclosure target: after a fix is available, unless active
  exploitation requires a different timeline.

## Scope

Ontoly is a local deterministic analysis tool. Security-sensitive areas include:

- Repository traversal and artifact writing.
- MCP capability input handling.
- Skill installation and reference resolution.
- Package distribution metadata.

Ontoly does not send source code to hosted services and does not call AI models.
