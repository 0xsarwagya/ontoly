# Repository Intelligence

Repository intelligence is implemented as a compiler pass:

```ts
createRepositoryIntelligencePass()
```

The pass reads repository files from the source inventory and emits compiler
symbols and relationships. It does not bypass graph construction.

## Supported Files

- `package.json`
- `tsconfig.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.github/workflows/*.yml`
- Biome, ESLint, and Prettier configuration files

## Emitted Nodes

- `Workspace`
- `Package`
- `Script`
- `Dependency`
- `Task`
- `Pipeline`
- `EnvironmentVariable`
- `BuildTarget`
- `Configuration`
- `Container`
- `Workflow`
- `Job`
- `Step`
- `Framework`

## Emitted Relationships

- `CONTAINS`
- `CONFIGURES`
- `DEPENDS_ON`
- `EXECUTES`
- `PROVIDES`
- `USES`

All relationships use configuration evidence and exact confidence.
