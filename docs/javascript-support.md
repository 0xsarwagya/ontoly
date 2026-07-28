# JavaScript Support

Ontoly analyzes JavaScript and TypeScript with one deterministic frontend built
on the TypeScript Compiler API. Both languages produce the same Software Graph
node kinds, relationship kinds, stable IDs, diagnostics, and query behavior.

## Source Files

The frontend discovers:

- `.js`
- `.jsx`
- `.mjs`
- `.cjs`
- `.ts`
- `.tsx`
- `.mts`
- `.cts`

JavaScript graph symbols use `language: "javascript"`. TypeScript graph symbols
continue to use `language: "typescript"`.

## Modules

Supported module syntax includes:

- static ESM `import` and `export`
- literal dynamic `import()` references
- literal CommonJS `require()` references
- `module.exports = value`
- `module.exports.name = value`
- `exports.name = value`
- object exports such as `module.exports = { handler }`

CommonJS bindings resolve to local functions, classes, modules, or external
packages whenever the Compiler API can prove the target. Import and export
relationships use the same stable graph IDs as ESM.

## Configuration

Ontoly reads the nearest `tsconfig.json`. When no TypeScript configuration
exists, it reads `jsconfig.json`. Module resolution, `baseUrl`, `paths`, JSX,
and related compiler options are applied to analysis.

JavaScript is enabled by default. Set `allowJs: false` in compiler options to
exclude JavaScript files explicitly.

## Frameworks

Framework analyzers consume the shared language model, so JavaScript imports and
calls participate in the same framework detection as TypeScript. Express,
Fastify, and Hono call-style routes work with ESM and CommonJS. JSX files can
participate in React and Next.js detection. Framework coverage remains governed
by the [Framework Matrix](framework-matrix.md).

## Determinism

JavaScript and TypeScript sources are sorted before analysis. CommonJS imports
and exports receive deterministic IDs, source spans, provenance, and evidence.
An identical mixed-language repository produces the same graph hash across
builds.

## Static Boundaries

Ontoly resolves module names that are statically present in source. Runtime
string construction, computed export names, monkey-patching, and module loading
hidden behind arbitrary runtime code cannot be proven and are not guessed.
