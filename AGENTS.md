# Test Requirements

- Use `vitest` with `happy-dom` for React/component tests.
- Before considering any task complete, run `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build` in parallel.
- Run both `pnpm test` and `pnpm test:coverage` before finishing implementation.
- Keep coverage high: statements/lines/functions >= 95%, branches >= 90%.
- Avoid global/import mocks whenever possible.
- Do not mock `@marp-team/marp-core` by overriding imports. Use interfaces/dependency injection and inject fakes in tests.
- Ensure React components and app integration flows are covered by tests.
