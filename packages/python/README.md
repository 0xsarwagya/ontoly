# @0xsarwagya/ontoly-python

## Responsibility

`@0xsarwagya/ontoly-python` owns the pure Python Semantic Model analysis. It
uses tree-sitter for zero-runtime-dependency parsing without owning graph
construction, framework analyzer registration, CLI behavior, or MCP transport.

See the repository [architecture map](../../ARCHITECTURE.md) for package
boundaries.

## Installation

```bash
pnpm add @0xsarwagya/ontoly-python
```

## API

- `analyzePythonProject(options)` builds the pure Python Semantic Model.
- `.py` file discovery and parsing.
- Serializable class, function, method, import, decorator, call, variable,
  and assignment facts.

## Example

```ts
import { analyzePythonProject } from "@0xsarwagya/ontoly-python";

const model = analyzePythonProject({ root: process.cwd(), files: ["app.py"] });
```

## Status

Stable v1.1.0 package. Public contracts are governed by the Software Graph specification and RFC process.

## Links

- [Repository](https://github.com/0xsarwagya/ontoly)
- [Documentation](https://oss.sarwagya.wtf/ontoly)
- [Issues](https://github.com/0xsarwagya/ontoly/issues)
