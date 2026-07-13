# Validation Corpus

The corpus is Ontoly's permanent validation laboratory. Each repository entry is
materialized from `validation/repositories.json` into:

```text
validation/corpus/<group>/<repository>/
  manifest.json
  metadata.json
  results/
  expected/
  notes.md
```

The source repositories are never written to by the validation runner. Results,
performance data, dashboards, badges, and release-gate reports are written under
`validation/`.
