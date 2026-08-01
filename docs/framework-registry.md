# Framework Registry

The Framework Registry owns analyzer registration, deterministic ordering,
detection, and fact collection. Every language frontend ships its own registry
with the same shape.

## Registries

| Package | Registry | Default builder |
| ------- | -------- | --------------- |
| `@0xsarwagya/ontoly-semantic` | JavaScript / TypeScript | `createDefaultFrameworkRegistry()` |
| `@0xsarwagya/ontoly-semantic-python` | Python | `createDefaultPythonFrameworkRegistry()` |
| `@0xsarwagya/ontoly-semantic-go` | Go | `createDefaultGoFrameworkRegistry()` |

## API

```ts
import {
  createFrameworkRegistry,
  createDefaultFrameworkRegistry,
  createNestJsAnalyzer,
} from "@0xsarwagya/ontoly-semantic";

const registry = createFrameworkRegistry([createNestJsAnalyzer()]);
const detections = registry.detect(project);
const facts = registry.analyze(project);

// or start from the defaults and add analyzers
const withDefaults = createDefaultFrameworkRegistry();
```

The Python and Go registries expose the same shape:

```ts
import {
  createDefaultPythonFrameworkRegistry,
} from "@0xsarwagya/ontoly-semantic-python";

import {
  createDefaultGoFrameworkRegistry,
} from "@0xsarwagya/ontoly-semantic-go";
```

## Default analyzers

**JavaScript / TypeScript** (17 analyzers):

- NestJS
- Angular
- Express, Fastify, Hono, Koa, Elysia (HTTP call analyzers)
- Next.js, Remix, SvelteKit, Astro, Nuxt (meta-frameworks)
- React, Vue (view layers)
- tRPC
- Prisma, Drizzle (data)

**Python** (6 analyzers): Django, FastAPI, PyTorch, TensorFlow, Hugging Face, scikit-learn.

**Go** (6 analyzers): Gin, Echo, Fiber, Chi, gRPC, GORM.

The full list with facts and detection markers is in the
[Framework Matrix](framework-matrix.md).

## Responsibilities

The registry owns:

- analyzer registration
- analyzer ordering (deterministic, by analyzer `id`)
- framework discovery
- capability metadata
- semantic model version compatibility
- deterministic detection result ordering
- deterministic semantic fact ordering

It does not construct graph nodes and does not run compiler passes.

## Compatibility

Every analyzer declares:

- `id`
- `version`
- `capabilities`
- `compatibleModelVersions`

Analyzers must reject unsupported semantic model versions before emitting
facts. Ontoly uses this metadata for plugin negotiation and compatibility
diagnostics.

## Determinism

The registry sorts analyzers by ID and sorts detection results and facts
before returning them. An analyzer must not depend on registration order,
filesystem iteration order, random values, wall-clock time, or network state.

## Flow

```text
Analyzer registration
  |
  v
Deterministic analyzer order
  |
  v
Detection
  |
  v
Fact collection
  |
  v
Semantic Generator
```

## Adding an analyzer

See [Framework Analyzer API](framework-analyzer-api.md) for the analyzer
contract and language-specific base types.
