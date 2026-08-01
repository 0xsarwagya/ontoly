# Framework Analyzer API

Framework analyzers turn a language semantic model into framework semantic
facts. Every language frontend ships its own analyzer contract with the same
shape:

| Language | Analyzer type | Project type | Registry |
| -------- | ------------- | ------------ | -------- |
| JavaScript / TypeScript | `FrameworkAnalyzer` | `TypeScriptProject` | `@0xsarwagya/ontoly-semantic` |
| Python | `PythonFrameworkAnalyzer` | `PythonProject` | `@0xsarwagya/ontoly-semantic-python` |
| Go | `GoFrameworkAnalyzer` | `GoProject` | `@0xsarwagya/ontoly-semantic-go` |

Analyzers never access compiler internals and never construct Software Graph
nodes or relationships. Framework knowledge is isolated from the language
layer; graph construction is centralized in the Semantic Generator.

## Interface (JavaScript / TypeScript)

```ts
interface FrameworkAnalyzer {
  id: string;
  name: string;
  version: string;
  capabilities: readonly string[];
  compatibleModelVersions: readonly string[];
  detect(project: TypeScriptProject): DetectionResult;
  analyze(project: TypeScriptProject): readonly SemanticFact[];
}
```

## Interface (Python)

```ts
interface PythonFrameworkAnalyzer {
  id: string;
  name: string;
  version: string;
  capabilities: readonly string[];
  compatibleModelVersions: readonly string[];
  detect(project: PythonProject): DetectionResult;
  analyze(project: PythonProject): readonly SemanticFact[];
}
```

## Interface (Go)

```ts
interface GoFrameworkAnalyzer {
  id: string;
  name: string;
  version: string;
  capabilities: readonly string[];
  compatibleModelVersions: readonly string[];
  detect(project: GoProject): DetectionResult;
  analyze(project: GoProject): readonly SemanticFact[];
}
```

## Detection result

```ts
interface DetectionResult {
  framework: string;
  detected: boolean;
  confidence: "exact" | "inferred" | "low";
  evidence: readonly string[];
  analyzerId: string;
  analyzerVersion: string;
  coverage?: number;
  metadata?: JsonObject;
}
```

Detection must be deterministic and evidence-backed. Package imports are
exact evidence. Decorators, naming conventions, and call shapes are inferred
evidence unless the analyzer can tie them to a known import.

## Semantic facts

The Semantic Generator accepts these framework fact kinds:

- `ControllerDeclared`
- `RouteDeclared`
- `ModuleDeclared`
- `ProviderDeclared`
- `DependencyInjected`
- `GuardRegistered`
- `MiddlewareRegistered`
- `ModelDeclared` (Python, Go)
- `MigrationDeclared` (Python — Django, Go — GORM)
- `LayerDeclared` (Python — PyTorch, TensorFlow, HF)

Each fact includes:

- `kind`
- `analyzerId`
- `framework`
- `confidence`
- optional `span`
- optional `metadata`

Facts are intermediate compiler inputs. The Semantic Generator is responsible
for converting them into graph nodes and edges.

## Rules

An analyzer may:

- inspect the language project (imports, exports, classes, methods, decorators, calls, types, structs, interfaces)
- emit semantic facts
- report deterministic detection evidence
- declare capabilities and compatible semantic model versions

An analyzer must not:

- mutate the semantic model
- access compiler internals
- use raw parser or Compiler APIs directly
- construct `SoftwareGraph` nodes directly
- depend on wall-clock time, random order, or external services

## Shipped analyzers

The full list of shipped analyzers per language is in the
[Framework Matrix](framework-matrix.md). Every listed analyzer performs
complete framework-specific semantic extraction — the "placeholder analyzer"
tier from earlier releases was removed in v1.1.0-alpha.2.

## Flow

```text
Language semantic model  (TypeScriptProject | PythonProject | GoProject)
  |
  v
Framework Analyzer detect()
  |
  v
Framework Analyzer analyze()
  |
  v
Semantic Facts
  |
  v
Semantic Generator -> Software Graph
```

## Writing a new analyzer

1. Pick your language and depend on its semantic package.
2. Implement the interface for that language. Give the analyzer a stable
   `id` and semver `version`.
3. In `detect()`, return exact evidence (usually an import specifier or a
   `package.json` / `go.mod` / `pyproject.toml` entry).
4. In `analyze()`, return facts sorted by `(kind, analyzerId, span?.start ?? 0)`
   for determinism.
5. Register the analyzer with `createFrameworkRegistry([yourAnalyzer])`
   (or the Python / Go equivalent) and validate through the
   [Validation Lab](validation-lab.md).
