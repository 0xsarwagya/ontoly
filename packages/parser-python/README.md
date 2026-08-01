# @0xsarwagya/ontoly-parser-python

## Responsibility

`@0xsarwagya/ontoly-parser-python` provides the `CompilerPass` wrapper for
Python source files. `createPythonFrontendPass()` filters `.py` files from the
source inventory, runs the Python semantic model analyzer, and emits
`language: "python"` compiler symbols.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-parser-python
```

## API

- `createPythonFrontendPass(options?)` creates a `CompilerPass` for the Python
  frontend stage.
- `PYTHON_FRONTEND_PASS_ID` is the stable pass identifier.

## Status

Stable v1.1.0 package. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://ontoly.xyz)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
