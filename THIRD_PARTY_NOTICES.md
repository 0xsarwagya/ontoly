# Third-Party Notices

Ontoly is distributed under the MIT license.

The repository depends on open-source packages managed through `pnpm-lock.yaml`.
Primary development dependencies include TypeScript, Vitest, tsup, and Node.js
type definitions. Runtime package dependencies are declared in each publishable
package manifest.

## License Compatibility

Ontoly's release gates verify package metadata and local license files with:

```sh
pnpm license:check
pnpm validate:packages
pnpm validate:pack
```

Dependencies with MIT, ISC, BSD, and Apache-2.0 licenses are compatible with
Ontoly's MIT distribution model. If a future dependency introduces a stronger
copyleft license or a NOTICE requirement, maintainers must update this file
before release.

## Generated Artifacts

Generated Software Graphs, Semantics artifacts, validation reports, and Agent
Skill installation outputs may contain repository metadata owned by the analyzed
project. Do not publish generated artifacts from private repositories unless
they are sanitized and you have permission to share them.
