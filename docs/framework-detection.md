# Framework Detection

Framework detection uses explicit deterministic signatures. Ontoly detects
frameworks from:

- package dependencies declared in `package.json`, `pyproject.toml` / `requirements.txt`, or `go.mod`
- language-native import specifiers (`import`, `from`, `import (...)`)
- deterministic framework analyzers that consume the language's semantic model

No framework is emitted from naming guesses alone. The full list of shipped
analyzers with facts and packages is in the [Framework Matrix](framework-matrix.md).

## Supported frameworks by language

**JavaScript / TypeScript**: NestJS, Angular, Express, Fastify, Hono, Koa,
Elysia, Next.js, Remix, SvelteKit, Astro, Nuxt, React, Vue, tRPC, Prisma,
Drizzle.

**Python**: Django, FastAPI, PyTorch, TensorFlow, Hugging Face, scikit-learn.

**Go**: Gin, Echo, Fiber, Chi, gRPC, GORM.

## Graph shape

Frameworks are represented as `Framework` nodes. Node IDs are stable and
namespaced:

- `framework:Express`
- `framework:Hono`
- `framework:Django`
- `framework:Gin`
- `framework:Prisma`

Relationships link frameworks into the wider graph:

- Repository dependencies `PROVIDE` frameworks.
- Packages `USE` frameworks.
- Routes are `REGISTERED_IN` frameworks when source imports support it.
- Controllers, models, and layers are `PART_OF` a framework's graph facts.

## NestJS

NestJS support includes decorator analysis for controllers, routes, modules,
providers, guards, and dependency injection. The logic lives in the NestJS
framework analyzer, not in the TypeScript language analyzer.

Supported graph relationships include:

- `HANDLES` — route to controller method
- `MOUNTS` — controller to route
- `DECLARES` — module to controller
- `REGISTERS` — module to controller or provider
- `PROVIDES` — module to provider
- `IMPORTS` — module to imported module
- `EXPORTS` — module to exported provider or module
- `AUTHORIZES` — guard to route or controller target

See [NestJS Support](nestjs-support.md) for the full walkthrough.

## HTTP-call analyzers (Express, Fastify, Hono, Koa, Elysia)

Deterministic route extraction reads `app.get("/path", handler)` style calls
against known HTTP framework receivers. Arbitrary `.get()` calls are not
treated as routes — the analyzer requires the receiver to resolve to the
framework's factory type (e.g. `express()`, `Fastify()`, `new Hono()`).

## Python frameworks

Python analyzers consume `PythonProject` and emit facts through the same
registry contract. See [Python Support](python-support.md).

- **Django** — models (`django.db.models.Model` subclasses), views, URL
  patterns, admin registrations, migrations.
- **FastAPI** — routes (`@app.get`, `@router.post`, …), dependencies,
  request/response Pydantic models.
- **PyTorch** — `nn.Module` subclasses, `forward()` boundaries,
  `torch.jit.export`, `torch.inference_mode` scopes.
- **TensorFlow** — Keras layer / model classes, training loops.
- **Hugging Face** — model, tokenizer, pipeline, and trainer instantiations
  from `transformers`.
- **scikit-learn** — estimators, transformers, pipelines from `sklearn.*`.

## Go frameworks

Go analyzers consume `GoProject` and emit facts through the same registry
contract. See [Go Support](go-support.md).

- **Gin, Echo, Fiber, Chi** — routes, groups, middleware, handler bindings.
- **gRPC** — service definitions, method signatures, streams, interceptors.
- **GORM** — model structs, tags, associations, migrations, hooks.

## Determinism

Detection is deterministic: same source in, same nodes and same edges out,
in the same order. Analyzers must not depend on filesystem iteration order,
random values, wall-clock time, or network state.
