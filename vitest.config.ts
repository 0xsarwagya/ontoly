import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/**/tests/**/*.test.ts", "plugins/**/tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@0xsarwagya/ontoly-analyzers": fromRoot("./packages/analyzers/src/index.ts"),
      "@0xsarwagya/ontoly-cache": fromRoot("./packages/cache/src/index.ts"),
      "@0xsarwagya/ontoly-capabilities": fromRoot("./packages/capabilities/src/index.ts"),
      "@0xsarwagya/ontoly-compiler": fromRoot("./packages/compiler/src/index.ts"),
      "@0xsarwagya/ontoly-core": fromRoot("./packages/core/src/index.ts"),
      "@0xsarwagya/ontoly-diagnostics": fromRoot("./packages/diagnostics/src/index.ts"),
      "@0xsarwagya/ontoly-enhancer": fromRoot("./packages/enhancer/src/index.ts"),
      "@0xsarwagya/ontoly-enhancer-semantics": fromRoot("./packages/enhancers/semantics/src/index.ts"),
      "@0xsarwagya/ontoly-intelligence": fromRoot("./packages/intelligence/src/index.ts"),
      "@0xsarwagya/ontoly-mcp": fromRoot("./packages/mcp/src/index.ts"),
      "@0xsarwagya/ontoly-parser-openapi": fromRoot("./packages/parser-openapi/src/index.ts"),
      "@0xsarwagya/ontoly-parser-typescript": fromRoot("./packages/parser-typescript/src/index.ts"),
      "@0xsarwagya/ontoly-plugin-html": fromRoot("./plugins/html/src/index.ts"),
      "@0xsarwagya/ontoly-plugin-mermaid": fromRoot("./plugins/mermaid/src/index.ts"),
      "@0xsarwagya/ontoly-query": fromRoot("./packages/query/src/index.ts"),
      "@0xsarwagya/ontoly-semantic": fromRoot("./packages/semantic/src/index.ts"),
      "@0xsarwagya/ontoly-typescript": fromRoot("./packages/typescript/src/index.ts"),
      "@0xsarwagya/ontoly-cli": fromRoot("./packages/cli/src/index.ts"),
    },
  },
});
