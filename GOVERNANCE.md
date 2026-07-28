# Governance

Ontoly is maintained by `0xsarwagya`.

The project is intentionally conservative because the Software Graph is a public
contract. Maintainers prioritize determinism, explainability, graph stability,
and release-gate evidence over feature velocity.

## Decision Process

- Bug fixes, documentation updates, validation updates, and package metadata
  changes can be reviewed through normal pull requests.
- Changes to the Software Graph, compiler pipeline, query API, plugin API,
  public types, serialization, MCP behavior, or Agent Skill compatibility
  require an RFC before implementation.
- Releases require package validation, npm pack validation, skills
  validation, documentation checks, license checks, semantic evaluation, and
  validation-lab gates.
- Licensing and trademark policy changes require maintainer approval.

## Maintainer Responsibilities

- Keep the public API small and deterministic.
- Reject graph behavior that depends on AI, embeddings, hidden heuristics, or
  non-reproducible state.
- Keep generated artifacts reproducible.
- Keep security reports private until a fix or mitigation is available.

## Contribution License

Ontoly accepts contributions under the
[Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md). The CLA keeps
the public project available under AGPL-3.0 and preserves the creator's ability
to offer commercial licenses.
