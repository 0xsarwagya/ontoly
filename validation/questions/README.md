# Semantic Capability Question Corpus

This corpus evaluates deterministic software understanding.

It is intentionally separate from graph-size validation. A question should fail
because Ontoly missed or misclassified graph evidence, not because the graph is
small or large.

## Files

- `questions.json` is the current deterministic alpha corpus.

## Question Shape

Each question contains:

- `id`
- `repository`
- `category`
- `question`
- `capability`
- `input`
- `expectedEvidence`
- `acceptance`

## Authoring Rules

- Prefer questions that map to explicit Software Graph facts.
- Require evidence, not narrative.
- Keep expected answers stable across rebuilds whenever possible.
- Mark inferred expectations as `partial` until the graph can prove them.
- Do not add AI-generated answers as expected results.

## Regression Use

Every release should compare current answers against the persisted baseline and
flag:

- new failures
- reduced precision or recall
- lower deterministic confidence
- missing evidence
- slower capability latency
