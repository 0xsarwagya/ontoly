# @0xsarwagya/ontoly-go

Pure Go semantic model analyzer for [Ontoly](https://ontoly.xyz), powered by tree-sitter.

Parses Go source files and produces a typed semantic model (`GoProject`) covering packages, structs, interfaces, functions, methods, imports, constants, variables, type aliases, and call expressions.

## Usage

```ts
import { analyzeGoProject } from "@0xsarwagya/ontoly-go";

const project = analyzeGoProject({
  root: "/path/to/project",
  files: ["main.go", "server.go"],
});

console.log(project.structs);
console.log(project.functions);
```

## License

AGPL-3.0-only
