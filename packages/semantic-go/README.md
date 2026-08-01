# @0xsarwagya/ontoly-semantic-go

Go semantic bridge and framework analyzers for [Ontoly](https://ontoly.xyz).

Converts a `GoProject` semantic model into `CompilerSymbol` and `CompilerRelationship` artifacts for the Ontoly Software Graph. Includes framework analyzers for Gin, Echo, Fiber, Chi, gRPC, and GORM.

## Usage

```ts
import { analyzeGoProject } from "@0xsarwagya/ontoly-go";
import { generateGoCompilerArtifacts } from "@0xsarwagya/ontoly-semantic-go";

const project = analyzeGoProject({ root: ".", files: ["main.go"] });
const { symbols, relationships, detections } = generateGoCompilerArtifacts({ project });
```

## License

AGPL-3.0-only
