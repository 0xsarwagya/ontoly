# @0xsarwagya/ontoly-semantic-python

## Responsibility

`@0xsarwagya/ontoly-semantic-python` bridges the Python Semantic Model into
`CompilerSymbol[]` and `CompilerRelationship[]`, and hosts Python framework
analyzers (Django, FastAPI, PyTorch, TensorFlow, HuggingFace, scikit-learn).

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-semantic-python
```

## API

- `generatePythonCompilerArtifacts(project)` converts a `PythonProject` into
  compiler symbols and relationships.
- `createDefaultPythonFrameworkRegistry()` returns all built-in Python framework
  analyzers.
- Individual analyzer constructors: `createDjangoAnalyzer()`,
  `createFastApiAnalyzer()`, `createPyTorchAnalyzer()`,
  `createTensorFlowAnalyzer()`, `createHuggingFaceAnalyzer()`,
  `createScikitLearnAnalyzer()`.

## Status

Stable v1.1.0 package. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
