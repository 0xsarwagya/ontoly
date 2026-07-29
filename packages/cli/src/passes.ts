import { createRepositoryIntelligencePass, type CompilerPass } from "@0xsarwagya/ontoly-compiler";
import { createGoFrontendPass } from "@0xsarwagya/ontoly-parser-go";
import { createOpenApiFrontendPass } from "@0xsarwagya/ontoly-parser-openapi";
import { createPythonFrontendPass } from "@0xsarwagya/ontoly-parser-python";
import { createTypeScriptFrontendPass } from "@0xsarwagya/ontoly-parser-typescript";

/**
 * The default compiler passes wired by the Ontoly CLI: repository intelligence,
 * the TypeScript frontend, and the OpenAPI frontend.
 *
 * Exposed as a public convenience so callers can supply the batteries-included
 * pass set to lower-level entrypoints such as `buildSoftwareGraph` or
 * `buildSoftwareGraphFromMemory`.
 *
 * @example
 * ```ts
 * import { buildSoftwareGraphFromMemory, defaultCompilerPasses } from "@0xsarwagya/ontoly-cli";
 *
 * const result = await buildSoftwareGraphFromMemory({
 *   files: { "src/index.ts": "export const answer = 42;\n" },
 *   passes: defaultCompilerPasses(),
 * });
 * ```
 */
export function defaultCompilerPasses(): CompilerPass[] {
  return [createRepositoryIntelligencePass(), createTypeScriptFrontendPass(), createPythonFrontendPass(), createGoFrontendPass(), createOpenApiFrontendPass()];
}
