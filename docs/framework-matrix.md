# Framework Matrix

Ontoly ships deterministic framework analyzers across three languages. Every
analyzer emits typed facts into the Software Graph — routes, controllers,
models, layers, edges, provenance — so downstream tools query framework
semantics without re-parsing configuration or source.

Framework coverage is measured through [Validation Lab](validation-lab.md),
not inferred from package names alone.

## Languages

| Language | Frontend package | Status | File extensions |
| -------- | ---------------- | ------ | --------------- |
| JavaScript | `@0xsarwagya/ontoly-semantic` | Supported | `.js`, `.jsx`, `.mjs`, `.cjs` |
| TypeScript | `@0xsarwagya/ontoly-semantic` | Supported | `.ts`, `.tsx`, `.mts`, `.cts` |
| Python | `@0xsarwagya/ontoly-semantic-python` | Supported | `.py` |
| Go | `@0xsarwagya/ontoly-semantic-go` | Supported | `.go` |

## JavaScript / TypeScript analyzers

Shipped in `@0xsarwagya/ontoly-semantic` and registered by
`createDefaultFrameworkRegistry()`.

| Analyzer | Package | Facts | Status |
| -------- | ------- | ----- | ------ |
| NestJS | `@nestjs/common`, `@nestjs/core` | Controllers, providers, modules, guards, interceptors, decorators, routes | Supported |
| Angular | `@angular/core` | Components, services, modules, directives, routes | Supported |
| Express | `express` | Routes, middleware, route handlers | Supported |
| Fastify | `fastify` | Routes, plugins, handlers | Supported |
| Hono | `hono` | Routes, middleware | Supported |
| Koa | `@koa/router` | Routes, middleware | Supported |
| Elysia | `elysia` | Routes, handlers | Supported |
| Next.js | `next` | Pages, API routes, layouts, middleware | Supported |
| Remix | `@remix-run/*` | Routes, loaders, actions | Supported |
| SvelteKit | `@sveltejs/kit` | Routes, load functions, actions | Supported |
| Astro | `astro` | Routes, endpoints | Supported |
| Nuxt | `nuxt` | Pages, API routes | Supported |
| React | `react` | Components, hooks | Supported |
| Vue | `vue` | Components, composables | Supported |
| tRPC | `@trpc/*` | Routers, procedures, input/output shapes | Supported |
| Prisma | `@prisma/client` | Models, relations, enums | Supported |
| Drizzle | `drizzle-orm` | Schema, tables, columns, relations | Supported |

## Python analyzers

Shipped in `@0xsarwagya/ontoly-semantic-python` and registered by
`createDefaultPythonFrameworkRegistry()`.

| Analyzer | Package | Facts | Status |
| -------- | ------- | ----- | ------ |
| Django | `django` | Models, views, URL patterns, admin, migrations | Supported |
| FastAPI | `fastapi` | Routes, dependencies, request models, response models | Supported |
| PyTorch | `torch` | Modules, forward passes, `torch.jit.export`, `torch.inference_mode` boundaries | Supported |
| TensorFlow | `tensorflow` | Layers, models, training loops | Supported |
| Hugging Face | `transformers` | Models, tokenizers, pipelines, trainers | Supported |
| scikit-learn | `sklearn` | Estimators, transformers, pipelines | Supported |

## Go analyzers

Shipped in `@0xsarwagya/ontoly-semantic-go` and registered by
`createDefaultGoFrameworkRegistry()`.

| Analyzer | Package | Facts | Status |
| -------- | ------- | ----- | ------ |
| Gin | `github.com/gin-gonic/gin` | Routes, groups, middleware, handlers | Supported |
| Echo | `github.com/labstack/echo/v4` | Routes, groups, middleware, handlers | Supported |
| Fiber | `github.com/gofiber/fiber/v2` | Routes, groups, middleware, handlers | Supported |
| Chi | `github.com/go-chi/chi/v5` | Routes, mounts, middleware, handlers | Supported |
| gRPC | `google.golang.org/grpc` | Services, methods, streams, interceptors | Supported |
| GORM | `gorm.io/gorm` | Models, associations, migrations, hooks | Supported |

## Cross-cutting

| Surface | Status | Notes |
| ------- | ------ | ----- |
| Turborepo workspaces | Validated | Multi-workspace graph roll-up |
| pnpm workspaces | Validated | Workspace resolution + package boundaries |
| OpenAPI | Experimental | Schema-driven graph facts via `@0xsarwagya/ontoly-parser-openapi` |
| GraphQL | Roadmap | Schema-driven graph facts, not shipped in v1.3.0 |
| SQL | Roadmap | Not shipped |

## Registry behavior

Analyzers deduplicate by name and run in registration order. The default
registries return the lists above; register a custom analyzer with
`createFrameworkRegistry([...])`, `createPythonFrameworkRegistry([...])`, or
`createGoFrameworkRegistry([...])`. See [Framework Analyzer API](framework-analyzer-api.md)
for the analyzer contract.
