# NestJS Runtime Topology

This synthetic corpus captures deterministic NestJS runtime semantics that are hard to verify through graph size alone.

The source fixture lives in `packages/semantic/tests/generator.test.ts#createNestRuntimeFixture` and covers:

- BullMQ `@Processor` and `@Process` runtime transitions.
- Scheduler `@Cron` handlers.
- Event emitter `@OnEvent` handlers.
- WebSocket `@WebSocketGateway` and `@SubscribeMessage` handlers.
- `@InjectRepository`, `@InjectQueue`, `@InjectModel`, and `@Inject` constructor injection.
- Method-level `CALLS` edges through injected services.

This corpus is intentionally not registered in `validation/repositories.json` because it is a synthetic fixture, not an external repository checkout.
