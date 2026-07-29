# @0xsarwagya/ontoly-parser-go

Go parser and relationship extractor for [Ontoly](https://oss.sarwagya.wtf/ontoly).

Provides `createGoFrontendPass()`, a `CompilerPass` that analyzes `.go` files and emits typed symbols and relationships into the Ontoly compiler pipeline.

## Usage

```ts
import { createGoFrontendPass } from "@0xsarwagya/ontoly-parser-go";

const pass = createGoFrontendPass();
// Add to your compiler pipeline
```

## License

AGPL-3.0-only
