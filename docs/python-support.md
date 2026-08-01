# Python Support

Ontoly analyzes Python with a first-class deterministic frontend that emits
the same Software Graph node kinds, relationship kinds, stable IDs,
diagnostics, and query behavior as the JavaScript/TypeScript frontend.

No Python runtime is required to build the graph — Ontoly parses `.py` source
directly.

## Packages

| Layer | Package |
| ----- | ------- |
| Parser | `@0xsarwagya/ontoly-parser-python` |
| Language model | `@0xsarwagya/ontoly-python` |
| Semantic + framework registry | `@0xsarwagya/ontoly-semantic-python` |

## Source files

The frontend discovers:

- `.py`

Python graph symbols use `language: "python"`.

## Modules and imports

Supported import syntax:

- `import mod`
- `import mod as alias`
- `from mod import name`
- `from mod import name as alias`
- `from .rel import name` (relative imports resolved through the package tree)
- `from mod import *` (surface as a wildcard edge with lower confidence)

Import edges carry the resolved target when Ontoly can prove it from the
package graph, and are reported as unresolved otherwise (never guessed).

## Classes, functions, and methods

The Python frontend emits:

- module nodes
- class nodes (with `EXTENDS` edges to parents in the same graph)
- function nodes (module-level, methods, nested)
- decorator edges (`DECORATED_BY`)
- call edges (`CALLS`) for statically resolvable calls
- `exported` flags derived from `__all__` when declared, otherwise from
  Python's leading-underscore convention

## Configuration

Ontoly reads:

- `pyproject.toml` — package name, dependencies, tooling
- `requirements.txt` / `requirements/*.txt` — dependencies
- `setup.cfg` — legacy package metadata
- `Pipfile`, `poetry.lock`, `uv.lock` — dependency locks for provenance

Discovered dependencies feed framework detection (Django, FastAPI, PyTorch,
TensorFlow, Hugging Face, scikit-learn) through the same registry contract
as JS/TS.

## Frameworks

The default Python registry ships 6 analyzers. See the
[Framework Matrix](framework-matrix.md) for the full list of facts each
analyzer emits.

- **Django** — models, views, URL patterns, admin, migrations.
- **FastAPI** — routes, dependencies, request/response Pydantic models.
- **PyTorch** — `nn.Module` classes, `forward()` boundaries,
  `torch.jit.export`, and `torch.inference_mode` scopes.
- **TensorFlow** — Keras layer / model classes, training loops.
- **Hugging Face** — model, tokenizer, pipeline, trainer instantiations from
  `transformers`.
- **scikit-learn** — estimators, transformers, pipelines from `sklearn.*`.

Each analyzer registers deterministic facts through
[Framework Analyzer API](framework-analyzer-api.md).

## Determinism

Python sources are sorted before analysis. Module IDs, symbol IDs, source
spans, and evidence are stable across builds. An identical repository
produces the same graph hash every time.

## Static boundaries

Ontoly resolves imports that are statically present in source. Dynamic
`__import__`, `importlib.import_module` with runtime-constructed names,
`exec` / `eval`, metaclass tricks that rewrite the module at import time,
and runtime monkey-patching cannot be proven and are surfaced as unresolved
or low-confidence facts — never guessed.
