# Security Policy

## Supported Versions

Security fixes are accepted for the current alpha line.

| Version | Supported |
| ------- | --------- |
| 0.1.x alpha | Yes |

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories for `0xsarwagya/ontoly`.

Include:

- Affected package or command.
- Reproduction steps.
- Expected impact.
- Whether the issue affects generated graph artifacts, MCP responses, package installation, or CI release gates.

## Scope

Ontoly is a local deterministic analysis tool. Security-sensitive areas include:

- Repository traversal and artifact writing.
- MCP capability input handling.
- Skill installation and reference resolution.
- Package distribution metadata.

Ontoly does not send source code to hosted services and does not call AI models.
